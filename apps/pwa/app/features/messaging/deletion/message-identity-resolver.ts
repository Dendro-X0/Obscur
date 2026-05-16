/**
 * Message Identity Resolver
 *
 * Owns canonical message identity, identity alias merging, and tombstone matching.
 *
 * Rules:
 * - Messages may have multiple IDs (UUID, eventId, rumorId, etc.)
 * - Tombstones target all known identities
 * - A message matches a tombstone if any identity intersects
 */

import type { MessageIdentity } from "./types";

// ---------------------------------------------------------------------------
// Canonical Identity Creation
// ---------------------------------------------------------------------------

export interface MessageIdentityInput {
  id: string; // Primary/local ID
  eventId?: string;
  conversationId: string;
  senderPubkey: string;
  createdAt: number;
  // Additional aliases
  additionalIds?: string[];
}

/**
 * Resolve a canonical message identity from message data.
 * Collects all known aliases for tombstone targeting.
 */
export function resolveMessageIdentity(input: MessageIdentityInput): MessageIdentity {
  const identityIds = [input.id];

  if (input.eventId && input.eventId !== input.id) {
    identityIds.push(input.eventId);
  }

  if (input.additionalIds) {
    for (const id of input.additionalIds) {
      if (!identityIds.includes(id)) {
        identityIds.push(id);
      }
    }
  }

  return {
    canonicalId: input.id,
    identityIds,
    conversationId: input.conversationId,
    senderPubkey: input.senderPubkey as import("@dweb/crypto/public-key-hex").PublicKeyHex,
    createdAt: input.createdAt,
  };
}

// ---------------------------------------------------------------------------
// Identity Matching
// ---------------------------------------------------------------------------

/**
 * Check if a message matches any of the given identity IDs.
 * Used to determine if a tombstone applies to a message.
 */
export function messageMatchesIdentityIds(
  message: MessageIdentity,
  targetIds: readonly string[]
): boolean {
  for (const msgId of message.identityIds) {
    if (targetIds.includes(msgId)) {
      return true;
    }
  }
  return false;
}

/**
 * Check if two identities refer to the same message.
 * Used for deduplication and identity merging.
 */
export function identitiesReferToSameMessage(
  a: MessageIdentity,
  b: MessageIdentity
): boolean {
  // Same conversation and sender
  if (a.conversationId !== b.conversationId || a.senderPubkey !== b.senderPubkey) {
    return false;
  }

  // Any identity overlap
  for (const id of a.identityIds) {
    if (b.identityIds.includes(id)) {
      return true;
    }
  }

  return false;
}

// ---------------------------------------------------------------------------
// Identity Merging
// ---------------------------------------------------------------------------

/**
 * Merge two message identities into one canonical identity.
 * Preserves the earliest creation time and collects all aliases.
 */
export function mergeMessageIdentityAliases(
  existing: MessageIdentity,
  incoming: MessageIdentity
): MessageIdentity {
  if (existing.conversationId !== incoming.conversationId) {
    throw new Error("Cannot merge identities from different conversations");
  }

  if (existing.senderPubkey !== incoming.senderPubkey) {
    throw new Error("Cannot merge identities from different senders");
  }

  // Merge all unique IDs
  const mergedIds = [...existing.identityIds];
  for (const id of incoming.identityIds) {
    if (!mergedIds.includes(id)) {
      mergedIds.push(id);
    }
  }

  // Keep earliest creation time
  const earliestCreatedAt = Math.min(existing.createdAt, incoming.createdAt);

  // Prefer existing canonical ID, but could use heuristic (shorter, or first seen)
  return {
    canonicalId: existing.canonicalId,
    identityIds: mergedIds,
    conversationId: existing.conversationId,
    senderPubkey: existing.senderPubkey,
    createdAt: earliestCreatedAt,
  };
}

// ---------------------------------------------------------------------------
// Tombstone Matching
// ---------------------------------------------------------------------------

/**
 * Check if a tombstone's target IDs match a message.
 * This is the core function for determining if a message should be hidden.
 */
export function tombstoneMatchesMessage(
  tombstoneTargetIds: readonly string[],
  message: MessageIdentity
): boolean {
  return messageMatchesIdentityIds(message, tombstoneTargetIds);
}

/**
 * Find which identity ID from a message matches a tombstone.
 * Useful for diagnostics and tombstone precision.
 */
export function findMatchingIdentityId(
  message: MessageIdentity,
  tombstoneTargetIds: readonly string[]
): string | null {
  for (const msgId of message.identityIds) {
    if (tombstoneTargetIds.includes(msgId)) {
      return msgId;
    }
  }
  return null;
}

// ---------------------------------------------------------------------------
// Identity ID Extraction from Raw Data
// ---------------------------------------------------------------------------

/**
 * Extract all relevant identity IDs from a Nostr DM event.
 * This captures event ID, any e-tag references, etc.
 */
export function extractIdentityIdsFromDmEvent(event: {
  id: string;
  tags?: string[][];
}): string[] {
  const ids = [event.id];

  // e-tags may reference original message being replied to or deleted
  if (event.tags) {
    for (const tag of event.tags) {
      if (tag[0] === "e" && typeof tag[1] === "string") {
        if (!ids.includes(tag[1])) {
          ids.push(tag[1]);
        }
      }
    }
  }

  return ids;
}

/**
 * Build identity ID set from multiple sources.
 */
export function buildIdentityIdSet(
  localId: string,
  eventId?: string,
  tags?: string[][]
): string[] {
  const ids = [localId];

  if (eventId && eventId !== localId) {
    ids.push(eventId);
  }

  if (tags) {
    for (const tag of tags) {
      if (tag[0] === "e" && typeof tag[1] === "string") {
        if (!ids.includes(tag[1])) {
          ids.push(tag[1]);
        }
      }
    }
  }

  return ids;
}
