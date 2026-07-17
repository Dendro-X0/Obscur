"use client";

import { hasNativeRuntime } from "@/app/features/runtime/runtime-capabilities";
import { isVaultWriteEncryptionReady } from "@/app/features/storage/services/vault-at-rest";
import { getResolvedProfileId } from "@/app/features/profiles/services/profile-runtime-scope";
import { logRuntimeEvent } from "@/app/shared/runtime-log-classification";
import { isFlatProfileVaultBlobRelativePath, isLegacyVaultLayoutIndexEntry } from "./local-media-vault-path";
import {
  getLocalMediaIndexSnapshot,
  migrateLegacyVaultLayoutIndexEntry,
  type VaultLayoutMigrationEntryResult,
} from "./local-media-store";

export type VaultLayoutMigrationStatus = "idle" | "running" | "complete" | "failed";

export type VaultLayoutMigrationProgress = Readonly<{
  status: VaultLayoutMigrationStatus;
  pending: number;
  migrated: number;
  alreadyMigrated: number;
  missingFile: number;
  failed: number;
}>;

export type VaultLayoutMigrationSummary = Readonly<{
  pending: number;
  migrated: number;
  alreadyMigrated: number;
  missingFile: number;
  failed: number;
}>;

const VAULT_LAYOUT_MIGRATION_PROGRESS_EVENT = "obscur:vault-layout-migration-progress";

const IDLE_PROGRESS: VaultLayoutMigrationProgress = {
  status: "idle",
  pending: 0,
  migrated: 0,
  alreadyMigrated: 0,
  missingFile: 0,
  failed: 0,
};

let currentProgress: VaultLayoutMigrationProgress = IDLE_PROGRESS;
let activeMigration: Promise<VaultLayoutMigrationSummary> | null = null;

const isBrowser = (): boolean => typeof window !== "undefined";

const emitProgress = (progress: VaultLayoutMigrationProgress): void => {
  currentProgress = progress;
  if (!isBrowser()) {
    return;
  }
  window.dispatchEvent(new CustomEvent(VAULT_LAYOUT_MIGRATION_PROGRESS_EVENT, { detail: progress }));
};

export const getVaultLayoutMigrationProgress = (): VaultLayoutMigrationProgress => currentProgress;

export const subscribeVaultLayoutMigrationProgress = (
  handler: (progress: VaultLayoutMigrationProgress) => void,
): (() => void) => {
  if (!isBrowser()) {
    return () => undefined;
  }
  const listener = (event: Event) => {
    const detail = (event as CustomEvent<VaultLayoutMigrationProgress>).detail;
    if (detail) {
      handler(detail);
    }
  };
  window.addEventListener(VAULT_LAYOUT_MIGRATION_PROGRESS_EVENT, listener);
  return () => window.removeEventListener(VAULT_LAYOUT_MIGRATION_PROGRESS_EVENT, listener);
};

export const listLegacyVaultLayoutIndexRemoteUrls = (): ReadonlyArray<string> => {
  const index = getLocalMediaIndexSnapshot();
  return Object.entries(index)
    .filter(([, entry]) => {
      if (!entry?.relativePath) {
        return false;
      }
      return isLegacyVaultLayoutIndexEntry(entry)
        || isFlatProfileVaultBlobRelativePath(entry.relativePath);
    })
    .map(([remoteUrl]) => remoteUrl);
};

const summarizeResults = (
  results: ReadonlyArray<VaultLayoutMigrationEntryResult>,
): VaultLayoutMigrationSummary => {
  let migrated = 0;
  let alreadyMigrated = 0;
  let missingFile = 0;
  let failed = 0;
  results.forEach((result) => {
    if (result === "migrated") {
      migrated += 1;
      return;
    }
    if (result === "already_migrated") {
      alreadyMigrated += 1;
      return;
    }
    if (result === "missing_file") {
      missingFile += 1;
      return;
    }
    failed += 1;
  });
  return {
    pending: 0,
    migrated,
    alreadyMigrated,
    missingFile,
    failed,
  };
};

export const runVaultLayoutMigration = async (): Promise<VaultLayoutMigrationSummary> => {
  if (!hasNativeRuntime() || !isVaultWriteEncryptionReady()) {
    return { pending: 0, migrated: 0, alreadyMigrated: 0, missingFile: 0, failed: 0 };
  }
  if (activeMigration) {
    return activeMigration;
  }

  const pendingUrls = listLegacyVaultLayoutIndexRemoteUrls();
  if (pendingUrls.length === 0) {
    const summary = { pending: 0, migrated: 0, alreadyMigrated: 0, missingFile: 0, failed: 0 };
    emitProgress({ ...IDLE_PROGRESS, status: "complete" });
    return summary;
  }

  emitProgress({
    status: "running",
    pending: pendingUrls.length,
    migrated: 0,
    alreadyMigrated: 0,
    missingFile: 0,
    failed: 0,
  });

  activeMigration = (async () => {
    const results: VaultLayoutMigrationEntryResult[] = [];
    let migrated = 0;
    let alreadyMigrated = 0;
    let missingFile = 0;
    let failed = 0;

    for (const remoteUrl of pendingUrls) {
      const result = await migrateLegacyVaultLayoutIndexEntry(remoteUrl);
      results.push(result);
      if (result === "migrated") {
        migrated += 1;
      } else if (result === "already_migrated") {
        alreadyMigrated += 1;
      } else if (result === "missing_file") {
        missingFile += 1;
      } else {
        failed += 1;
      }
      emitProgress({
        status: "running",
        pending: Math.max(0, pendingUrls.length - results.length),
        migrated,
        alreadyMigrated,
        missingFile,
        failed,
      });
    }

    const summary = summarizeResults(results);
    emitProgress({
      status: failed > 0 ? "failed" : "complete",
      pending: 0,
      migrated: summary.migrated,
      alreadyMigrated: summary.alreadyMigrated,
      missingFile: summary.missingFile,
      failed: summary.failed,
    });

    if (summary.migrated > 0) {
      logRuntimeEvent(
        "vault_layout_migration.completed",
        "expected",
        [`[VaultLayoutMigration] Moved ${summary.migrated} vault blob(s) into profiles/{id}/vault/{category}/.`],
      );
    }
    if (summary.failed > 0) {
      logRuntimeEvent(
        "vault_layout_migration.failed",
        "degraded",
        [`[VaultLayoutMigration] Failed to move ${summary.failed} vault blob(s).`],
      );
    }

    return summary;
  })().finally(() => {
    activeMigration = null;
  });

  return activeMigration;
};

export const scheduleVaultLayoutMigrationOnUnlock = (): void => {
  if (!hasNativeRuntime() || !isVaultWriteEncryptionReady()) {
    return;
  }
  const profileId = getResolvedProfileId().trim();
  if (!profileId) {
    return;
  }
  void runVaultLayoutMigration().catch((error) => {
    logRuntimeEvent(
      "vault_layout_migration.schedule_failed",
      "degraded",
      ["[VaultLayoutMigration] Unlock migration failed:", error],
    );
  });
};
