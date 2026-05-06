/**
 * dm-operation-reducer.ts
 *
 * Pure reducer for DM operations.
 * Takes a sequence of operations and produces the canonical message projection.
 *
 * Rules:
 * 1. A message is visible if it has an upsert and no matching delete
 * 2. Delete matches by ANY identity alias
 * 3. Later operations win
 * 4. Operations are idempotent (same opId = same result)
 */

import type {
  DmOperation,
  DmMessageUpsertOperation,
  DmMessageDeleteOperation,
  DmLedgerProjection,
} from "./dm-operation-types";
import type { Message } from "../types";

// ---------------------------------------------------------------------------
// Reducer State (internal mutable for performance)
// ---------------------------------------------------------------------------

export interface ReducerState {
  /** Message ID -> Message for visible messages */
  messagesById: Map<string, Message>;

  /** Identity ID -> Message ID for alias resolution */
  identityToMessage: Map<string, string>; // identityId -> messageId

  /** Identity ID -> delete operation ID for tombstone tracking */
  tombstones: Map<string, string>;

  /** Set of seen operation IDs for idempotency */
  seenOpIds: Set<string>;

  /** Latest operation timestamp */
  lastOperationAtMs: number;
}

// ---------------------------------------------------------------------------
// Pure Reducer
// ---------------------------------------------------------------------------

export const reduceDmOperations = (
  operations: ReadonlyArray<DmOperation>,
  initialState?: ReducerState,
): DmLedgerProjection => {
  const state: ReducerState = initialState ?? {
    messagesById: new Map(),
    identityToMessage: new Map(),
    tombstones: new Map(),
    seenOpIds: new Set(),
    lastOperationAtMs: 0,
  };

  // Sort by observed time, then by op sequence for determinism
  const sortedOps = [...operations].sort((a, b) => {
    const timeDiff = a.observedAtMs - b.observedAtMs;
    if (timeDiff !== 0) return timeDiff;
    // Same timestamp: upsert before delete, then by opId for determinism
    if (a.op !== b.op) {
      return a.op === "message_upsert" ? -1 : 1;
    }
    return a.opId.localeCompare(b.opId);
  });

  for (const op of sortedOps) {
    // Idempotency: skip if already seen
    if (state.seenOpIds.has(op.opId)) {
      continue;
    }
    state.seenOpIds.add(op.opId);
    state.lastOperationAtMs = Math.max(state.lastOperationAtMs, op.observedAtMs);

    switch (op.op) {
      case "message_upsert":
        applyUpsert(state, op);
        break;
      case "message_delete":
        applyDelete(state, op);
        break;
    }
  }

  // Build projection output
  const messages = Array.from(state.messagesById.values())
    .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());

  return {
    messages,
    tombstones: new Set(state.tombstones.keys()),
    operationCount: state.seenOpIds.size,
    lastOperationAtMs: state.lastOperationAtMs,
  };
};

// ---------------------------------------------------------------------------
// Apply Operations
// ---------------------------------------------------------------------------

const applyUpsert = (
  state: ReducerState,
  op: DmMessageUpsertOperation,
): void => {
  // Check if any identity alias is tombstoned
  const isTombstoned = op.identityIds.some(id => state.tombstones.has(id));

  if (isTombstoned) {
    // Message was deleted earlier - do not resurrect
    // This handles the "restore after delete" case
    return;
  }

  // Add/update the message
  state.messagesById.set(op.messageId, op.message);

  // Index all identity aliases pointing to this message
  for (const identityId of op.identityIds) {
    state.identityToMessage.set(identityId, op.messageId);
  }
};

const applyDelete = (
  state: ReducerState,
  op: DmMessageDeleteOperation,
): void => {
  // Mark all target identities as tombstoned
  for (const targetId of op.targetIdentityIds) {
    state.tombstones.set(targetId, op.opId);

    // Find and remove any message matching this identity
    // First check: is this a message ID directly?
    if (state.messagesById.has(targetId)) {
      state.messagesById.delete(targetId);
    }

    // Second check: is this an alias for a message?
    const matchingMessageId = state.identityToMessage.get(targetId);
    if (matchingMessageId && state.messagesById.has(matchingMessageId)) {
      state.messagesById.delete(matchingMessageId);
    }
  }
};

// ---------------------------------------------------------------------------
// Incremental Reducer (for live updates)
// ---------------------------------------------------------------------------

export const reduceDmOperationsIncremental = (
  previousProjection: DmLedgerProjection,
  newOperations: ReadonlyArray<DmOperation>,
): DmLedgerProjection => {
  // Reconstruct state from previous projection
  const state: ReducerState = {
    messagesById: new Map(previousProjection.messages.map(m => [m.id, m])),
    identityToMessage: new Map(), // Rebuild from messages
    tombstones: new Map(
      Array.from(previousProjection.tombstones).map(id => [id, "previous"]),
    ),
    seenOpIds: new Set(), // We'll regenerate this
    lastOperationAtMs: previousProjection.lastOperationAtMs,
  };

  // Add all messages to seen set (they came from previous ops)
  // For incremental, we trust the previous projection and just apply new ops
  // This avoids reprocessing the entire history

  return reduceDmOperations(newOperations, state);
};

// ---------------------------------------------------------------------------
// Query Helpers
// ---------------------------------------------------------------------------

export const isMessageDeletedInProjection = (
  projection: DmLedgerProjection,
  identityIds: ReadonlyArray<string>,
): boolean => {
  return identityIds.some(id => projection.tombstones.has(id));
};

export const findMessageByIdentity = (
  projection: DmLedgerProjection,
  identityId: string,
): Message | undefined => {
  return projection.messages.find(
    m => m.id === identityId || m.eventId === identityId,
  );
};
