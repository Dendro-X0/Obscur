"use client";

import { hasNativeRuntime } from "@/app/features/runtime/runtime-capabilities";
import { isVaultWriteEncryptionReady } from "@/app/features/storage/services/vault-at-rest";
import { logRuntimeEvent } from "@/app/shared/runtime-log-classification";
import {
  getLocalMediaIndexSnapshot,
  isLegacyPlaintextVaultIndexEntry,
  migrateLegacyPlaintextVaultIndexEntry,
  type VaultLegacyMigrationEntryResult,
} from "./local-media-store";

export type VaultLegacyMigrationStatus = "idle" | "running" | "complete" | "failed";

export type VaultLegacyMigrationProgress = Readonly<{
  status: VaultLegacyMigrationStatus;
  pending: number;
  migrated: number;
  alreadyEncrypted: number;
  missingFile: number;
  failed: number;
}>;

export type VaultLegacyMigrationSummary = Readonly<{
  pending: number;
  migrated: number;
  alreadyEncrypted: number;
  missingFile: number;
  failed: number;
}>;

const VAULT_LEGACY_MIGRATION_PROGRESS_EVENT = "obscur:vault-legacy-migration-progress";

const IDLE_PROGRESS: VaultLegacyMigrationProgress = {
  status: "idle",
  pending: 0,
  migrated: 0,
  alreadyEncrypted: 0,
  missingFile: 0,
  failed: 0,
};

let currentProgress: VaultLegacyMigrationProgress = IDLE_PROGRESS;
let activeMigration: Promise<VaultLegacyMigrationSummary> | null = null;

const isBrowser = (): boolean => typeof window !== "undefined";

const emitProgress = (progress: VaultLegacyMigrationProgress): void => {
  currentProgress = progress;
  if (!isBrowser()) {
    return;
  }
  window.dispatchEvent(new CustomEvent(VAULT_LEGACY_MIGRATION_PROGRESS_EVENT, { detail: progress }));
};

export const getVaultLegacyMigrationProgress = (): VaultLegacyMigrationProgress => currentProgress;

export const subscribeVaultLegacyMigrationProgress = (
  handler: (progress: VaultLegacyMigrationProgress) => void,
): (() => void) => {
  if (!isBrowser()) {
    return () => undefined;
  }
  const listener = (event: Event) => {
    const detail = (event as CustomEvent<VaultLegacyMigrationProgress>).detail;
    if (detail) {
      handler(detail);
    }
  };
  window.addEventListener(VAULT_LEGACY_MIGRATION_PROGRESS_EVENT, listener);
  return () => window.removeEventListener(VAULT_LEGACY_MIGRATION_PROGRESS_EVENT, listener);
};

export const listLegacyPlaintextVaultIndexRemoteUrls = (): ReadonlyArray<string> => {
  const index = getLocalMediaIndexSnapshot();
  return Object.entries(index)
    .filter(([, entry]) => entry && isLegacyPlaintextVaultIndexEntry(entry))
    .map(([remoteUrl]) => remoteUrl);
};

export const countLegacyPlaintextVaultIndexEntries = (): number =>
  listLegacyPlaintextVaultIndexRemoteUrls().length;

const bumpResultCount = (
  summary: VaultLegacyMigrationSummary,
  result: VaultLegacyMigrationEntryResult,
): VaultLegacyMigrationSummary => {
  switch (result) {
    case "migrated":
      return { ...summary, migrated: summary.migrated + 1 };
    case "already_encrypted":
      return { ...summary, alreadyEncrypted: summary.alreadyEncrypted + 1 };
    case "missing_file":
      return { ...summary, missingFile: summary.missingFile + 1 };
    default:
      return { ...summary, failed: summary.failed + 1 };
  }
};

export const runVaultLegacyPlaintextMigration = async (): Promise<VaultLegacyMigrationSummary> => {
  if (activeMigration) {
    return activeMigration;
  }

  activeMigration = (async () => {
    if (!hasNativeRuntime() || !isVaultWriteEncryptionReady()) {
      emitProgress(IDLE_PROGRESS);
      return {
        pending: 0,
        migrated: 0,
        alreadyEncrypted: 0,
        missingFile: 0,
        failed: 0,
      };
    }

    const remoteUrls = listLegacyPlaintextVaultIndexRemoteUrls();
    const pending = remoteUrls.length;
    if (pending === 0) {
      const completeProgress: VaultLegacyMigrationProgress = {
        status: "complete",
        pending: 0,
        migrated: 0,
        alreadyEncrypted: 0,
        missingFile: 0,
        failed: 0,
      };
      emitProgress(completeProgress);
      return {
        pending: 0,
        migrated: 0,
        alreadyEncrypted: 0,
        missingFile: 0,
        failed: 0,
      };
    }

    let summary: VaultLegacyMigrationSummary = {
      pending,
      migrated: 0,
      alreadyEncrypted: 0,
      missingFile: 0,
      failed: 0,
    };

    emitProgress({
      status: "running",
      pending,
      migrated: 0,
      alreadyEncrypted: 0,
      missingFile: 0,
      failed: 0,
    });

    for (const remoteUrl of remoteUrls) {
      const result = await migrateLegacyPlaintextVaultIndexEntry(remoteUrl);
      summary = bumpResultCount(summary, result);
      emitProgress({
        status: "running",
        pending: Math.max(0, pending - summary.migrated - summary.alreadyEncrypted - summary.missingFile - summary.failed),
        migrated: summary.migrated,
        alreadyEncrypted: summary.alreadyEncrypted,
        missingFile: summary.missingFile,
        failed: summary.failed,
      });
    }

    const finalStatus: VaultLegacyMigrationStatus = summary.failed > 0 ? "failed" : "complete";
    emitProgress({
      status: finalStatus,
      pending: 0,
      migrated: summary.migrated,
      alreadyEncrypted: summary.alreadyEncrypted,
      missingFile: summary.missingFile,
      failed: summary.failed,
    });

    if (summary.migrated > 0) {
      logRuntimeEvent(
        "vault_legacy_migration.complete",
        "expected",
        [`[VaultLegacyMigration] Migrated ${summary.migrated} plaintext vault file(s) to encrypted storage.`],
      );
    }

    return summary;
  })().finally(() => {
    activeMigration = null;
  });

  return activeMigration;
};

export const scheduleVaultLegacyPlaintextMigrationOnUnlock = (): void => {
  if (!hasNativeRuntime() || !isVaultWriteEncryptionReady()) {
    return;
  }
  if (countLegacyPlaintextVaultIndexEntries() === 0) {
    return;
  }
  void runVaultLegacyPlaintextMigration().catch((error) => {
    logRuntimeEvent(
      "vault_legacy_migration.failed",
      "degraded",
      ["[VaultLegacyMigration] Background migration failed:", error],
    );
    emitProgress({
      ...currentProgress,
      status: "failed",
    });
  });
};
