
import type { Conversation, ContactOverridesByContactId, Message, ReactionEmoji, ReactionsByEmoji, Attachment } from "../types";

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

const IMAGE_EXTENSIONS = ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.svg'];
const VIDEO_EXTENSIONS = ['.mp4', '.webm', '.mov'];

export const extractAttachmentFromContent = (content: string): Attachment | undefined => {
    const urlRegex = /(https?:\/\/[^\s]+)/g;
    const matches = content.match(urlRegex);

    if (!matches) return undefined;

    for (const url of matches) {
        const lowerUrl = url.toLowerCase();

        // Simple extension check
        const isImage = IMAGE_EXTENSIONS.some(ext => lowerUrl.endsWith(ext) || lowerUrl.includes(ext + "?"));
        if (isImage) {
            return {
                kind: 'image',
                url: url,
                contentType: 'image/*',
                fileName: url.split('/').pop()?.split('?')[0] || 'image'
            };
        }

        const isVideo = VIDEO_EXTENSIONS.some(ext => lowerUrl.endsWith(ext) || lowerUrl.includes(ext + "?"));
        if (isVideo) {
            return {
                kind: 'video',
                url: url,
                contentType: 'video/*',
                fileName: url.split('/').pop()?.split('?')[0] || 'video'
            };
        }
    }

    return undefined;
};
