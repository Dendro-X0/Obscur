import { messageDbName } from "./message-db-name";
import { messageDbVersion } from "./message-db-version";
import { openInMemoryIdb } from "@/app/features/storage/in-memory-idb-shim";
import { requiresSqlitePersistence } from "@/app/features/runtime/native-persistence-policy";

/**
 * Message DB — browser degraded in-memory shim only (IndexedDB permanently excluded).
 * Cut 1.2: native SQLite owns message durability — refuse to open on Tauri.
 */
export const openMessageDb = (): Promise<IDBDatabase> => {
  if (requiresSqlitePersistence()) {
    return Promise.reject(
      new Error("openMessageDb refused: native SQLite owns message durability (Cut 1.2 K-MSG-DUR)"),
    );
  }
  return openInMemoryIdb(messageDbName, messageDbVersion, {
    stores: [
      { name: "messages", keyPath: "id", indexes: [{ name: "conversationId", keyPath: "conversationId", unique: false }] },
      { name: "conversations", keyPath: "id" },
      { name: "queue", keyPath: "id", indexes: [{ name: "nextRetryAt", keyPath: "nextRetryAt", unique: false }] },
    ],
  });
};
