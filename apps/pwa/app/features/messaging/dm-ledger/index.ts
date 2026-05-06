/**
 * DM Operation Ledger
 *
 * A canonical append-only log for DM state changes.
 * Message visibility is derived by reducing operations, not stored directly.
 *
 * Key principle: All state changes are operations. The current state is always
 * a pure function of the operation history.
 *
 * This solves the "resurrection" problem where deleted messages reappear
 * after sync/restore/relay replay.
 *
 * @example
 * ```typescript
 * // Record a message
 * await recordDmMessage({
 *   conversationId: "pubA:pubB",
 *   message: newMessage,
 *   identityIds: [optimisticId, relayEventId, rumorId],
 *   senderPubkey: myPubkey,
 *   isOutgoing: true,
 *   source: "local_send",
 * });
 *
 * // Record a delete
 * await recordDmDelete({
 *   conversationId: "pubA:pubB",
 *   targetIdentityIds: [messageId, eventId],
 *   deletedByPubkey: myPubkey,
 *   isLocalDelete: true,
 *   source: "local_delete",
 * });
 *
 * // Get visible messages
 * const projection = await getDmConversationProjection("pubA:pubB");
 * // projection.messages - visible messages
 * // projection.tombstones - deleted identity IDs
 * ```
 */

// Types
export type {
  DmOperation,
  DmMessageUpsertOperation,
  DmMessageDeleteOperation,
  DmOperationSource,
  DmLedgerProjection,
  DmLedgerDivergenceReport,
} from "./dm-operation-types";

export { generateDmOperationId } from "./dm-operation-types";

// Reducer
export {
  reduceDmOperations,
  reduceDmOperationsIncremental,
  isMessageDeletedInProjection,
  findMessageByIdentity,
  type ReducerState,
} from "./dm-operation-reducer";

// Store
export {
  appendDmOperation,
  appendDmOperations,
  loadDmOperationsForConversation,
  loadDmOperationsSince,
  hasDmOperation,
  getDmOperationCount,
  clearDmOperationsForConversation,
  exportAllDmOperations,
} from "./dm-operation-store";

// Service (Primary API)
export {
  // Recording operations
  recordDmMessage,
  recordDmDelete,
  type RecordMessageParams,
  type RecordDeleteParams,

  // Querying state
  getDmConversationProjection,
  isDmMessageDeleted,
  findDmMessageByIdentity,

  // Subscriptions
  subscribeToDmConversation,
  type ProjectionListener,

  // Shadow mode
  checkDmDivergence,
  type ShadowModeCheckParams,

  // Batch operations
  importDmOperations,

  // Debug
  reloadDmConversation,
  getDmLedgerStats,
} from "./dm-ledger-service";
