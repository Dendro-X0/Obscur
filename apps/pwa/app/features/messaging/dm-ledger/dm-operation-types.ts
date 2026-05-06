/**
 * dm-operation-types.ts
 *
 * Canonical operation types for the DM Ledger.
 * All DM state changes are represented as append-only operations.
 * Message visibility is derived by reducing these operations.
 */

import type { Message } from "../types";
import type { PublicKeyHex } from "@dweb/crypto/public-key-hex";

// ---------------------------------------------------------------------------
// Operation Sources
// ---------------------------------------------------------------------------

export type DmOperationSource =
  | "local_send"      // User sent message from this device
  | "local_delete"    // User deleted message from this device
  | "relay_live"      // Real-time event from relay subscription
  | "relay_sync"      // Historical event from relay sync/backfill
  | "restore"         // Imported from backup/restore
  | "import";         // Bulk import from external source

// ---------------------------------------------------------------------------
// Base Operation
// ---------------------------------------------------------------------------

export interface DmOperationBase {
  /** Unique operation ID (deterministic for idempotency) */
  readonly opId: string;

  /** Conversation identifier (sorted pubkey pair) */
  readonly conversationId: string;

  /** When this operation was observed locally (not relay timestamp) */
  readonly observedAtMs: number;

  /** Source of the operation */
  readonly source: DmOperationSource;

  /** Optional: relay URL if from relay */
  readonly relayUrl?: string;

  /** Optional: original relay event ID if from relay */
  readonly relayEventId?: string;
}

// ---------------------------------------------------------------------------
// Message Upsert Operation
// ---------------------------------------------------------------------------

export interface DmMessageUpsertOperation extends DmOperationBase {
  readonly op: "message_upsert";

  /** Message ID (optimistic UUID for local sends, relay ID for received) */
  readonly messageId: string;

  /** All identity aliases for this message (optimistic UUID, relay event ID, rumor IDs) */
  readonly identityIds: ReadonlyArray<string>;

  /** The full message content and metadata */
  readonly message: Message;

  /** Sender's public key */
  readonly senderPubkey: PublicKeyHex;

  /** Is this an outgoing message from local user */
  readonly isOutgoing: boolean;
}

// ---------------------------------------------------------------------------
// Message Delete Operation
// ---------------------------------------------------------------------------

export interface DmMessageDeleteOperation extends DmOperationBase {
  readonly op: "message_delete";

  /** All identity aliases of the target message(s) to delete */
  readonly targetIdentityIds: ReadonlyArray<string>;

  /** Who initiated the delete */
  readonly deletedByPubkey: PublicKeyHex;

  /** Is this a local delete (vs receiving a delete command) */
  readonly isLocalDelete: boolean;

  /** Optional: the delete command message ID if applicable */
  readonly deleteCommandMessageId?: string;
}

// ---------------------------------------------------------------------------
// Operation Union
// ---------------------------------------------------------------------------

export type DmOperation =
  | DmMessageUpsertOperation
  | DmMessageDeleteOperation;

// ---------------------------------------------------------------------------
// Operation Helpers
// ---------------------------------------------------------------------------

export const isDmMessageUpsertOperation = (
  op: DmOperation,
): op is DmMessageUpsertOperation => op.op === "message_upsert";

export const isDmMessageDeleteOperation = (
  op: DmOperation,
): op is DmMessageDeleteOperation => op.op === "message_delete";

/**
 * Generate deterministic operation ID for idempotency.
 * Same inputs should always produce same opId.
 */
export const generateDmOperationId = (params: Readonly<{
  conversationId: string;
  messageId?: string;
  targetIdentityIds?: ReadonlyArray<string>;
  op: string;
  observedAtMs: number;
  source: DmOperationSource;
}>): string => {
  const parts = [
    params.conversationId,
    params.op,
    params.messageId ?? params.targetIdentityIds?.join(":") ?? "none",
    String(params.observedAtMs),
    params.source,
  ];
  // Simple hash for deterministic ID
  let hash = 0;
  const str = parts.join("|");
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32bit integer
  }
  return `dmop_${Math.abs(hash).toString(36)}_${params.observedAtMs.toString(36)}`;
};

// ---------------------------------------------------------------------------
// Projection Output Types
// ---------------------------------------------------------------------------

export interface DmLedgerProjection {
  /** Visible messages (ordered by timestamp desc) */
  readonly messages: ReadonlyArray<Message>;

  /** Set of all tombstoned identity IDs */
  readonly tombstones: ReadonlySet<string>;

  /** Operation count used for this projection */
  readonly operationCount: number;

  /** Timestamp of most recent operation */
  readonly lastOperationAtMs: number;
}

export interface DmLedgerDivergenceReport {
  readonly conversationId: string;
  readonly existingMessageCount: number;
  readonly projectedMessageCount: number;
  readonly missingFromExisting: ReadonlyArray<string>; // message IDs
  readonly resurrectedInExisting: ReadonlyArray<string>; // message IDs that should be deleted
  readonly timestamp: number;
}
