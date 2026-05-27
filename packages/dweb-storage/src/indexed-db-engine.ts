/**
 * In-memory storage engine. Browser IndexedDB is permanently excluded (greenfield policy).
 * @see apps/pwa/app/features/runtime/persistence-policy.ts
 */

export interface DBConfig {
    name: string;
    version: number;
    stores: Record<string, string>;
}

type Row = Record<string, unknown>;

const toKey = (value: Row, keyPath: string): string => String(value[keyPath] ?? "");

const compareCompound = (
    left: readonly [string, number],
    right: readonly [string, number],
): number => {
    if (left[0] !== right[0]) {
        return left[0] < right[0] ? -1 : 1;
    }
    return left[1] - right[1];
};

const rowMatchesConversationTimestampRange = (
    row: Row,
    query: IDBKeyRange | undefined,
): boolean => {
    if (!query) {
        return true;
    }
    const conversationId = String(row.conversationId ?? "");
    const timestampMs = typeof row.timestampMs === "number"
        ? row.timestampMs
        : typeof row.timestamp === "number"
            ? row.timestamp
            : 0;
    const key: readonly [string, number] = [conversationId, timestampMs];
    const lower = query.lower as readonly [string, number] | undefined;
    const upper = query.upper as readonly [string, number] | undefined;
    if (lower && compareCompound(key, lower) < 0) {
        return false;
    }
    if (upper && compareCompound(key, upper) > 0) {
        return false;
    }
    return true;
};

class MemoryObjectStore {
    private readonly rows = new Map<string, Row>();

    constructor(private readonly keyPath: string) {}

    put(value: Row): void {
        this.rows.set(toKey(value, this.keyPath), value);
    }

    get(key: string): Row | undefined {
        return this.rows.get(key);
    }

    delete(key: string): void {
        this.rows.delete(key);
    }

    clear(): void {
        this.rows.clear();
    }

    getAll(): Row[] {
        return [...this.rows.values()];
    }

    bulkPut(values: readonly Row[]): void {
        values.forEach((value) => this.put(value));
    }

    bulkDelete(keys: readonly string[]): void {
        keys.forEach((key) => this.delete(key));
    }

    getAllByIndex(
        indexName: string,
        query?: IDBKeyRange | string,
        limit?: number,
        direction: IDBCursorDirection = "next",
    ): Row[] {
        let rows = this.getAll();
        if (indexName === "conversationId" && typeof query === "string") {
            rows = rows.filter((row) => String(row.conversationId ?? "") === query);
        } else if (indexName === "conversation_timestamp") {
            rows = rows.filter((row) => rowMatchesConversationTimestampRange(row, query as IDBKeyRange | undefined));
            rows.sort((a, b) => {
                const aTs = typeof a.timestampMs === "number" ? a.timestampMs : 0;
                const bTs = typeof b.timestampMs === "number" ? b.timestampMs : 0;
                return aTs - bTs;
            });
            if (direction === "prev") {
                rows.reverse();
            }
        } else if (indexName === "timestampMs") {
            rows.sort((a, b) => {
                const aTs = typeof a.timestampMs === "number" ? a.timestampMs : 0;
                const bTs = typeof b.timestampMs === "number" ? b.timestampMs : 0;
                return direction === "prev" ? bTs - aTs : aTs - bTs;
            });
        }
        if (typeof limit === "number" && limit > 0) {
            return rows.slice(0, limit);
        }
        return rows;
    }

    async forEach(
        visitor: (value: Row, visitIndex: number) => boolean | void | Promise<boolean | void>,
        options?: Readonly<{
            indexName?: string;
            query?: IDBKeyRange;
            direction?: IDBCursorDirection;
            yieldEvery?: number;
        }>,
    ): Promise<number> {
        let rows = this.getAll();
        if (options?.indexName === "conversation_timestamp" && options.query) {
            rows = rows.filter((row) => rowMatchesConversationTimestampRange(row, options.query));
        }
        if (options?.indexName === "timestampMs") {
            rows.sort((a, b) => {
                const aTs = typeof a.timestampMs === "number" ? a.timestampMs : 0;
                const bTs = typeof b.timestampMs === "number" ? b.timestampMs : 0;
                return options?.direction === "prev" ? bTs - aTs : aTs - bTs;
            });
        }
        let visitIndex = 0;
        for (const row of rows) {
            const shouldStop = await visitor(row, visitIndex);
            visitIndex += 1;
            if (shouldStop === false) {
                break;
            }
            if (options?.yieldEvery && options.yieldEvery > 0 && visitIndex % options.yieldEvery === 0) {
                await new Promise((resolve) => setTimeout(resolve, 0));
            }
        }
        return visitIndex;
    }

