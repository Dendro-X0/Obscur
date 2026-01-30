import { messageDbName } from "./message-db-name";
import { messageDbVersion } from "./message-db-version";

/**
 * Message storage stores:
 * 1. messages: All direct messages (Kind 4 / Kind 14 rumors)
 * 2. conversations: Indexing of conversation metadata
 * 3. queue: Outgoing messages waiting for relay acknowledgment
 */
export const openMessageDb = (): Promise<IDBDatabase> => {
    return new Promise((resolve, reject) => {
        const request: IDBOpenDBRequest = indexedDB.open(messageDbName, messageDbVersion);

        request.onupgradeneeded = () => {
            const db: IDBDatabase = request.result;

            // Store for all messages
            // Key: id (nostr event id or internal uuid)
            if (!db.objectStoreNames.contains("messages")) {
                const messageStore = db.createObjectStore("messages", { keyPath: "id" });
                messageStore.createIndex("conversationId", "conversationId", { unique: false });
                messageStore.createIndex("timestamp", "timestamp", { unique: false });
            }

            // Store for conversation metadata
            // Key: conversationId (sorted pair of pubkeys)
            if (!db.objectStoreNames.contains("conversations")) {
                db.createObjectStore("conversations", { keyPath: "id" });
            }

            // Store for outgoing queue
            // Key: id
            if (!db.objectStoreNames.contains("queue")) {
                const queueStore = db.createObjectStore("queue", { keyPath: "id" });
                queueStore.createIndex("nextRetryAt", "nextRetryAt", { unique: false });
            }
        };

        request.onsuccess = () => {
            resolve(request.result);
        };

        request.onerror = () => {
            reject(request.error ?? new Error("Failed to open Message IndexedDB"));
        };
    });
};
