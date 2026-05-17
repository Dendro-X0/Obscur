
/**
 * IndexedDB Service for High-Performance Storage
 * 
 * Provides an asynchronous key-value and object store using IndexedDB.
 * Designed to handle large datasets like chat messages and conversation history
 * without blocking the main UI thread.
 */

export interface DBConfig {
    name: string;
    version: number;
    stores: Record<string, string>; // name: keyPath or index
}

const DEFAULT_DB_NAME = "dweb_messenger_db";
const DEFAULT_VERSION = 1;

export class IndexedDBService {
    private db: IDBDatabase | null = null;
    private dbName: string;
    private version: number;
    private stores: Record<string, string>;

    constructor(config: DBConfig) {
        this.dbName = config.name;
        this.version = config.version;
        this.stores = config.stores;
    }

    public async ensureDB(): Promise<IDBDatabase> {
        if (this.db) return this.db;

        return new Promise((resolve, reject) => {
            const request = indexedDB.open(this.dbName, this.version);

            request.onupgradeneeded = (event) => {
                const db = (event.target as IDBOpenDBRequest).result;
                Object.entries(this.stores).forEach(([storeName, keyPath]) => {
                    if (!db.objectStoreNames.contains(storeName)) {
                        const store = db.createObjectStore(storeName, { keyPath });
                        // Add index for common queries if needed
                        if (storeName === "messages") {
                            store.createIndex("conversationId", "conversationId", { unique: false });
                            store.createIndex("timestampMs", "timestampMs", { unique: false });
                            store.createIndex("conversation_timestamp", ["conversationId", "timestampMs"], { unique: false });
                        }
                    }
                });
            };

            request.onsuccess = () => {
                this.db = request.result;
                resolve(this.db);
            };

            request.onerror = () => reject(request.error);
        });
    }

    async get<T>(storeName: string, key: string): Promise<T | null> {
        const db = await this.ensureDB();
        return new Promise((resolve, reject) => {
            const transaction = db.transaction(storeName, "readonly");
            const store = transaction.objectStore(storeName);
            const request = store.get(key);

            request.onsuccess = () => resolve(request.result || null);
            request.onerror = () => reject(request.error);
        });
    }