    deleteByConversationTimestampRange(conversationId: string, upperTimestampMs: number): void {
        const toDelete: string[] = [];
        for (const row of this.getAll()) {
            if (String(row.conversationId ?? "") !== conversationId) {
                continue;
            }
            const timestampMs = typeof row.timestampMs === "number" ? row.timestampMs : 0;
            if (timestampMs <= upperTimestampMs) {
                toDelete.push(toKey(row, this.keyPath));
            }
        }
        toDelete.forEach((key) => this.delete(key));
    }
}

export class IndexedDBService {
    private readonly storeByName = new Map<string, MemoryObjectStore>();

    constructor(config: DBConfig) {
        Object.entries(config.stores).forEach(([storeName, keyPath]) => {
            this.storeByName.set(storeName, new MemoryObjectStore(keyPath));
        });
        void config.name;
        void config.version;
    }

    /** Legacy no-op — real IDB is never opened. */
    async ensureDB(): Promise<null> {
        return null;
    }

    private store(storeName: string): MemoryObjectStore {
        const store = this.storeByName.get(storeName);
        if (!store) {
            throw new Error(`Unknown in-memory store: ${storeName}`);
        }
        return store;
    }

    async get<T>(storeName: string, key: string): Promise<T | null> {
        const row = this.store(storeName).get(key);
        return (row as T | undefined) ?? null;
    }

    async getAll<T>(storeName: string, _indexName?: string, _query?: IDBKeyRange): Promise<T[]> {
        return this.store(storeName).getAll() as T[];
    }

    async forEachInStore<T>(
        storeName: string,
        visitor: (value: T, visitIndex: number) => boolean | void | Promise<boolean | void>,
        options?: Readonly<{
            indexName?: string;
            query?: IDBKeyRange;
            direction?: IDBCursorDirection;
            yieldEvery?: number;
        }>,
    ): Promise<number> {
        return this.store(storeName).forEach(
            (value, visitIndex) => visitor(value as T, visitIndex),
            options,
        );
    }

    async getAllByIndex<T>(
        storeName: string,
        indexName: string,
        query?: IDBKeyRange | string,
        limit?: number,
        direction: IDBCursorDirection = "next",
    ): Promise<T[]> {
        return this.store(storeName).getAllByIndex(indexName, query, limit, direction) as T[];
    }

    async put<T>(storeName: string, value: T): Promise<void> {
        this.store(storeName).put(value as Row);
    }

    async bulkPut<T>(storeName: string, values: T[]): Promise<void> {
        this.store(storeName).bulkPut(values as Row[]);
    }

    async bulkDelete(storeName: string, keys: ReadonlyArray<string>): Promise<void> {
        this.store(storeName).bulkDelete(keys);
    }

    async getRange<T>(
        storeName: string,
        indexName: string,
        lowerBound: unknown,
        upperBound: unknown,
        limit?: number,
        direction: IDBCursorDirection = "next",
    ): Promise<T[]> {
        const lower = lowerBound as readonly [string, number];
        const upper = upperBound as readonly [string, number];
        const range = IDBKeyRange.bound(lower, upper);
        return this.getAllByIndex<T>(storeName, indexName, range, limit, direction);
    }

    async delete(storeName: string, key: string): Promise<void> {
        this.store(storeName).delete(key);
    }

    async clear(storeName: string): Promise<void> {
        this.store(storeName).clear();
    }

    async deleteByRange(storeName: string, indexName: string, query: IDBKeyRange): Promise<void> {
        if (indexName !== "conversation_timestamp" || !query) {
            return;
        }
        const upper = query.upper as readonly [string, number] | undefined;
        if (!upper) {
            return;
        }
        this.store(storeName).deleteByConversationTimestampRange(upper[0], upper[1]);
    }
}
