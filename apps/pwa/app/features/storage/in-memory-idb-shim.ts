/**
 * Minimal in-memory IDB shim — replaces `indexedDB.open` for legacy call sites.
 * Browser IndexedDB is permanently excluded; data is session-scoped only.
 */

type IdbRequest<T> = {
    result: T;
    error: DOMException | null;
    onsuccess: ((event: Event) => void) | null;
    onerror: ((event: Event) => void) | null;
};

type IdbEventTarget = {
    result: unknown;
    error: DOMException | null;
};

const createRequest = <T>(result: T): IdbRequest<T> => {
    const request: IdbRequest<T> = {
        result,
        error: null,
        onsuccess: null,
        onerror: null,
    };
    queueMicrotask(() => {
        request.onsuccess?.({ target: request } as unknown as Event);
    });
    return request;
};

type MemoryIndex = {
    name: string;
    keyPath: string | string[];
    unique: boolean;
};

class MemoryObjectStoreShim {
    private readonly rows = new Map<string, unknown>();

    constructor(
        public readonly name: string,
        private readonly keyPath: string | null,
        private readonly indexes: MemoryIndex[],
    ) {}

    private keyFor(value: Record<string, unknown>): string {
        if (!this.keyPath) {
            throw new Error(`Store ${this.name} requires an explicit key for put/get`);
        }
        const raw = value[this.keyPath];
        return String(raw ?? "");
    }

    private indexValue(value: Record<string, unknown>, index: MemoryIndex): string {
        if (typeof index.keyPath === "string") {
            return String(value[index.keyPath] ?? "");
        }
        return index.keyPath.map((part) => String(value[part] ?? "")).join("\0");
    }

    add(value: Record<string, unknown>): IdbRequest<void> {
        const key = this.keyFor(value);
        if (this.rows.has(key)) {
            const request = createRequest<void>(undefined);
            request.error = new DOMException("Key already exists", "ConstraintError");
            queueMicrotask(() => request.onerror?.({ target: request } as unknown as Event));
            return request;
        }
        this.rows.set(key, value);
        return createRequest(undefined);
    }

    put(value: Record<string, unknown>, explicitKey?: IDBValidKey): IdbRequest<void> {
        const key = explicitKey !== undefined
            ? String(explicitKey)
            : this.keyFor(value);
        this.rows.set(key, value);
        return createRequest(undefined);
    }

    get(key: IDBValidKey): IdbRequest<unknown> {
        return createRequest(this.rows.get(String(key)) ?? undefined);
    }

    delete(key: string): IdbRequest<void> {
        this.rows.delete(key);
        return createRequest(undefined);
    }

    getAll(query?: string): IdbRequest<unknown[]> {
        let rows = [...this.rows.values()];
        if (typeof query === "string") {
            const index = this.indexes[0];
            if (index) {
                rows = rows.filter((row) => {
                    if (!row || typeof row !== "object") {
                        return false;
                    }
                    return this.indexValue(row as Record<string, unknown>, index) === query;
                });
            }
        }
        return createRequest(rows);
    }

    index(indexName: string): { getAll: (query?: string) => IdbRequest<unknown[]> } {
        const indexDef = this.indexes.find((entry) => entry.name === indexName);
        return {
            getAll: (query?: string) => {
                let rows = [...this.rows.values()];
                if (indexDef) {
                    rows = rows.filter((row) => {
                        if (!row || typeof row !== "object") {
                            return false;
                        }
                        if (typeof query === "undefined") {
                            return true;
                        }
                        return this.indexValue(row as Record<string, unknown>, indexDef) === query;
                    });
                }
                return createRequest(rows);
            },
        };
    }

    openCursor(): IdbRequest<null> {
        return createRequest(null);
    }
}

class MemoryTransactionShim {
    oncomplete: (() => void) | null = null;
    onerror: (() => void) | null = null;
    error: DOMException | null = null;

    constructor(
        private readonly stores: Map<string, MemoryObjectStoreShim>,
        storeNames: string | string[],
    ) {
        const names = Array.isArray(storeNames) ? storeNames : [storeNames];
        void names;
        queueMicrotask(() => this.oncomplete?.());
    }

    objectStore(name: string): MemoryObjectStoreShim {
        const store = this.stores.get(name);
        if (!store) {
            throw new Error(`Unknown object store: ${name}`);
        }
        return store;
    }
}

export type InMemoryIdbSchema = Readonly<{
    stores: ReadonlyArray<Readonly<{
        name: string;
        keyPath: string | null;
        indexes?: ReadonlyArray<MemoryIndex>;
    }>>;
}>;

const databases = new Map<string, Map<string, MemoryObjectStoreShim>>();

const getOrCreateDatabase = (dbName: string, schema: InMemoryIdbSchema): Map<string, MemoryObjectStoreShim> => {
    const existing = databases.get(dbName);
    if (existing) {
        return existing;
    }
    const stores = new Map<string, MemoryObjectStoreShim>();
    schema.stores.forEach((storeDef) => {
        stores.set(
            storeDef.name,
            new MemoryObjectStoreShim(storeDef.name, storeDef.keyPath, [...(storeDef.indexes ?? [])]),
        );
    });
    databases.set(dbName, stores);
    return stores;
};

export const openInMemoryIdb = (
    dbName: string,
    _version: number,
    schema: InMemoryIdbSchema,
): Promise<IDBDatabase> => {
    const stores = getOrCreateDatabase(dbName, schema);
    const db = {
        objectStoreNames: {
            contains: (name: string) => stores.has(name),
        },
        close: () => undefined,
        transaction: (storeNames: string | string[], _mode?: IDBTransactionMode) => {
            return new MemoryTransactionShim(stores, storeNames) as unknown as IDBTransaction;
        },
    };
    return Promise.resolve(db as unknown as IDBDatabase);
};

export const clearInMemoryIdb = (dbName?: string): void => {
    if (dbName) {
        databases.delete(dbName);
        return;
    }
    databases.clear();
};
