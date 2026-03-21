import type { Conversation, UnreadByConversationId } from "../types";

const hasOwn = (value: Readonly<Record<string, unknown>>, key: string): boolean => (
  Object.prototype.hasOwnProperty.call(value, key)
);

const normalizeRelayUrl = (relayUrl: string | null | undefined): string => {
  const trimmed = (relayUrl ?? "").trim();
  if (!trimmed) {
    return "";
  }
  return trimmed.endsWith("/") ? trimmed.slice(0, -1) : trimmed;
};

const toRelayHost = (relayUrl: string): string | null => {
  const normalized = normalizeRelayUrl(relayUrl);
  if (!normalized) {
    return null;
  }
  if (!normalized.startsWith("ws://") && !normalized.startsWith("wss://")) {
    return null;
  }
  try {
    return new URL(normalized).host;
  } catch {
    return null;
  }
};

export const resolveSelectedConversationUnreadKeys = (
  selectedConversation: Conversation,
): ReadonlyArray<string> => {
  const keys = new Set<string>();
  const add = (value: string | null | undefined): void => {
    const trimmed = (value ?? "").trim();
    if (!trimmed) {
      return;
    }
    keys.add(trimmed);
  };

  add(selectedConversation.id);
  if (selectedConversation.kind !== "group") {
    return Array.from(keys);
  }

  const normalizedRelayUrl = normalizeRelayUrl(selectedConversation.relayUrl);
  const normalizedCommunityId = (selectedConversation.communityId ?? "").trim();
  if (normalizedCommunityId) {
    add(normalizedCommunityId);
    add(`community:${normalizedCommunityId}`);
  }
  if (selectedConversation.groupId.trim() && normalizedRelayUrl) {
    add(`community:${selectedConversation.groupId.trim()}:${normalizedRelayUrl}`);
    add(`group:${selectedConversation.groupId.trim()}:${normalizedRelayUrl}`);
    const relayHost = toRelayHost(normalizedRelayUrl);
    if (relayHost) {
      add(`${selectedConversation.groupId.trim()}@${relayHost}`);
    }
  }

  return Array.from(keys);
};

export const applySelectedConversationUnreadIsolation = (params: Readonly<{
  currentUnreadByConversationId: UnreadByConversationId;
  selectedConversation: Conversation | null;
}>): UnreadByConversationId | null => {
  if (!params.selectedConversation) {
    return null;
  }
  const keys = resolveSelectedConversationUnreadKeys(params.selectedConversation);
  if (keys.length === 0) {
    return null;
  }
  const primaryKey = keys[0];
  const current = params.currentUnreadByConversationId;
  let next: Record<string, number> | null = null;

  const upsertZero = (key: string): void => {
    if (!next) {
      next = { ...current };
    }
    next[key] = 0;
  };

  keys.forEach((key) => {
    const value = current[key] ?? 0;
    if (hasOwn(current, key)) {
      if (value !== 0) {
        upsertZero(key);
      }
      return;
    }
    if (key === primaryKey) {
      // Anchor selected target unread explicitly so UI never falls back to stale conversation.unreadCount.
      upsertZero(key);
    }
  });

  return next;
};
