/**
 * dm-ledger-service.ts
 *
 * Public API for the DM Operation Ledger.
 * Single source of truth for DM message visibility.
 *
 * Principles:
 * 1. All state changes go through append-only operations
 * 2. Message visibility is always derived by reducing operations
 * 3. No manual state mutation - only operations
 * 4. Idempotent: same operation multiple times = same result
 */

import type { Message } from "../types";
import type { PublicKeyHex } from "@dweb/crypto/public-key-hex";
import type {
  DmOperation,
  DmMessageUpsertOperation,
  DmMessageDeleteOperation,
  DmOperationSource,
  DmLedgerProjection,
  DmLedgerDivergenceReport,
} from "./dm-operation-types";
import { generateDmOperationId } from "./dm-operation-types";
import {
  reduceDmOperations,
  isMessageDeletedInProjection,
  type ReducerState,
} from "./dm-operation-reducer";
import {
  appendDmOperation,
  appendDmOperations,
  loadDmOperationsForConversation,
} from "./dm-operation-store";

// ---------------------------------------------------------------------------
// Conversation State Cache (in-memory for performance)
// ---------------------------------------------------------------------------

type ConversationCache = {
  projection: DmLedgerProjection;
  lastSyncAtMs: number;
  pendingOps: DmOperation[];
};

const conversationCache: Map<string, ConversationCache> = new Map();

// ---------------------------------------------------------------------------
// Subscriptions
// ---------------------------------------------------------------------------

export type ProjectionListener = (projection: DmLedgerProjection) => void;

const listeners: Map<string, Set<ProjectionListener>> = new Map();

// ---------------------------------------------------------------------------
// Public API: Recording Operations
// ---------------------------------------------------------------------------

export interface RecordMessageParams {
  conversationId: string;
  message: Message;
  identityIds: ReadonlyArray<string>;
  senderPubkey: PublicKeyHex;
  isOutgoing: boolean;
  source: DmOperationSource;
  relayUrl?: string;
  relayEventId?: string;
}

/**
 * Record a message upsert operation.
 * This is the ONLY way to add a message to the ledger.
 */
export const recordDmMessage = async (
  params: RecordMessageParams,
): Promise<boolean> => {
  const op: DmMessageUpsertOperation = {
    op: "message_upsert",
    opId: generateDmOperationId({
      conversationId: params.conversationId,
      messageId: params.message.id,
      op: "message_upsert",
      observedAtMs: Date.now(),
      source: params.source,
    }),
    conversationId: params.conversationId,
    messageId: params.message.id,
    identityIds: params.identityIds,
    message: params.message,
    senderPubkey: params.senderPubkey,
    isOutgoing: params.isOutgoing,
    observedAtMs: Date.now(),
    source: params.source,
    relayUrl: params.relayUrl,
    relayEventId: params.relayEventId,
  };

  const wasAdded = await appendDmOperation(op);

  // Update cache and notify listeners
  await applyOperationToCache(params.conversationId, op);

  return wasAdded;
};

export interface RecordDeleteParams {
  conversationId: string;
  targetIdentityIds: ReadonlyArray<string>;
  deletedByPubkey: PublicKeyHex;
  isLocalDelete: boolean;
  source: DmOperationSource;
  deleteCommandMessageId?: string;
}

/**
 * Record a message delete operation.
 * This is the ONLY way to delete a message in the ledger.
 */
export const recordDmDelete = async (
  params: RecordDeleteParams,
): Promise<boolean> => {
  const op: DmMessageDeleteOperation = {
    op: "message_delete",
    opId: generateDmOperationId({
      conversationId: params.conversationId,
      targetIdentityIds: params.targetIdentityIds,
      op: "message_delete",
      observedAtMs: Date.now(),
      source: params.source,
    }),
    conversationId: params.conversationId,
    targetIdentityIds: params.targetIdentityIds,
    deletedByPubkey: params.deletedByPubkey,
    isLocalDelete: params.isLocalDelete,
    source: params.source,
    observedAtMs: Date.now(),
    deleteCommandMessageId: params.deleteCommandMessageId,
  };

  const wasAdded = await appendDmOperation(op);

  // Update cache and notify listeners
  await applyOperationToCache(params.conversationId, op);

  return wasAdded;
};

// ---------------------------------------------------------------------------
// Public API: Querying State
// ---------------------------------------------------------------------------

/**
 * Get the canonical projection for a conversation.
 * This is the source of truth for what messages should be visible.
 */
export const getDmConversationProjection = async (
  conversationId: string,
): Promise<DmLedgerProjection> => {
  const cached = conversationCache.get(conversationId);

  if (cached) {
    // Merge pending ops and return
    if (cached.pendingOps.length > 0) {
      cached.projection = reduceDmOperations(
        cached.pendingOps,
        convertProjectionToState(cached.projection),
      );
      cached.pendingOps = [];
    }
    return cached.projection;
  }

  // Load from store
  const operations = await loadDmOperationsForConversation(conversationId);
  const projection = reduceDmOperations(operations);

  // Cache it
  conversationCache.set(conversationId, {
    projection,
    lastSyncAtMs: Date.now(),
    pendingOps: [],
  });

  return projection;
};

/**
 * Check if a message (by any identity alias) is deleted.
 */
export const isDmMessageDeleted = async (
  conversationId: string,
  identityIds: ReadonlyArray<string>,
): Promise<boolean> => {
  const projection = await getDmConversationProjection(conversationId);
  return isMessageDeletedInProjection(projection, identityIds);
};

/**
 * Find a message by any of its identity aliases.
 */
