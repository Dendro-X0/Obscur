/**
 * Message Deletion Types
 *
 * Canonical deletion model with scoped tombstones and permission-checked operations.
 */

import type { PublicKeyHex } from "@dweb/crypto/public-key-hex";

// Re-export for convenience
export type { PublicKeyHex };

// ---------------------------------------------------------------------------
// Core Identifiers
// ---------------------------------------------------------------------------

export type TombstoneId = string;

export interface MessageIdentity {
  canonicalId: string;
  identityIds: string[]; // All known aliases: UUID, eventId, rumorId, etc.
  conversationId: string;
  senderPubkey: PublicKeyHex;
  createdAt: number;
}

// ---------------------------------------------------------------------------
// Tombstone Scopes
// ---------------------------------------------------------------------------

export type DeleteScope = "local" | "network";

export type DeleteReason =
  | "delete_for_me"
  | "delete_for_everyone";

// ---------------------------------------------------------------------------
// Base Tombstone
// ---------------------------------------------------------------------------

export interface MessageTombstone {
  tombstoneId: TombstoneId;
  scope: DeleteScope;
  profileId: string;
  conversationId: string;
  targetMessageIdentityIds: string[]; // All IDs that identify the target message
  targetAuthorPubkey: PublicKeyHex;
  deletedByPubkey: PublicKeyHex;
  deletedAt: number;
  reason: DeleteReason;
  // Optional network evidence (for network deletes)
  commandEventId?: string;
  relayEvidence?: string[];
  // For deletes received before target message arrives
  pendingTarget?: boolean;
}

// ---------------------------------------------------------------------------
// Local Tombstone (Delete for Me)
// ---------------------------------------------------------------------------

export interface LocalMessageTombstone extends MessageTombstone {
  scope: "local";
  reason: "delete_for_me";
}

// ---------------------------------------------------------------------------
// Network Tombstone (Delete for Everyone)
// ---------------------------------------------------------------------------

export interface NetworkMessageTombstone extends MessageTombstone {
  scope: "network";
  reason: "delete_for_everyone";
  commandEventId: string; // Required for network deletes
}

// ---------------------------------------------------------------------------
// Delete Commands (Network Contract)
// ---------------------------------------------------------------------------

export interface DmDeleteCommandV1 {
  type: "message_delete_v1";
  mode: "delete_for_everyone";
  conversationId: string;
  targetMessageIdentityIds: string[];
  targetAuthorPubkey: PublicKeyHex;
  deletedByPubkey: PublicKeyHex;
  deletedAt: number;
  nonce: string;
}

export interface CommunityDeleteCommandV1 {
  type: "community_message_delete_v1";
  mode: "delete_for_everyone";
  groupId: string;
  relayUrl: string;
  conversationId: string;
  targetMessageIdentityIds: string[];
  targetAuthorPubkey: PublicKeyHex;
  deletedByPubkey: PublicKeyHex;
  deletedAt: number;
  nonce: string;
}

export type DeleteCommandV1 = DmDeleteCommandV1 | CommunityDeleteCommandV1;

// ---------------------------------------------------------------------------
// Coordinator Operations
// ---------------------------------------------------------------------------

export interface DeleteForMeIntent {
  profileId: string;
  conversationId: string;
  targetMessage: MessageIdentity;
  /** Current account owner performing the local delete. */
  accountPublicKeyHex: PublicKeyHex;
  reason?: string; // Optional user-provided reason
}

export interface DeleteForEveryoneIntent {
  profileId: string;
  conversationId: string;
  targetMessage: MessageIdentity;
  myPublicKeyHex: PublicKeyHex;
}

export interface RemoteDeleteCommand {
  command: DeleteCommandV1;
  commandEventId: string;
  relayUrl?: string;
  decryptedPayload: string;
}

// ---------------------------------------------------------------------------
// Selector Context
// ---------------------------------------------------------------------------

export interface MessageVisibilityContext {
  profileId: string;
  conversationId: string;
  publicKeyHex: PublicKeyHex;
}

// ---------------------------------------------------------------------------
// Events
// ---------------------------------------------------------------------------

export interface MessageDeletedEvent {
  tombstone: MessageTombstone;
  conversationId: string;
  targetMessageIdentityIds: string[];
}

export interface MessageDeletionFailedEvent {
  intent: DeleteForMeIntent | DeleteForEveryoneIntent;
  error: string;
  code: "permission_denied" | "invalid_target" | "network_error" | "storage_error";
}
