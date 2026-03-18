import { isGroupConversationId } from "@/app/features/groups/utils/group-conversation-id";

export const removeGroupConversationIdsFromHidden = (
    hiddenChatIds: ReadonlyArray<string>
): ReadonlyArray<string> => {
    return hiddenChatIds.filter((conversationId) => !isGroupConversationId(conversationId));
};
