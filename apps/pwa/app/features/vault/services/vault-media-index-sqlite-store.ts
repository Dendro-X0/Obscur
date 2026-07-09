import {
  dbDeleteAllVaultMediaIndexForProfile,
  dbDeleteVaultMediaIndex,
  dbGetVaultMediaIndexForProfile,
  dbUpsertVaultMediaIndex,
  isTauri,
  type VaultMediaIndexRecord,
} from "@dweb/db";
import { requiresSqlitePersistence } from "@/app/features/runtime/native-persistence-policy";
import type { LocalMediaIndexEntry } from "./vault-media-index-contract";

export const usesSqliteVaultMediaIndex = (): boolean =>
  requiresSqlitePersistence() && isTauri();

export const mapVaultMediaIndexRecordToEntry = (
  record: VaultMediaIndexRecord,
): LocalMediaIndexEntry => ({
  remoteUrl: record.remote_url,
  relativePath: record.relative_path,
  savedAtUnixMs: record.saved_at_unix_ms,
  fileName: record.file_name,
  contentType: record.content_type,
  size: record.size_bytes,
  ...(record.message_event_id?.trim()
    ? { messageEventId: record.message_event_id.trim() }
    : {}),
  ...(record.explicit_chat_save ? { explicitChatSave: true } : {}),
});

export const mapLocalMediaIndexEntryToRecord = (
  remoteUrl: string,
  entry: LocalMediaIndexEntry,
  profileId: string,
): VaultMediaIndexRecord => ({
  remote_url: remoteUrl,
  profile_id: profileId,
  relative_path: entry.relativePath,
  saved_at_unix_ms: entry.savedAtUnixMs,
  file_name: entry.fileName,
  content_type: entry.contentType,
  size_bytes: entry.size,
  message_event_id: entry.messageEventId?.trim() || null,
  explicit_chat_save: entry.explicitChatSave === true,
});

export const loadVaultMediaIndexMapFromSqlite = async (
  profileId: string,
): Promise<Record<string, LocalMediaIndexEntry>> => {
  if (!usesSqliteVaultMediaIndex() || !profileId.trim()) {
    return {};
  }
  const records = await dbGetVaultMediaIndexForProfile(profileId.trim());
  const index: Record<string, LocalMediaIndexEntry> = {};
  records.forEach((record) => {
    const entry = mapVaultMediaIndexRecordToEntry(record);
    index[entry.remoteUrl] = entry;
  });
  return index;
};

export const upsertVaultMediaIndexEntryToSqlite = async (
  remoteUrl: string,
  entry: LocalMediaIndexEntry,
  profileId: string,
): Promise<void> => {
  if (!usesSqliteVaultMediaIndex()) {
    return;
  }
  await dbUpsertVaultMediaIndex(mapLocalMediaIndexEntryToRecord(remoteUrl, entry, profileId));
};

export const deleteVaultMediaIndexEntryFromSqlite = async (
  remoteUrl: string,
  profileId: string,
): Promise<void> => {
  if (!usesSqliteVaultMediaIndex()) {
    return;
  }
  await dbDeleteVaultMediaIndex(profileId, remoteUrl);
};

export const deleteAllVaultMediaIndexEntriesFromSqlite = async (
  profileId: string,
): Promise<void> => {
  if (!usesSqliteVaultMediaIndex()) {
    return;
  }
  await dbDeleteAllVaultMediaIndexForProfile(profileId);
};

export const persistVaultMediaIndexSnapshotToSqlite = async (
  index: Readonly<Record<string, LocalMediaIndexEntry>>,
  profileId: string,
): Promise<void> => {
  if (!usesSqliteVaultMediaIndex()) {
    return;
  }
  await Promise.all(
    Object.entries(index).map(([remoteUrl, entry]) =>
      upsertVaultMediaIndexEntryToSqlite(remoteUrl, entry, profileId).catch(() => undefined),
    ),
  );
};
