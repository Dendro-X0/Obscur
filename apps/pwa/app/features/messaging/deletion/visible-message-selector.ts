/**
 * Visible Message Selector
 *
 * Core filtering logic for message visibility based on tombstones.
 *
 * Rules:
 * - All message reads go through this selector
 * - Used by DM UI, Community UI, Search, Notifications, Unread counts
 * - Must work during sync restore before UI materialization
 */

import type { MessageTombstone, MessageVisibilityContext } from "./types";
import { messageMatchesIdentityIds } from "./message-identity-resolver";

// ---------------------------------------------------------------------------
// Message Interface (Minimal)
// ---------------------------------------------------------------------------

export interface SelectableMessage {
  id: string;
  eventId?: string;
  conversationId: string;
  senderPubkey: string;
  identityIds?: string[]; // Optional pre-computed aliases
  // Message content not needed for visibility decision
}

// ---------------------------------------------------------------------------
// Selection Result
// ---------------------------------------------------------------------------

export interface VisibleMessageSelection {
  visibleMessages: SelectableMessage[];
  deletedMessageIds: string[]; // IDs of messages that were filtered out
  tombstoneCount: number;
}

// ---------------------------------------------------------------------------
// Core Selection Logic
// ---------------------------------------------------------------------------

/**
 * Select messages that should be visible (not tombstoned).
 *
 * This is the canonical filter for message visibility.
 * All UI rendering should use this or isMessageVisible.
 */
export function selectVisibleMessages(
  messages: SelectableMessage[],
  tombstones: MessageTombstone[],
  context: MessageVisibilityContext
): VisibleMessageSelection {
  const visible: SelectableMessage[] = [];
  const deletedIds: string[] = [];

  for (const message of messages) {
    // Build message identity IDs
    const messageIds = message.identityIds || [
      message.id,
      ...(message.eventId && message.eventId !== message.id ? [message.eventId] : []),
    ];

    // Check if this message is tombstoned
    const isDeleted = isMessageVisibleTombstoned(messageIds, tombstones, context);

    if (isDeleted) {
      deletedIds.push(message.id);
    } else {
      visible.push(message);
    }
  }

  return {
    visibleMessages: visible,
    deletedMessageIds: deletedIds,
    tombstoneCount: tombstones.length,
  };
}

/**
 * Check if a single message should be visible.
 * Returns true if visible (not tombstoned), false if hidden.
 */
export function isMessageVisible(
  message: SelectableMessage,
  tombstones: MessageTombstone[],
  context: MessageVisibilityContext
): boolean {
  const messageIds = message.identityIds || [
    message.id,
    ...(message.eventId && message.eventId !== message.id ? [message.eventId] : []),
  ];

  return !isMessageVisibleTombstoned(messageIds, tombstones, context);
}

/**
 * Internal: Check if message IDs are tombstoned.
 */
function isMessageVisibleTombstoned(
  messageIds: string[],
  tombstones: MessageTombstone[],
  context: MessageVisibilityContext
): boolean {
  for (const tomb of tombstones) {
    // Must be in same conversation
    if (tomb.conversationId !== context.conversationId) {
      continue;
    }

    // Check if any message ID matches tombstone targets
    const matches = tomb.targetMessageIdentityIds.some((id) =>
      messageIds.includes(id)
    );

    if (matches) {
      return true; // Message is tombstoned (hidden)
    }
  }

  return false; // Message is visible
}

// ---------------------------------------------------------------------------
// Tombstone Matching (Diagnostics)
// ---------------------------------------------------------------------------

/**
 * Find which tombstone(s) are hiding a message.
 * Useful for debugging and "why is this message gone?" features.
 */
export function findHidingTombstones(
  message: SelectableMessage,
  tombstones: MessageTombstone[],
  context: MessageVisibilityContext
): MessageTombstone[] {
  const messageIds = message.identityIds || [
    message.id,
    ...(message.eventId && message.eventId !== message.id ? [message.eventId] : []),
  ];

  const hiding: MessageTombstone[] = [];

  for (const tomb of tombstones) {
    if (tomb.conversationId !== context.conversationId) {
      continue;
    }

    const matches = tomb.targetMessageIdentityIds.some((id) =>
      messageIds.includes(id)
    );

    if (matches) {
      hiding.push(tomb);
    }
  }

  return hiding;
}

