const DB_NAME = "obscur-room-keys";
const DB_VERSION = 1;
const STORE_NAME = "keys";

export interface RoomKeyRecord {
    groupId: string;
    roomKeyHex: string;
    previousKeys?: string[];
    createdAt: number;
}

const openDb = (): Promise<IDBDatabase> => {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open(DB_NAME, DB_VERSION);

        request.onupgradeneeded = () => {
            const db = request.result;
            if (!db.objectStoreNames.contains(STORE_NAME)) {
                db.createObjectStore(STORE_NAME, { keyPath: "groupId" });
            }
        };

        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error ?? new Error("Failed to open Room Key DB"));
    });
};

export class RoomKeyStore {
    private cache = new Map<string, string>();
    private dbPromise: Promise<IDBDatabase> | null = null;

    private getDb(): Promise<IDBDatabase> {
        if (!this.dbPromise) {
            this.dbPromise = openDb();
        }
        return this.dbPromise;
    }

    async saveRoomKey(groupId: string, roomKeyHex: string): Promise<void> {
        this.cache.set(groupId, roomKeyHex);

        const db = await this.getDb();
        return new Promise((resolve, reject) => {
            const tx = db.transaction(STORE_NAME, "readwrite");
            const store = tx.objectStore(STORE_NAME);

            // Fetch existing to preserve history if it exists
            const getReq = store.get(groupId);
            getReq.onsuccess = () => {
                const existing = getReq.result as RoomKeyRecord | undefined;
                const record: RoomKeyRecord = {
                    groupId,
                    roomKeyHex,
                    previousKeys: existing?.previousKeys || [],
                    createdAt: existing?.createdAt || Date.now()
                };

                const request = store.put(record);
                request.onsuccess = () => resolve();
                request.onerror = () => reject(request.error);
            };
            getReq.onerror = () => reject(getReq.error);
        });
    }

    async rotateRoomKey(groupId: string, newKeyHex: string): Promise<void> {
        this.cache.set(groupId, newKeyHex);

        const db = await this.getDb();
        return new Promise((resolve, reject) => {
            const tx = db.transaction(STORE_NAME, "readwrite");
            const store = tx.objectStore(STORE_NAME);

            const getReq = store.get(groupId);
            getReq.onsuccess = () => {
                const existing = getReq.result as RoomKeyRecord | undefined;
                if (!existing) {
                    reject(new Error("Cannot rotate non-existent key"));
                    return;
                }

                const previousKeys = existing.previousKeys || [];
                // Add current key to history if it's not already there
                if (!previousKeys.includes(existing.roomKeyHex)) {
                    previousKeys.push(existing.roomKeyHex);
                }

                const record: RoomKeyRecord = {
                    groupId,
                    roomKeyHex: newKeyHex,
                    previousKeys,
                    createdAt: Date.now()
                };

                const request = store.put(record);
                request.onsuccess = () => resolve();
                request.onerror = () => reject(request.error);
            };
            getReq.onerror = () => reject(getReq.error);
        });
    }

    async getRoomKeyRecord(groupId: string): Promise<RoomKeyRecord | null> {
        const db = await this.getDb();
        return new Promise((resolve, reject) => {
            const tx = db.transaction(STORE_NAME, "readonly");
            const store = tx.objectStore(STORE_NAME);
            const request = store.get(groupId);

            request.onsuccess = () => {
                const record = request.result as RoomKeyRecord | undefined;
                if (record) {
                    this.cache.set(groupId, record.roomKeyHex);
                    resolve(record);
                } else {
                    resolve(null);
                }
            };
            request.onerror = () => reject(request.error);
        });
    }

    async getRoomKey(groupId: string): Promise<string | null> {
        if (this.cache.has(groupId)) {
            return this.cache.get(groupId) || null;
        }

        const db = await this.getDb();
        return new Promise((resolve, reject) => {
            const tx = db.transaction(STORE_NAME, "readonly");
            const store = tx.objectStore(STORE_NAME);
            const request = store.get(groupId);

            request.onsuccess = () => {
                const record = request.result as RoomKeyRecord | undefined;
                if (record) {
                    this.cache.set(groupId, record.roomKeyHex);
                    resolve(record.roomKeyHex);
                } else {
                    resolve(null);
                }
            };
            request.onerror = () => reject(request.error);
        });
    }

    async deleteRoomKey(groupId: string): Promise<void> {
        this.cache.delete(groupId);

        const db = await this.getDb();
        return new Promise((resolve, reject) => {
            const tx = db.transaction(STORE_NAME, "readwrite");
            const store = tx.objectStore(STORE_NAME);
            const request = store.delete(groupId);

            request.onsuccess = () => resolve();
            request.onerror = () => reject(request.error);
        });
    }

    async clearAll(): Promise<void> {
        this.cache.clear();

        const db = await this.getDb();
        return new Promise((resolve, reject) => {
            const tx = db.transaction(STORE_NAME, "readwrite");
            const store = tx.objectStore(STORE_NAME);
            const request = store.clear();

            request.onsuccess = () => resolve();
            request.onerror = () => reject(request.error);
        });
    }
}

export const roomKeyStore = new RoomKeyStore();