    async getAll<T>(storeName: string, indexName?: string, query?: IDBKeyRange): Promise<T[]> {
        const db = await this.ensureDB();
        return new Promise((resolve, reject) => {
            const transaction = db.transaction(storeName, "readonly");
            const store = transaction.objectStore(storeName);
            const source = indexName ? store.index(indexName) : store;
            const request = source.getAll(query);

            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
    }

    /**
     * Specialized retrieval using an index, optionally with a limit and direction.
     */
    async getAllByIndex<T>(
        storeName: string,
        indexName: string,
        query?: IDBKeyRange | any,
        limit?: number,
        direction: IDBCursorDirection = "next"
    ): Promise<T[]> {
        const db = await this.ensureDB();
        return new Promise((resolve, reject) => {
            const transaction = db.transaction(storeName, "readonly");
            const store = transaction.objectStore(storeName);
            const index = store.index(indexName);
            const request = index.openCursor(query, direction);

            const result: T[] = [];
            request.onsuccess = (event) => {
                const cursor = (event.target as IDBRequest<IDBCursorWithValue>).result;
                if (cursor) {
                    result.push(cursor.value);
                    if (limit && result.length >= limit) {
                        resolve(result);
                    } else {
                        cursor.continue();
                    }
                } else {
                    resolve(result);
                }
            };
            request.onerror = () => reject(request.error);
        });
    }

    async put<T>(storeName: string, value: T): Promise<void> {
        const db = await this.ensureDB();
        return new Promise((resolve, reject) => {
            const transaction = db.transaction(storeName, "readwrite");
            const store = transaction.objectStore(storeName);
            const request = store.put(value);

            request.onsuccess = () => resolve();
            request.onerror = () => reject(request.error);
        });
    }

    async bulkPut<T>(storeName: string, values: T[]): Promise<void> {
        const db = await this.ensureDB();
        return new Promise((resolve, reject) => {
            const transaction = db.transaction(storeName, "readwrite");
            const store = transaction.objectStore(storeName);

            let completed = 0;
            let errorOccurred = false;

            if (values.length === 0) {
                resolve();
                return;
            }

            values.forEach(value => {
                const request = store.put(value);
                request.onsuccess = () => {
                    completed++;
                    if (completed === values.length) resolve();
                };
                request.onerror = () => {
                    if (!errorOccurred) {
                        errorOccurred = true;
                        reject(request.error);
                    }
                };
            });
        });
    }

    async bulkDelete(storeName: string, keys: ReadonlyArray<string>): Promise<void> {
        const db = await this.ensureDB();
        return new Promise((resolve, reject) => {
            if (keys.length === 0) {
                resolve();
                return;
            }

            const transaction = db.transaction(storeName, "readwrite");
            const store = transaction.objectStore(storeName);

            transaction.oncomplete = () => resolve();
            transaction.onerror = () => reject(transaction.error);
            transaction.onabort = () => reject(transaction.error ?? new Error("IndexedDB bulkDelete transaction aborted"));

            keys.forEach((key) => {
                store.delete(key);
            });
        });
    }

    async getRange<T>(
        storeName: string,
        indexName: string,
        lowerBound: any,
        upperBound: any,
        limit?: number,
        direction: IDBCursorDirection = "next"
    ): Promise<T[]> {
        const db = await this.ensureDB();
        return new Promise((resolve, reject) => {
            const transaction = db.transaction(storeName, "readonly");
            const store = transaction.objectStore(storeName);
            const index = store.index(indexName);
            const range = IDBKeyRange.bound(lowerBound, upperBound);
            const request = index.openCursor(range, direction);

            const result: T[] = [];
            request.onsuccess = (event) => {
                const cursor = (event.target as IDBRequest<IDBCursorWithValue>).result;
                if (cursor) {
                    result.push(cursor.value);
                    if (limit && result.length >= limit) {
                        resolve(result);
                    } else {
                        cursor.continue();
                    }
                } else {
                    resolve(result);
                }
            };
            request.onerror = () => reject(request.error);
        });
    }

    async delete(storeName: string, key: string): Promise<void> {
        const db = await this.ensureDB();
        return new Promise((resolve, reject) => {
            const transaction = db.transaction(storeName, "readwrite");
            const store = transaction.objectStore(storeName);
            const request = store.delete(key);

            request.onsuccess = () => resolve();
            request.onerror = () => reject(request.error);
        });
    }

    async clear(storeName: string): Promise<void> {
        const db = await this.ensureDB();
        return new Promise((resolve, reject) => {
            const transaction = db.transaction(storeName, "readwrite");
            const store = transaction.objectStore(storeName);
            const request = store.clear();

            request.onsuccess = () => resolve();
            request.onerror = () => reject(request.error);
        });
    }

    async deleteByRange(storeName: string, indexName: string, query: IDBKeyRange): Promise<void> {
        const db = await this.ensureDB();
        return new Promise((resolve, reject) => {
            const transaction = db.transaction(storeName, "readwrite");
            const store = transaction.objectStore(storeName);
            const index = store.index(indexName);
            const request = index.openCursor(query);

            request.onsuccess = (event) => {
                const cursor = (event.target as IDBRequest<IDBCursor>).result;
                if (cursor) {
                    cursor.delete();
                    cursor.continue();
                } else {
                    resolve();
                }
            };
            request.onerror = () => reject(request.error);
        });
    }
}

export const messagingDB = new IndexedDBService({
    name: DEFAULT_DB_NAME,
    version: DEFAULT_VERSION,
    stores: {
        chatState: "publicKeyHex",
        messages: "id", // Combined ID for messages
        conversations: "id",
    }
});