/**
 * Check if a message was deleted by the current user (Delete for Everyone).
 */
export function isDeletedByCurrentUser(
  message: SelectableMessage,
  tombstones: MessageTombstone[],
  myPublicKeyHex: string
): boolean {
  const messageIds = message.identityIds || [
    message.id,
    ...(message.eventId && message.eventId !== message.id ? [message.eventId] : []),
  ];

  for (const tomb of tombstones) {
    // Only network deletes can be "by current user" (Delete for Everyone)
    if (tomb.scope !== "network") {
      continue;
    }

    // Check if tombstone matches this message
    const matches = tomb.targetMessageIdentityIds.some((id) =>
      messageIds.includes(id)
    );

    if (matches && tomb.deletedByPubkey === myPublicKeyHex) {
      return true;
    }
  }

  return false;
}

/**
 * Check if a message was deleted locally (Delete for Me only).
 */
export function isDeletedForMeOnly(
  message: SelectableMessage,
  tombstones: MessageTombstone[],
  myPublicKeyHex: string
): boolean {
  const messageIds = message.identityIds || [
    message.id,
    ...(message.eventId && message.eventId !== message.id ? [message.eventId] : []),
  ];

  const hidingTombstones = findHidingTombstones(message, tombstones, {
    profileId: "", // Not needed for this check
    conversationId: message.conversationId,
    publicKeyHex: myPublicKeyHex,
  });

  // All hiding tombstones are local-only
  return hidingTombstones.length > 0 && hidingTombstones.every(
    (t) => t.scope === "local"
  );
}

// ---------------------------------------------------------------------------
// Batch Operations
// ---------------------------------------------------------------------------

/**
 * Get all deleted message IDs from a list.
 * Useful for "showing X deleted messages" UI indicators.
 */
export function selectDeletedMessageIds(
  messages: SelectableMessage[],
  tombstones: MessageTombstone[],
  context: MessageVisibilityContext
): string[] {
  const deletedIds: string[] = [];

  for (const message of messages) {
    const messageIds = message.identityIds || [
      message.id,
      ...(message.eventId && message.eventId !== message.id ? [message.eventId] : []),
    ];

    if (isMessageVisibleTombstoned(messageIds, tombstones, context)) {
      deletedIds.push(message.id);
    }
  }

  return deletedIds;
}

/**
 * Filter messages for a specific conversation with tombstone awareness.
 */
export function filterMessagesForConversation(
  allMessages: SelectableMessage[],
  tombstones: MessageTombstone[],
  conversationId: string,
  profileId: string,
  publicKeyHex: string
): SelectableMessage[] {
  const context: MessageVisibilityContext = {
    profileId,
    conversationId,
    publicKeyHex,
  };

  const result = selectVisibleMessages(
    allMessages.filter((m) => m.conversationId === conversationId),
    tombstones,
    context
  );

  return result.visibleMessages;
}

// ---------------------------------------------------------------------------
// Sync/Restore Helpers
// ---------------------------------------------------------------------------

/**
 * Pre-filter messages before UI materialization during sync.
 * This prevents deleted messages from briefly appearing.
 */
export function preFilterMessagesForSync(
  messages: SelectableMessage[],
  tombstones: MessageTombstone[]
): SelectableMessage[] {
  // For sync, we don't need profile context - just check tombstone match
  const visible: SelectableMessage[] = [];

  for (const message of messages) {
    const messageIds = message.identityIds || [
      message.id,
      ...(message.eventId && message.eventId !== message.id ? [message.eventId] : []),
    ];

    // Check if any tombstone matches (regardless of conversation scope)
    const isDeleted = tombstones.some((tomb) =>
      tomb.targetMessageIdentityIds.some((id) => messageIds.includes(id))
    );

    if (!isDeleted) {
      visible.push(message);
    }
  }

  return visible;
}

/**
 * Count tombstones by scope.
 * Useful for diagnostics and sync status.
 */
export function countTombstonesByScope(
  tombstones: MessageTombstone[]
): { local: number; network: number; total: number } {
  return {
    local: tombstones.filter((t) => t.scope === "local").length,
    network: tombstones.filter((t) => t.scope === "network").length,
    total: tombstones.length,
  };
}
