/**
 * dm-operation-store.ts
 *
 * Append-only storage for DM operations.
 * Uses IndexedDB with object-per-operation model.
 * Never updates existing records - only appends new ones.
 */

import type { DmOperation } from "./dm-operation-types";

// ---------------------------------------------------------------------------
// Database Schema
// ---------------------------------------------------------------------------

const DB_NAME = "DmLedger";
const DB_VERSION = 1;
const STORE_NAME = "operations";

interface DmOperationRecord {
  /** Primary key: operation ID */
  readonly opId: string;

  /** Index: conversation ID for querying */
  readonly conversationId: string;

  /** Index: observed timestamp for ordering */
  readonly observedAtMs: number;

  /** The full operation */
  readonly operation: DmOperation;

  /** When this record was written to IndexedDB */
  readonly storedAtMs: number;
}

// ---------------------------------------------------------------------------
// Database Connection
// ---------------------------------------------------------------------------

let dbPromise: Promise<IDBDatabase> | null = null;

const openDb = (): Promise<IDBDatabase> => {
  if (dbPromise) return dbPromise;

  dbPromise = new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;

      // Operations store - append only, never updated
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        const store = db.createObjectStore(STORE_NAME, { keyPath: "opId" });

        // Index for efficient conversation queries
        store.createIndex("conversationId", "conversationId", { unique: false });

        // Index for time-ordered queries
        store.createIndex("observedAtMs", "observedAtMs", { unique: false });

        // Compound index for conversation + time (most common query)
        store.createIndex("conversationTime", ["conversationId", "observedAtMs"], {
          unique: false,
        });
      }
    };
  });

  return dbPromise;
};

// ---------------------------------------------------------------------------
// Append Operations
// ---------------------------------------------------------------------------

/**
 * Append a single operation to the ledger.
 * Idempotent: if opId already exists, it's a no-op.
 */
export const appendDmOperation = async (
  operation: DmOperation,
): Promise<boolean> => {
  const db = await openDb();

  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readwrite");
    const store = tx.objectStore(STORE_NAME);

    const record: DmOperationRecord = {
      opId: operation.opId,
      conversationId: operation.conversationId,
      observedAtMs: operation.observedAtMs,
      operation,
      storedAtMs: Date.now(),
    };

    const request = store.add(record);

    request.onsuccess = () => resolve(true);
    request.onerror = () => {
      // ConstraintError (duplicate key) means already exists - that's OK
      if (request.error?.name === "ConstraintError") {
        resolve(false); // Already existed
      } else {
        reject(request.error);
      }
    };
  });
};

/**
 * Append multiple operations in a single transaction.
 * More efficient than individual appends.
 */
export const appendDmOperations = async (
  operations: ReadonlyArray<DmOperation>,
): Promise<number> => {
  if (operations.length === 0) return 0;

  const db = await openDb();

  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readwrite");
    const store = tx.objectStore(STORE_NAME);

    let added = 0;
    let completed = 0;

    for (const operation of operations) {
      const record: DmOperationRecord = {
        opId: operation.opId,
        conversationId: operation.conversationId,
        observedAtMs: operation.observedAtMs,
        operation,
        storedAtMs: Date.now(),
      };

      const request = store.add(record);

      request.onsuccess = () => {
        added++;
        completed++;
        if (completed === operations.length) {
          resolve(added);
        }
      };

      request.onerror = () => {
        completed++;
        // ConstraintError is OK (already exists), other errors are not
        if (request.error?.name !== "ConstraintError") {
          tx.abort();
          reject(request.error);
          return;
        }
        if (completed === operations.length) {
          resolve(added);
        }
      };
    }

    tx.oncomplete = () => resolve(added);
    tx.onerror = () => reject(tx.error);
  });
};

// ---------------------------------------------------------------------------
// Query Operations
// ---------------------------------------------------------------------------

/**
 * Load all operations for a conversation, ordered by observed time.
 */
export const loadDmOperationsForConversation = async (
  conversationId: string,
  sinceMs?: number,
): Promise<ReadonlyArray<DmOperation>> => {
  const db = await openDb();

  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readonly");
    const store = tx.objectStore(STORE_NAME);
    const index = store.index("conversationTime");

    const range = sinceMs
      ? IDBKeyRange.bound([conversationId, sinceMs], [conversationId, Infinity])
      : IDBKeyRange.bound([conversationId, 0], [conversationId, Infinity]);

    const request = index.openCursor(range);
    const operations: DmOperation[] = [];

    request.onsuccess = () => {
      const cursor = request.result;
      if (cursor) {
        operations.push((cursor.value as DmOperationRecord).operation);
        cursor.continue();
      } else {
        resolve(operations);
      }
    };

    request.onerror = () => reject(request.error);
  });
};

/**
 * Load all operations across all conversations since a timestamp.
 * Used for bulk sync operations.
 */
export const loadDmOperationsSince = async (
  sinceMs: number,
): Promise<ReadonlyArray<DmOperation>> => {
  const db = await openDb();

  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readonly");
    const store = tx.objectStore(STORE_NAME);
    const index = store.index("observedAtMs");

    const range = IDBKeyRange.lowerBound(sinceMs);
    const request = index.openCursor(range);
    const operations: DmOperation[] = [];

    request.onsuccess = () => {
      const cursor = request.result;
      if (cursor) {
        operations.push((cursor.value as DmOperationRecord).operation);
        cursor.continue();
      } else {
        resolve(operations);
      }
    };

    request.onerror = () => reject(request.error);
  });
};

/**
 * Check if an operation already exists by ID.
 */
export const hasDmOperation = async (opId: string): Promise<boolean> => {
  const db = await openDb();

  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readonly");
    const store = tx.objectStore(STORE_NAME);
    const request = store.count(opId);

    request.onsuccess = () => resolve(request.result > 0);
    request.onerror = () => reject(request.error);
  });
};

// ---------------------------------------------------------------------------
// Stats & Maintenance
// ---------------------------------------------------------------------------

/**
 * Get operation count for a conversation.
 */
export const getDmOperationCount = async (conversationId: string): Promise<number> => {
  const db = await openDb();

  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readonly");
    const store = tx.objectStore(STORE_NAME);
    const index = store.index("conversationId");
    const request = index.count(conversationId);

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
};

/**
 * Clear all operations for a conversation.
 * Use with caution - only for full reset scenarios.
 */
export const clearDmOperationsForConversation = async (
  conversationId: string,
): Promise<void> => {
  const db = await openDb();

  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readwrite");
    const store = tx.objectStore(STORE_NAME);
    const index = store.index("conversationId");
    const request = index.openCursor(conversationId);

    request.onsuccess = () => {
      const cursor = request.result;
      if (cursor) {
        store.delete(cursor.primaryKey);
        cursor.continue();
      } else {
        resolve();
      }
    };

    request.onerror = () => reject(request.error);
  });
};

// ---------------------------------------------------------------------------
// Debug Helpers
// ---------------------------------------------------------------------------

/**
 * Export all operations for debugging/backup.
 */
export const exportAllDmOperations = async (): Promise<ReadonlyArray<DmOperation>> => {
  const db = await openDb();

  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readonly");
    const store = tx.objectStore(STORE_NAME);
    const request = store.openCursor();
    const operations: DmOperation[] = [];

    request.onsuccess = () => {
      const cursor = request.result;
      if (cursor) {
        operations.push((cursor.value as DmOperationRecord).operation);
        cursor.continue();
      } else {
        resolve(operations);
      }
    };

    request.onerror = () => reject(request.error);
  });
};
