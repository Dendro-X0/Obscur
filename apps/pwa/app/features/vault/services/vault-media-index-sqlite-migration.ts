"use client";

import { getScopedStorageKey } from "@/app/features/profiles/services/profile-scope";
import { resolveVaultProfileId } from "@/app/features/storage/services/vault-at-rest";
import { isVaultWriteEncryptionReady } from "@/app/features/storage/services/vault-at-rest";
import { logRuntimeEvent } from "@/app/shared/runtime-log-classification";
import {
  getVaultMediaIndexLocalStorageKey,
  hydrateVaultMediaIndexCacheFromSqlite,
  type LocalMediaIndexEntry,
} from "./local-media-store";
import {
  loadVaultMediaIndexMapFromSqlite,
  persistVaultMediaIndexSnapshotToSqlite,
  usesSqliteVaultMediaIndex,
} from "./vault-media-index-sqlite-store";

const SQLITE_IMPORT_DONE_KEY = "obscur.vault.media_index_sqlite_imported";

const scopedImportDoneKey = (profileId: string): string =>
  getScopedStorageKey(SQLITE_IMPORT_DONE_KEY, profileId);

export const readLegacyLocalStorageVaultIndex = (profileId: string): Record<string, LocalMediaIndexEntry> => {
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
  if (!usesSqliteVaultMediaIndex()) {
    return { imported: 0, hydrated: false };
  }
  const profileId = resolveVaultProfileId().trim();
  if (!profileId) {
    return { imported: 0, hydrated: false };
  }

  let imported = 0;
  const alreadyImported = localStorage.getItem(scopedImportDoneKey(profileId)) === "1";
  if (!alreadyImported && isVaultWriteEncryptionReady(profileId)) {
    const legacyIndex = readLegacyLocalStorageVaultIndex(profileId);
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

  const hydrated = await hydrateVaultMediaIndexCacheFromSqlite(profileId);
  if (!hydrated) {
    return { imported, hydrated: false };
  }

  const sqliteIndex = await loadVaultMediaIndexMapFromSqlite(profileId);
  if (Object.keys(sqliteIndex).length === 0 && isVaultWriteEncryptionReady(profileId)) {
    const legacyRecoveryIndex = readLegacyLocalStorageVaultIndex(profileId);
    const recoveryEntries = Object.entries(legacyRecoveryIndex);
    if (recoveryEntries.length > 0) {
      const normalized: Record<string, LocalMediaIndexEntry> = {};
      recoveryEntries.forEach(([remoteUrl, entry]) => {
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
      await hydrateVaultMediaIndexCacheFromSqlite(profileId);
      logRuntimeEvent(
        "vault_media_index_sqlite.recovered_legacy",
        "expected",
        [`[VaultMediaIndex] Recovered ${Object.keys(normalized).length} legacy localStorage row(s) into SQLite.`],
      );
    }
  }

  return { imported, hydrated: true };
};

/**
 * R5: retired vault-catalog unlock maintenance (SQLite index import, layout /
 * plaintext migrations, disk inventory reconcile as Vault catalog owners).
 * LES owns encrypted catalog after unlock; PDK restore stays in storage-at-rest.
 */
export const scheduleVaultUnlockMaintenance = (): void => {
  // no-op
};
