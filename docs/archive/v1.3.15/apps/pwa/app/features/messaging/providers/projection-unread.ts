import type { DmConversation, UnreadByConversationId } from "../types";

const normalizeUnreadCount = (count: number): number => {
    if (!Number.isFinite(count) || count < 0) {
        return 0;
    }
    return Math.floor(count);
};

export const buildProjectionUnreadByConversationId = (
    projectionConnections: ReadonlyArray<DmConversation>,
    selectedConversationId: string | null
): UnreadByConversationId => {
    const unreadByConversation: Record<string, number> = {};
    projectionConnections.forEach((conversation) => {
        unreadByConversation[conversation.id] = (
            selectedConversationId === conversation.id
                ? 0
                : normalizeUnreadCount(conversation.unreadCount)
        );
    });
    return unreadByConversation;
};

export const mergeProjectionUnreadByConversationId = (params: Readonly<{
    currentUnreadByConversationId: UnreadByConversationId;
    projectionConnections: ReadonlyArray<DmConversation>;
    selectedConversationId: string | null;
    selectedConversationKind?: "dm" | "group" | null;
    lastSeenByConversationId?: Readonly<Record<string, number>>;
}>): UnreadByConversationId => {
    const next: Record<string, number> = { ...params.currentUnreadByConversationId };
    params.projectionConnections.forEach((conversation) => {
        if (params.selectedConversationKind === "group") {
            // Keep DM unread state stable while user is actively in a community chat.
            next[conversation.id] = normalizeUnreadCount(next[conversation.id] ?? 0);
            return;
        }
        const lastSeenAtMs = params.lastSeenByConversationId?.[conversation.id] ?? 0;
        const lastMessageAtMs = conversation.lastMessageTime.getTime();
        const hasSeenConversationHead = lastSeenAtMs > 0
            && Number.isFinite(lastSeenAtMs)
            && Number.isFinite(lastMessageAtMs)
            && lastSeenAtMs >= lastMessageAtMs;
        next[conversation.id] = (
            params.selectedConversationId === conversation.id || hasSeenConversationHead
                ? 0
                : normalizeUnreadCount(conversation.unreadCount)
        );
    });
    return next;
};

export const unreadByConversationIdEqual = (
    left: UnreadByConversationId,
    right: UnreadByConversationId
): boolean => {
    const leftKeys = Object.keys(left);
    if (leftKeys.length !== Object.keys(right).length) {
        return false;
    }
    return leftKeys.every((key) => left[key] === right[key]);
};
