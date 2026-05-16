import type { MessageDeleteTombstonePersistencePort } from "@dweb/storage-contracts/message-delete-tombstones";
import {
  emptyMessageDeleteTombstoneState,
  normalizeMessageDeleteTombstoneState,
} from "@dweb/storage-contracts/message-delete-tombstones";
import { IndexedDBService } from "./indexed-db-engine";

const STORE_NAME = "message_delete_tombstones";

type TombstoneRow = Readonly<{
  scopeKey: string;
  entries: ReadonlyArray<{ id: string; deletedAtUnixMs: number }>;
}>;

const parseRow = (raw: unknown, nowMs: number) => {
  if (!raw || typeof raw !== "object") {
    return emptyMessageDeleteTombstoneState();
  }
  const row = raw as Partial<TombstoneRow>;
  if (typeof row.scopeKey !== "string" || !Array.isArray(row.entries)) {
    return emptyMessageDeleteTombstoneState();
  }
  const entries = row.entries.filter((entry): entry is { id: string; deletedAtUnixMs: number } => (
    !!entry
    && typeof entry.id === "string"
    && typeof entry.deletedAtUnixMs === "number"
  ));
  return normalizeMessageDeleteTombstoneState({ entries }, nowMs);
};

const messageDeleteTombstonesDb = new IndexedDBService({
  name: "dweb_messenger_message_delete_tombstones",
  version: 1,
  stores: {
    message_delete_tombstones: "scopeKey",
  },
});

/**
 * IndexedDB-backed {@link MessageDeleteTombstonePersistencePort} using a dedicated DB
 * (not `messagingDB`) so app tests that mock `@dweb/storage/indexed-db` stay stable.
 */
export const createMessageDeleteTombstoneIndexedDbPersistence = (): MessageDeleteTombstonePersistencePort => ({
  async loadState({ scopeKey, nowMs }) {
    const raw = await messageDeleteTombstonesDb.get<TombstoneRow>(STORE_NAME, scopeKey);
    if (!raw) {
      return emptyMessageDeleteTombstoneState();
    }
    return parseRow(raw, nowMs);
  },

  async saveState({ scopeKey, state }) {
    const normalized = normalizeMessageDeleteTombstoneState(state, Date.now());
    await messageDeleteTombstonesDb.put(STORE_NAME, { scopeKey, entries: [...normalized.entries] });
  },

  async clearScope({ scopeKey }) {
    await messageDeleteTombstonesDb.delete(STORE_NAME, scopeKey);
  },
});
