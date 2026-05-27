import { messageDbName } from "./message-db-name";
import { messageDbVersion } from "./message-db-version";
import { openInMemoryIdb } from "@/app/features/storage/in-memory-idb-shim";

/**
 * Message DB — in-memory only (IndexedDB permanently excluded).
 */
export const openMessageDb = (): Promise<IDBDatabase> => (
    openInMemoryIdb(messageDbName, messageDbVersion, {
        stores: [
            { name: "messages", keyPath: "id", indexes: [{ name: "conversationId", keyPath: "conversationId", unique: false }] },
            { name: "conversations", keyPath: "id" },
            { name: "queue", keyPath: "id", indexes: [{ name: "nextRetryAt", keyPath: "nextRetryAt", unique: false }] },
        ],
    })
);
