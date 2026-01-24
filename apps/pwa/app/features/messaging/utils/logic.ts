
import type { Conversation, ContactOverridesByContactId, Message, ReactionEmoji, ReactionsByEmoji } from "../types";

export const createEmptyReactions = (): Record<ReactionEmoji, number> => ({
    "👍": 0,
    "❤️": 0,
    "😂": 0,
    "🔥": 0,
    "👏": 0,
});

export const toReactionsByEmoji = (value: Record<ReactionEmoji, number>): ReactionsByEmoji => ({
    "👍": value["👍"],
    "❤️": value["❤️"],
    "😂": value["😂"],
    "🔥": value["🔥"],
    "👏": value["👏"],
});

export const applyContactOverrides = (
    conversation: Conversation,
    overridesByContactId: ContactOverridesByContactId
): Conversation => {
    if (conversation.kind === "group") {
        return conversation;
    }
    const overrides: Readonly<{ lastMessage: string; lastMessageTime: Date }> | undefined =
        overridesByContactId[conversation.id];
    if (!overrides) {
        return conversation;
    }
    return {
        ...conversation,
        lastMessage: overrides.lastMessage,
        lastMessageTime: overrides.lastMessageTime,
    };
};

export const isVisibleUserMessage = (message: Message): boolean => message.kind === "user";
