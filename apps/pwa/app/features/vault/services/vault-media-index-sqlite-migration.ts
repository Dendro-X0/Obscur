"use client";

import { getScopedStorageKey } from "@/app/features/profiles/services/profile-scope";
import { getResolvedProfileId } from "@/app/features/profiles/services/profile-runtime-scope";
import { hasNativeRuntime } from "@/app/features/runtime/runtime-capabilities";
import { isVaultWriteEncryptionReady } from "@/app/features/storage/services/vault-at-rest";
import { logRuntimeEvent } from "@/app/shared/runtime-log-classification";
import {
  getVaultMediaIndexLocalStorageKey,
  hydrateVaultMediaIndexCacheFromSqlite,
  type LocalMediaIndexEntry,
} from "./local-media-store";
import {
  persistVaultMediaIndexSnapshotToSqlite,
  usesSqliteVaultMediaIndex,
} from "./vault-media-index-sqlite-store";

const SQLITE_IMPORT_DONE_KEY = "obscur.vault.media_index_sqlite_imported";

const scopedImportDoneKey = (profileId: string): string =>
  getScopedStorageKey(SQLITE_IMPORT_DONE_KEY, profileId);

const readLegacyLocalStorageIndex = (profileId: string): Record<string, LocalMediaIndexEntry> => {
  if (typeof window === "undefined") {
    return {};
  }
  try {
    const raw = localStorage.getItem(getVaultMediaIndexLocalStorageKey(profileId));
    if (!raw) {
      return {};
    }
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== "object") {
      return {};
    }
    return parsed as Record<string, LocalMediaIndexEntry>;
  } catch {
    return {};
  }
};

export const runVaultMediaIndexSqliteImportOnUnlock = async (): Promise<Readonly<{
  imported: number;
  hydrated: boolean;
}>> => {
  if (!usesSqliteVaultMediaIndex() || !isVaultWriteEncryptionReady()) {
    return { imported: 0, hydrated: false };
  }
  const profileId = getResolvedProfileId().trim();
  if (!profileId) {
    return { imported: 0, hydrated: false };
  }

  let imported = 0;
  const alreadyImported = localStorage.getItem(scopedImportDoneKey(profileId)) === "1";
  if (!alreadyImported) {
    const legacyIndex = readLegacyLocalStorageIndex(profileId);
    const entries = Object.entries(legacyIndex);
    if (entries.length > 0) {
      const normalized: Record<string, LocalMediaIndexEntry> = {};
      entries.forEach(([remoteUrl, entry]) => {
        if (!entry || typeof entry.relativePath !== "string") {
          return;
        }
        const normalizedRemoteUrl = entry.remoteUrl?.trim() || remoteUrl.trim();
        if (!normalizedRemoteUrl) {
          return;
        }
        normalized[normalizedRemoteUrl] = {
          ...entry,
          remoteUrl: normalizedRemoteUrl,
        };
      });
      await persistVaultMediaIndexSnapshotToSqlite(normalized, profileId);
      imported = Object.keys(normalized).length;
      localStorage.removeItem(getVaultMediaIndexLocalStorageKey(profileId));
    }
    localStorage.setItem(scopedImportDoneKey(profileId), "1");
    if (imported > 0) {
      logRuntimeEvent(
        "vault_media_index_sqlite.imported",
        "expected",
        [`[VaultMediaIndex] Imported ${imported} legacy localStorage vault index row(s) into SQLite.`],
      );
    }
  }

  await hydrateVaultMediaIndexCacheFromSqlite(profileId);
  return { imported, hydrated: true };
};

export const scheduleVaultUnlockMaintenance = (): void => {
  if (!hasNativeRuntime() || !isVaultWriteEncryptionReady()) {
    return;
  }
  void (async () => {
    await runVaultMediaIndexSqliteImportOnUnlock();
    const { scheduleVaultLegacyPlaintextMigrationOnUnlock } = await import("./vault-legacy-migration");
    scheduleVaultLegacyPlaintextMigrationOnUnlock();
  })().catch((error) => {
    logRuntimeEvent(
      "vault_unlock_maintenance.failed",
      "degraded",
      ["[VaultUnlockMaintenance] Failed after unlock:", error],
    );
  });
};
