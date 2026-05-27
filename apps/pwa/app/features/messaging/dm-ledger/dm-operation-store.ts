/**
 * dm-operation-store.ts
 *
 * Append-only storage for DM operations.
 * In-memory append-only ledger (IndexedDB permanently excluded).
 * Never updates existing records - only appends new ones.
 */

import type { DmOperation } from "./dm-operation-types";

// ---------------------------------------------------------------------------
// Database Schema
// ---------------------------------------------------------------------------

interface DmOperationRecord {
  /** Primary key: operation ID */
  readonly opId: string;

  /** Index: conversation ID for querying */
  readonly conversationId: string;

  /** Index: observed timestamp for ordering */
  readonly observedAtMs: number;

  /** The full operation */
  readonly operation: DmOperation;

  readonly storedAtMs: number;
}

const operationsById = new Map<string, DmOperationRecord>();

const matchesConversationTimeRange = (
  record: DmOperationRecord,
  conversationId: string,
  lowerMs: number,
  upperMs: number,
): boolean => (
  record.conversationId === conversationId
  && record.observedAtMs >= lowerMs
  && record.observedAtMs <= upperMs
);

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
  if (operationsById.has(operation.opId)) {
    return false;
  }
  operationsById.set(operation.opId, {
    opId: operation.opId,
    conversationId: operation.conversationId,
    observedAtMs: operation.observedAtMs,
    operation,
    storedAtMs: Date.now(),
  });
  return true;
};

/**
 * Append multiple operations in a single transaction.
 * More efficient than individual appends.
 */
export const appendDmOperations = async (
  operations: ReadonlyArray<DmOperation>,
): Promise<number> => {
  let added = 0;
  for (const operation of operations) {
    if (await appendDmOperation(operation)) {
      added += 1;
    }
  }
  return added;
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
  const lowerMs = typeof sinceMs === "number" ? sinceMs : 0;
  return [...operationsById.values()]
    .filter((record) => matchesConversationTimeRange(record, conversationId, lowerMs, Number.POSITIVE_INFINITY))
    .sort((left, right) => left.observedAtMs - right.observedAtMs)
    .map((record) => record.operation);
};

/**
 * Load all operations across all conversations since a timestamp.
 * Used for bulk sync operations.
 */
export const loadDmOperationsSince = async (
  sinceMs: number,
): Promise<ReadonlyArray<DmOperation>> => (
  [...operationsById.values()]
    .filter((record) => record.observedAtMs >= sinceMs)
    .sort((left, right) => left.observedAtMs - right.observedAtMs)
    .map((record) => record.operation)
);

/**
 * Check if an operation already exists by ID.
 */
export const hasDmOperation = async (opId: string): Promise<boolean> => operationsById.has(opId);

// ---------------------------------------------------------------------------
// Stats & Maintenance
// ---------------------------------------------------------------------------

/**
 * Get operation count for a conversation.
 */
export const getDmOperationCount = async (conversationId: string): Promise<number> => (
  [...operationsById.values()].filter((record) => record.conversationId === conversationId).length
);

/**
 * Clear all operations for a conversation.
 * Use with caution - only for full reset scenarios.
 */
export const clearDmOperationsForConversation = async (
  conversationId: string,
): Promise<void> => {
  for (const [opId, record] of operationsById) {
    if (record.conversationId === conversationId) {
      operationsById.delete(opId);
    }
  }
};

// ---------------------------------------------------------------------------
// Debug Helpers
// ---------------------------------------------------------------------------

/**
 * Hard-delete upsert rows for specific message identity IDs from the ledger.
 * Called when a message is destructively deleted so no upsert record survives.
 * The corresponding delete-op tombstone is left in place so the reducer keeps
 * the message invisible if any upsert is re-appended from a sync.
 */
export const deleteMessageUpsertOperations = async (
  identityIds: ReadonlyArray<string>,
): Promise<void> => {
  if (identityIds.length === 0) return;
  const targetSet = new Set(identityIds);
  for (const [opId, record] of operationsById) {
    if (record.operation.op !== "message_upsert") {
      continue;
    }
    const op = record.operation;
    const shouldDelete = op.identityIds.some((id: string) => targetSet.has(id))
      || targetSet.has(op.messageId);
    if (shouldDelete) {
      operationsById.delete(opId);
    }
  }
};

/**
 * Export all operations for debugging/backup.
 */
export const exportAllDmOperations = async (): Promise<ReadonlyArray<DmOperation>> => (
  [...operationsById.values()].map((record) => record.operation)
);