export const findDmMessageByIdentity = async (
  conversationId: string,
  identityId: string,
): Promise<Message | undefined> => {
  const projection = await getDmConversationProjection(conversationId);
  return projection.messages.find(m => m.id === identityId || m.eventId === identityId);
};

// ---------------------------------------------------------------------------
// Public API: Subscriptions
// ---------------------------------------------------------------------------

/**
 * Subscribe to projection changes for a conversation.
 * Returns unsubscribe function.
 */
export const subscribeToDmConversation = (
  conversationId: string,
  listener: ProjectionListener,
): (() => void) => {
  if (!listeners.has(conversationId)) {
    listeners.set(conversationId, new Set());
  }
  listeners.get(conversationId)!.add(listener);

  // Immediately notify with current state
  void getDmConversationProjection(conversationId).then(listener);

  return () => {
    listeners.get(conversationId)?.delete(listener);
  };
};

// ---------------------------------------------------------------------------
// Public API: Shadow Mode & Divergence Detection
// ---------------------------------------------------------------------------

export interface ShadowModeCheckParams {
  conversationId: string;
  existingMessages: ReadonlyArray<Message>;
  logDivergence?: boolean;
}

/**
 * Check for divergence between existing state and ledger projection.
 * Use this in shadow mode to identify inconsistencies.
 */
export const checkDmDivergence = async (
  params: ShadowModeCheckParams,
): Promise<DmLedgerDivergenceReport | null> => {
  const projection = await getDmConversationProjection(params.conversationId);

  const existingIds = new Set(params.existingMessages.map(m => m.id));

  // Find messages in projection but missing from existing (should be added)
  const missingFromExisting = projection.messages
    .filter(m => !existingIds.has(m.id))
    .map(m => m.id);

  // Find messages in existing but tombstoned in projection (should be removed)
  const resurrectedInExisting = params.existingMessages
    .filter(m => projection.tombstones.has(m.id) || (m.eventId && projection.tombstones.has(m.eventId)))
    .map(m => m.id);

  // No divergence if both lists are empty
  if (missingFromExisting.length === 0 && resurrectedInExisting.length === 0) {
    return null;
  }

  const report: DmLedgerDivergenceReport = {
    conversationId: params.conversationId,
    existingMessageCount: params.existingMessages.length,
    projectedMessageCount: projection.messages.length,
    missingFromExisting,
    resurrectedInExisting,
    timestamp: Date.now(),
  };

  if (params.logDivergence) {
    console.warn("[dm-ledger:divergence]", {
      conversationId: report.conversationId.slice(0, 32),
      existingCount: report.existingMessageCount,
      projectedCount: report.projectedMessageCount,
      missingCount: report.missingFromExisting.length,
      resurrectedCount: report.resurrectedInExisting.length,
    });
  }

  return report;
};

// ---------------------------------------------------------------------------
// Public API: Batch Operations
// ---------------------------------------------------------------------------

/**
 * Import multiple operations (e.g., from restore/sync).
 * More efficient than individual records.
 */
export const importDmOperations = async (
  operations: ReadonlyArray<DmOperation>,
): Promise<number> => {
  if (operations.length === 0) return 0;

  // Group by conversation for cache updates
  const byConversation = new Map<string, DmOperation[]>();
  for (const op of operations) {
    if (!byConversation.has(op.conversationId)) {
      byConversation.set(op.conversationId, []);
    }
    byConversation.get(op.conversationId)!.push(op);
  }

  // Bulk append to store
  const added = await appendDmOperations(operations);

  // Update caches
  for (const [conversationId, ops] of byConversation.entries()) {
    for (const op of ops) {
      await applyOperationToCache(conversationId, op);
    }
  }

  return added;
};

// ---------------------------------------------------------------------------
// Public API: Debug & Maintenance
// ---------------------------------------------------------------------------

/**
 * Force reload projection from store (clears cache).
 */
export const reloadDmConversation = async (
  conversationId: string,
): Promise<DmLedgerProjection> => {
  conversationCache.delete(conversationId);
  return getDmConversationProjection(conversationId);
};

/**
 * Get stats for debugging.
 */
export const getDmLedgerStats = (): {
  cachedConversations: number;
  totalListeners: number;
} => {
  return {
    cachedConversations: conversationCache.size,
    totalListeners: Array.from(listeners.values()).reduce(
      (sum, set) => sum + set.size,
      0,
    ),
  };
};

// ---------------------------------------------------------------------------
// Internal Helpers
// ---------------------------------------------------------------------------

const convertProjectionToState = (projection: DmLedgerProjection): ReducerState => ({
  messagesById: new Map(projection.messages.map(m => [m.id, m])),
  identityToMessage: new Map(), // Will be rebuilt from messages
  tombstones: new Map(Array.from(projection.tombstones).map(id => [id, "previous"])),
  seenOpIds: new Set(), // Will be rebuilt
  lastOperationAtMs: projection.lastOperationAtMs,
});

const applyOperationToCache = async (
  conversationId: string,
  op: DmOperation,
): Promise<void> => {
  const cached = conversationCache.get(conversationId);

  if (cached) {
    // Add to pending and reduce
    cached.pendingOps.push(op);
    cached.projection = reduceDmOperations(
      cached.pendingOps,
      convertProjectionToState(cached.projection),
    );
    cached.pendingOps = [];
    cached.lastSyncAtMs = Date.now();
  }

  // Notify listeners
  const conversationListeners = listeners.get(conversationId);
  if (conversationListeners && conversationListeners.size > 0) {
    const projection = cached
      ? cached.projection
      : await getDmConversationProjection(conversationId);

    for (const listener of conversationListeners) {
      try {
        listener(projection);
      } catch (err) {
        console.error("[dm-ledger] listener error", err);
      }
    }
  }
};
