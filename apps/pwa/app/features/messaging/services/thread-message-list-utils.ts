/**
 * Pure message-list helpers (identity merge + suppression).
 * Shared by dm-kernel stub, thread-history adapters, and legacy materialization.
 */
import type { Message } from "../types";
import { isMessageIdentityInSuppressedIdSet } from "./conversation-message-visibility";
import { collectMessageIdentityAliases } from "./message-identity-alias-contract";

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
