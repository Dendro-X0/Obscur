
import type { Conversation, ConnectionOverridesByConnectionId, Message, ReactionEmoji, ReactionsByEmoji, Attachment } from "../types";

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

export const applyConnectionOverrides = (
    conversation: Conversation,
    overridesByConnectionId: ConnectionOverridesByConnectionId
): Conversation => {
    if (conversation.kind === "group") {
        return conversation;
    }
    const overrides: Readonly<{ lastMessage: string; lastMessageTime: Date }> | undefined =
        overridesByConnectionId[conversation.id];
    if (!overrides) {
        return conversation;
    }
    return {
        ...conversation,
        lastMessage: overrides.lastMessage,
        lastMessageTime: overrides.lastMessageTime,
    };
};

export const isVisibleUserMessage = (m: Message): boolean => m.kind === "user" && !m.deletedAt;

const IMAGE_EXTENSIONS = ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.svg'];
const VIDEO_EXTENSIONS = ['.mp4', '.webm', '.mov', '.m4v', '.ogv'];
const AUDIO_EXTENSIONS = ['.mp3', '.wav', '.m4a', '.ogg', '.aac', '.flac', '.opus'];
const IMAGE_HOSTS = ['image.nostr.build', 'nostr.build', 'blossom.', 'imgprxy.', 'void.cat'];

export const extractAttachmentsFromContent = (content: string): Attachment[] => {
    const urlRegex = /(https?:\/\/[^\s]+|\/uploads\/[^\s]+)/g;
    const matches = content.match(urlRegex);

    if (!matches) return [];

    const attachments: Attachment[] = [];

    for (const url of matches) {
        // Clean trailing punctuation that might be captured
        const cleanUrl = url.replace(/[.,;:!?)]+$/, '');
        const lowerUrl = cleanUrl.toLowerCase();

        // 1. Audio check
        const isAudio = AUDIO_EXTENSIONS.some(ext => lowerUrl.endsWith(ext) || lowerUrl.includes(ext + "?"));
        if (isAudio) {
            attachments.push({
                kind: 'audio',
                url: cleanUrl,
                contentType: 'audio/*',
                fileName: cleanUrl.split('/').pop()?.split('?')[0] || 'audio'
            });
            continue;
        }

        // 2. Video check
        const isVideo = VIDEO_EXTENSIONS.some(ext => lowerUrl.endsWith(ext) || lowerUrl.includes(ext + "?"));
        if (isVideo) {
            attachments.push({
                kind: 'video',
                url: cleanUrl,
                contentType: 'video/*',
                fileName: cleanUrl.split('/').pop()?.split('?')[0] || 'video'
            });
            continue;
        }

        // 3. Image check (Extension or Host)
        const isImageExt = IMAGE_EXTENSIONS.some(ext => lowerUrl.endsWith(ext) || lowerUrl.includes(ext + "?"));
        const isKnownImageHost = IMAGE_HOSTS.some(host => lowerUrl.includes(host));

        if (isImageExt || isKnownImageHost) {
            attachments.push({
                kind: 'image',
                url: cleanUrl,
                contentType: 'image/*',
                fileName: cleanUrl.split('/').pop()?.split('?')[0] || 'image'
            });
        }
    }

    return attachments;
};
