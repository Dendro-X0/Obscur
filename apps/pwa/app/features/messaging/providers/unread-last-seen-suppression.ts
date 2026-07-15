import type {
  Conversation,
  PersistedChatState,
  UnreadByConversationId,
} from "../types";
import { resolveSelectedConversationUnreadKeys } from "./unread-isolation";

const normalizeUnreadCount = (count: number): number => {
  if (!Number.isFinite(count) || count < 0) {
    return 0;
  }
  return Math.floor(count);
};

export const hasSeenConversationHead = (
  lastSeenAtMs: number,
  lastMessageAtMs: number,
): boolean => (
  lastSeenAtMs > 0
  && Number.isFinite(lastSeenAtMs)
  && Number.isFinite(lastMessageAtMs)
  && lastSeenAtMs >= lastMessageAtMs
);

export const resolveLastSeenAtMsForConversation = (
  conversation: Conversation,
  lastSeenByConversationId?: Readonly<Record<string, number>>,
): number => {
  const keys = conversation.kind === "group"
    ? resolveSelectedConversationUnreadKeys(conversation)
    : [conversation.id];
  return keys.reduce(
    (max, key) => Math.max(max, lastSeenByConversationId?.[key] ?? 0),
    0,
  );
};

export const buildConversationHeadAtMsByIdFromPersisted = (
  persisted: PersistedChatState,
): Readonly<Record<string, number>> => {
  const heads: Record<string, number> = {};

  const setHead = (conversationId: string, lastMessageAtMs: number): void => {
    const trimmed = conversationId.trim();
    if (!trimmed || !Number.isFinite(lastMessageAtMs) || lastMessageAtMs <= 0) {
      return;
    }
    heads[trimmed] = Math.max(heads[trimmed] ?? 0, lastMessageAtMs);
  };

  persisted.createdConnections.forEach((connection) => {
    setHead(connection.id, Number(connection.lastMessageTimeMs ?? 0));
  });

  (persisted.createdGroups ?? []).forEach((group) => {
    setHead(group.id, Number(group.lastMessageTimeMs ?? 0));
  });

  Object.entries(persisted.groupMessages ?? {}).forEach(([conversationId, messages]) => {
    messages.forEach((message) => {
      setHead(conversationId, Number(message.created_at) * 1000);
    });
  });

  Object.entries(persisted.messagesByConversationId ?? {}).forEach(([conversationId, messages]) => {
    messages.forEach((message) => {
      setHead(conversationId, Number(message.timestampMs ?? 0));
    });
  });

  return heads;
};

export const suppressUnreadByLastSeen = (params: Readonly<{
  unreadByConversationId: UnreadByConversationId;
  lastSeenByConversationId: Readonly<Record<string, number>>;
  conversationHeadAtMsById?: Readonly<Record<string, number>>;
  conversations?: ReadonlyArray<Conversation>;
}>): UnreadByConversationId => {
  const next: Record<string, number> = { ...params.unreadByConversationId };
  const heads = params.conversationHeadAtMsById ?? {};

  Object.entries(next).forEach(([conversationId, count]) => {
    if (normalizeUnreadCount(count) <= 0) {
      return;
    }
    const headAtMs = heads[conversationId];
    if (headAtMs === undefined) {
      return;
    }
    const lastSeenAtMs = params.lastSeenByConversationId[conversationId] ?? 0;
    if (hasSeenConversationHead(lastSeenAtMs, headAtMs)) {
      next[conversationId] = 0;
    }
  });

  params.conversations?.forEach((conversation) => {
    const headAtMs = conversation.lastMessageTime.getTime();
    const lastSeenAtMs = resolveLastSeenAtMsForConversation(
      conversation,
      params.lastSeenByConversationId,
    );
    if (hasSeenConversationHead(lastSeenAtMs, headAtMs)) {
      next[conversation.id] = 0;
    }
  });

  return next;
};

export const resolveConversationUnreadCount = (params: Readonly<{
  conversation: Conversation;
  unreadByConversationId: UnreadByConversationId;
  lastSeenByConversationId?: Readonly<Record<string, number>>;
  selectedConversationId?: string | null;
}>): number => {
  if (params.selectedConversationId === params.conversation.id) {
    return 0;
  }

  const lastMessageAtMs = params.conversation.lastMessageTime.getTime();
  const lastSeenAtMs = resolveLastSeenAtMsForConversation(
    params.conversation,
    params.lastSeenByConversationId,
  );
  if (hasSeenConversationHead(lastSeenAtMs, lastMessageAtMs)) {
    return 0;
  }

  const mapCount = params.unreadByConversationId[params.conversation.id];
  if (mapCount !== undefined) {
    return normalizeUnreadCount(mapCount);
  }

  return normalizeUnreadCount(params.conversation.unreadCount);
};

export const mergeUnreadByConversationIdForRestore = (
  current: Readonly<Record<string, number>> | undefined,
  incoming: Readonly<Record<string, number>> | undefined,
): Readonly<Record<string, number>> => ({
  ...(incoming ?? {}),
  ...(current ?? {}),
});
