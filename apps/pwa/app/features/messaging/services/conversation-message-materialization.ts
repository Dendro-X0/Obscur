/**
 * R1 — Ordered merge of message layers by identity (id + eventId).
 *
 * Two semantics are intentional:
 * - **Projection-first:** account projection is authoritative for id/eventId keys; in-memory
 *   overlay refreshes same id and may add rows unless eventId already maps to a different id.
 * - **Hydrated-first:** IndexedDB / authority-selected base is authoritative on id; live overlay
 *   only adds rows that do not collide on id or on base-layer eventId (optimistic vs persisted).
 */

import type { Message } from "../types";
import type { ConversationHistoryAuthorityDecision } from "./dm-read-authority-contract";
import { isMessageIdentityInSuppressedIdSet } from "./conversation-message-visibility";
import { collectMessageIdentityAliases } from "./message-identity-alias-contract";

export type MessageConversationScopePredicate = (message: Message) => boolean;

/**
 * Merge projection (or any preferred-first layer) with an in-memory overlay.
 * Overlay rows outside `isMessageInConversationScope` are ignored.
 */
export const mergeProjectionFirstWithOverlayMessages = (
  preferredFirst: ReadonlyArray<Message>,
  overlay: ReadonlyArray<Message>,
  isMessageInConversationScope: MessageConversationScopePredicate,
): Message[] => {
  const byId = new Map<string, Message>();
  const eventIdToKey = new Map<string, string>();
  preferredFirst.forEach((message) => {
    byId.set(message.id, message);
    if (message.eventId) {
      eventIdToKey.set(message.eventId, message.id);
    }
  });
  overlay.forEach((message) => {
    if (!isMessageInConversationScope(message)) {
      return;
    }
    const existingKey = message.eventId ? eventIdToKey.get(message.eventId) : undefined;
    if (existingKey && existingKey !== message.id) {
      return;
    }
    byId.set(message.id, message);
    if (message.eventId) {
      eventIdToKey.set(message.eventId, message.id);
    }
  });
  return Array.from(byId.values());
};

/**
 * Merge a hydrated/authority base with a live in-memory overlay without overwriting base ids.
 * Overlay must belong to `overlayConversationScope` (trimmed conversation ids).
 */
export const mergeHydratedBaseWithLiveOverlayMessages = (
  baseHydrated: ReadonlyArray<Message>,
  liveOverlay: ReadonlyArray<Message>,
  overlayConversationScope: ReadonlySet<string>,
): Message[] => {
  const byId = new Map<string, Message>();
  const baseEventIds = new Set<string>();
  baseHydrated.forEach((m) => {
    byId.set(m.id, m);
    if (m.eventId) {
      baseEventIds.add(m.eventId);
    }
  });
  liveOverlay.forEach((m) => {
    const msgCid = typeof m.conversationId === "string" ? m.conversationId.trim() : "";
    if (msgCid && !overlayConversationScope.has(msgCid)) {
      return;
    }
    if (!byId.has(m.id) && !(m.eventId && baseEventIds.has(m.eventId))) {
      byId.set(m.id, m);
    }
  });
  return Array.from(byId.values());
};

export const filterMessagesBySuppressedIds = (
  messages: ReadonlyArray<Message>,
  suppressedIds: ReadonlySet<string>,
): Message[] => messages.filter((message) => {
  if (isMessageIdentityInSuppressedIdSet(message, suppressedIds)) {
    return false;
  }
  return !collectMessageIdentityAliases(message).some((alias) => suppressedIds.has(alias));
});

/**
 * Maps **`resolveConversationHistoryAuthority`** output to exactly one message layer
 * (projection vs IndexedDB-hydrated vs chat-state persisted). Does not cap or merge live overlay.
 */
export const selectMessagesForConversationHistoryAuthority = (
  decision: ConversationHistoryAuthorityDecision,
  layers: Readonly<{
    projection: ReadonlyArray<Message>;
    persisted: ReadonlyArray<Message>;
    indexed: ReadonlyArray<Message>;
  }>,
): ReadonlyArray<Message> => {
  if (decision.authority === "projection") {
    return layers.projection;
  }
  if (decision.authority === "persisted") {
    return layers.persisted;
  }
  return layers.indexed;
};

/** When count exceeds `limit`, keep the last `limit` messages (newest tail). */
export const capMessageListToSoftLiveWindow = (
  messages: ReadonlyArray<Message>,
  limit: number,
): ReadonlyArray<Message> => {
  const cap = Math.floor(limit);
  if (!Number.isFinite(cap) || cap <= 0 || messages.length <= cap) {
    return messages;
  }
  return messages.slice(-cap);
};
