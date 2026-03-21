const DB_NAME = "obscur-room-keys";
const DB_VERSION = 1;
const STORE_NAME = "keys";

export interface RoomKeyRecord {
    groupId: string;
    roomKeyHex: string;
    previousKeys?: string[];
    createdAt: number;
}

const uniqueNonEmptyKeys = (values: ReadonlyArray<string>): string[] => (
    Array.from(new Set(values.filter((value) => typeof value === "string" && value.trim().length > 0)))
);

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

    async listRoomKeyRecords(): Promise<ReadonlyArray<RoomKeyRecord>> {
        const db = await this.getDb();
        return new Promise((resolve, reject) => {
            const tx = db.transaction(STORE_NAME, "readonly");
            const store = tx.objectStore(STORE_NAME);
            const request = store.getAll();

            request.onsuccess = () => {
                const records = (Array.isArray(request.result) ? request.result : []) as RoomKeyRecord[];
                records.forEach((record) => {
                    if (record?.groupId && record?.roomKeyHex) {
                        this.cache.set(record.groupId, record.roomKeyHex);
                    }
                });
                resolve(records);
            };
            request.onerror = () => reject(request.error);
        });
    }

    async upsertRoomKeyRecord(incoming: RoomKeyRecord): Promise<void> {
        if (!incoming.groupId || !incoming.roomKeyHex) {
            return;
        }
        const normalizedIncoming: RoomKeyRecord = {
            groupId: incoming.groupId,
            roomKeyHex: incoming.roomKeyHex,
            previousKeys: uniqueNonEmptyKeys(incoming.previousKeys ?? []).filter((key) => key !== incoming.roomKeyHex),
            createdAt: Number.isFinite(incoming.createdAt) && incoming.createdAt > 0
                ? incoming.createdAt
                : Date.now(),
        };
        this.cache.set(normalizedIncoming.groupId, normalizedIncoming.roomKeyHex);

        const db = await this.getDb();
        return new Promise((resolve, reject) => {
            const tx = db.transaction(STORE_NAME, "readwrite");
            const store = tx.objectStore(STORE_NAME);

            const getReq = store.get(normalizedIncoming.groupId);
            getReq.onsuccess = () => {
                const existing = getReq.result as RoomKeyRecord | undefined;
                if (!existing) {
                    const putReq = store.put(normalizedIncoming);
                    putReq.onsuccess = () => resolve();
                    putReq.onerror = () => reject(putReq.error);
                    return;
                }

                const incomingWins = normalizedIncoming.createdAt >= (existing.createdAt || 0);
                const latest = incomingWins ? normalizedIncoming : existing;
                const older = incomingWins ? existing : normalizedIncoming;
                const mergedPrevious = uniqueNonEmptyKeys([
                    ...(latest.previousKeys ?? []),
                    ...(older.previousKeys ?? []),
                    older.roomKeyHex,
                ]).filter((key) => key !== latest.roomKeyHex);

                const mergedRecord: RoomKeyRecord = {
                    groupId: latest.groupId,
                    roomKeyHex: latest.roomKeyHex,
                    createdAt: Number.isFinite(latest.createdAt) && latest.createdAt > 0
                        ? latest.createdAt
                        : Date.now(),
                    ...(mergedPrevious.length > 0 ? { previousKeys: mergedPrevious } : {}),
                };

                const putReq = store.put(mergedRecord);
                putReq.onsuccess = () => resolve();
                putReq.onerror = () => reject(putReq.error);
            };
            getReq.onerror = () => reject(getReq.error);
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
