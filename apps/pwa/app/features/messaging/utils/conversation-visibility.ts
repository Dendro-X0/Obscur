import { isGroupConversationId } from "@/app/features/groups/utils/group-conversation-id";

export const removeGroupConversationIdsFromHidden = (
    hiddenChatIds: ReadonlyArray<string>
): ReadonlyArray<string> => {
    return hiddenChatIds.filter((conversationId) => !isGroupConversationId(conversationId));
};

export const removeConversationIdFromHidden = (
    hiddenChatIds: ReadonlyArray<string>,
    conversationId: string
): ReadonlyArray<string> => {
    const normalizedConversationId = conversationId.trim();
    if (!normalizedConversationId) {
        return hiddenChatIds;
    }
    if (!hiddenChatIds.includes(normalizedConversationId)) {
        return hiddenChatIds;
    }
    return hiddenChatIds.filter((existingConversationId) => existingConversationId !== normalizedConversationId);
};
