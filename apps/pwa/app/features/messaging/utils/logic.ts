
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
const IMAGE_HOSTS = ['image.nostr.build', 'nostr.build', 'blossom.', 'imgprxy.', 'void.cat'];

export const extractAttachmentsFromContent = (content: string): Attachment[] => {
    const urlRegex = /(https?:\/\/[^\s]+)/g;
    const matches = content.match(urlRegex);

    if (!matches) return [];

    const attachments: Attachment[] = [];

    for (const url of matches) {
        // Clean trailing punctuation that might be captured
        const cleanUrl = url.replace(/[.,;:!?)]+$/, '');
        const lowerUrl = cleanUrl.toLowerCase();

        // Host-based detection for known image services
        const isKnownImageHost = IMAGE_HOSTS.some(host => lowerUrl.includes(host));

        // Simple extension check
        const isImage = IMAGE_EXTENSIONS.some(ext => lowerUrl.endsWith(ext) || lowerUrl.includes(ext + "?"));
        if (isImage || isKnownImageHost) {
            attachments.push({
                kind: 'image',
                url: cleanUrl,
                contentType: 'image/*',
                fileName: cleanUrl.split('/').pop()?.split('?')[0] || 'image'
            });
            continue;
        }

        const isVideo = VIDEO_EXTENSIONS.some(ext => lowerUrl.endsWith(ext) || lowerUrl.includes(ext + "?"));
        if (isVideo) {
            attachments.push({
                kind: 'video',
                url: cleanUrl,
                contentType: 'video/*',
                fileName: cleanUrl.split('/').pop()?.split('?')[0] || 'video'
            });
        }
    }

    return attachments;
};
