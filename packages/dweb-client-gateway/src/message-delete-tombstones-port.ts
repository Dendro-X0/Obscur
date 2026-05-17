import type { MessageDeleteTombstoneEntry } from "@dweb/storage-contracts/message-delete-tombstones";

/**
 * Local suppression of DM rows (delete-for-me). One port — Web IndexedDB + native SQLite
 * adapters implement behind `ProfileRuntimeProvider` / `ClientGateway`.
 */
export type MessageDeleteTombstonesPersistencePort = Readonly<{
  suppressMessageDeleteTombstone: (
    messageId: string | null | undefined,
    deletedAtUnixMs?: number,
    profileId?: string,
  ) => void;
  loadMessageDeleteTombstoneEntries: (
    nowMs?: number,
    profileId?: string,
  ) => ReadonlyArray<MessageDeleteTombstoneEntry>;
  loadSuppressedMessageDeleteIds: (
    nowMs?: number,
    profileId?: string,
  ) => ReadonlySet<string>;
  replaceMessageDeleteTombstones: (
    entries: ReadonlyArray<MessageDeleteTombstoneEntry>,
    nowMs?: number,
    profileId?: string,
  ) => Promise<void>;
  isMessageDeleteSuppressed: (
    messageId: string | null | undefined,
    nowMs?: number,
    profileId?: string,
  ) => boolean;
  clearMessageDeleteTombstones: (profileId?: string) => void;
  liftMessageDeleteSuppression: (
    messageIds: ReadonlyArray<string>,
    profileId?: string,
  ) => void;
  mergeMessageDeleteTombstonesFromIndexedDb: (profileId?: string) => Promise<void>;
  hydrateMessageDeleteTombstonesFromSqlite: (profileId?: string) => Promise<void>;
}>;
