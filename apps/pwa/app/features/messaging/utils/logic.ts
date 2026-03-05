
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
const DOCUMENT_EXTENSIONS = ['.pdf', '.txt', '.csv', '.rtf', '.doc', '.docx', '.xls', '.xlsx', '.ppt', '.pptx', '.odt', '.ods', '.odp'];
const IMAGE_HOSTS = ['image.nostr.build', 'nostr.build', 'blossom.', 'imgprxy.', 'void.cat'];

export const inferAttachmentKind = (attachment: Attachment): Attachment["kind"] => {
    const lowerUrl = attachment.url.toLowerCase();
    const lowerContentType = attachment.contentType.toLowerCase();

    if (AUDIO_EXTENSIONS.some(ext => lowerUrl.endsWith(ext) || lowerUrl.includes(ext + "?")) || lowerContentType.startsWith("audio/")) {
        return "audio";
    }
    if (VIDEO_EXTENSIONS.some(ext => lowerUrl.endsWith(ext) || lowerUrl.includes(ext + "?")) || lowerContentType.startsWith("video/")) {
        return "video";
    }
    if (IMAGE_EXTENSIONS.some(ext => lowerUrl.endsWith(ext) || lowerUrl.includes(ext + "?")) || lowerContentType.startsWith("image/")) {
        return "image";
    }
    if (
        DOCUMENT_EXTENSIONS.some(ext => lowerUrl.endsWith(ext) || lowerUrl.includes(ext + "?")) ||
        lowerContentType.startsWith("application/") ||
        lowerContentType.startsWith("text/")
    ) {
        return "file";
    }

    return attachment.kind;
};

export const extractAttachmentsFromContent = (content: string): Attachment[] => {
    // Match either [filename](url) or just url
    const urlRegex = /(?:\[(.*?)\]\((https?:\/\/[^\s)]+|\/uploads\/[^\s)]+)\))|(https?:\/\/[^\s]+|\/uploads\/[^\s]+)/g;
    const matches = Array.from(content.matchAll(urlRegex));

    if (matches.length === 0) return [];

    const attachments: Attachment[] = [];

    for (const match of matches) {
        const rawUrl = match[2] || match[3];
        if (!rawUrl) continue;

        const providedName = match[1]; // from markdown [name](url)

        // Clean trailing punctuation that might be captured in plain URLs
        const cleanUrl = match[3] ? rawUrl.replace(/[.,;:!?)]+$/, '') : rawUrl;
        const lowerUrl = cleanUrl.toLowerCase();

        const fallbackName = cleanUrl.split('/').pop()?.split('?')[0] || 'file';
        const finalName = providedName || fallbackName;

        // 1. Audio check
        const isAudio = AUDIO_EXTENSIONS.some(ext => lowerUrl.endsWith(ext) || lowerUrl.includes(ext + "?"));
        if (isAudio) {
            attachments.push({
                kind: 'audio',
                url: cleanUrl,
                contentType: 'audio/*',
                fileName: finalName
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
                fileName: finalName
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
                fileName: finalName
            });
            continue;
        }

        // 4. Document or generic uploaded file check
        const isDocument = DOCUMENT_EXTENSIONS.some(ext => lowerUrl.endsWith(ext) || lowerUrl.includes(ext + "?"));
        const looksLikeUploadPath = lowerUrl.includes("/uploads/");
        if (isDocument || looksLikeUploadPath) {
            attachments.push({
                kind: "file",
                url: cleanUrl,
                contentType: "application/octet-stream",
                fileName: finalName
            });
        }
    }

    return attachments;
};
