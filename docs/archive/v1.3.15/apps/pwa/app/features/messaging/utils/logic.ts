
import type { Conversation, ConnectionOverridesByConnectionId, Message, ReactionEmoji, ReactionsByEmoji, Attachment } from "../types";
import { parseVoiceNoteFileName } from "@/app/features/messaging/services/voice-note-metadata";

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

const hasKnownExtension = (value: string, extensions: ReadonlyArray<string>): boolean => (
    extensions.some(ext => value.endsWith(ext) || value.includes(ext + "?"))
);

export const inferAttachmentKind = (attachment: Attachment): Attachment["kind"] => {
    const lowerUrl = attachment.url.toLowerCase();
    const lowerContentType = attachment.contentType.toLowerCase();
    const lowerFileName = attachment.fileName.toLowerCase();
    const isVoiceNoteFileName = parseVoiceNoteFileName(attachment.fileName).isVoiceNote;

    // Voice-note recordings commonly use .webm extensions that collide with video extensions.
    // Preserve explicit voice-note intent before extension inference.
    if (attachment.kind === "voice_note" || isVoiceNoteFileName) {
        return "voice_note";
    }

    if (attachment.kind === "audio" && lowerContentType.startsWith("audio/")) {
        return "audio";
    }

    if (hasKnownExtension(lowerFileName, AUDIO_EXTENSIONS)) {
        return "audio";
    }
    if (hasKnownExtension(lowerFileName, VIDEO_EXTENSIONS)) {
        return "video";
    }
    if (hasKnownExtension(lowerFileName, IMAGE_EXTENSIONS)) {
        return "image";
    }
    if (hasKnownExtension(lowerFileName, DOCUMENT_EXTENSIONS)) {
        return "file";
    }

    if (hasKnownExtension(lowerUrl, AUDIO_EXTENSIONS) || lowerContentType.startsWith("audio/")) {
        return "audio";
    }
    if (hasKnownExtension(lowerUrl, VIDEO_EXTENSIONS) || lowerContentType.startsWith("video/")) {
        return "video";
    }
    if (hasKnownExtension(lowerUrl, IMAGE_EXTENSIONS) || lowerContentType.startsWith("image/")) {
        return "image";
    }
    if (
        hasKnownExtension(lowerUrl, DOCUMENT_EXTENSIONS) ||
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
        const lowerFileName = finalName.toLowerCase();
        const isVoiceNoteFileName = parseVoiceNoteFileName(finalName).isVoiceNote;

        if (isVoiceNoteFileName) {
            attachments.push({
                kind: "voice_note",
                url: cleanUrl,
                contentType: "audio/*",
                fileName: finalName
            });
            continue;
        }

        // 1. Audio check (filename first, then url)
        const isAudio = hasKnownExtension(lowerFileName, AUDIO_EXTENSIONS) || hasKnownExtension(lowerUrl, AUDIO_EXTENSIONS);
        if (isAudio) {
            attachments.push({
                kind: 'audio',
                url: cleanUrl,
                contentType: 'audio/*',
                fileName: finalName
            });
            continue;
        }

        // 2. Video check (filename first, then url)
        const isVideo = hasKnownExtension(lowerFileName, VIDEO_EXTENSIONS) || hasKnownExtension(lowerUrl, VIDEO_EXTENSIONS);
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
        const isImageExt = hasKnownExtension(lowerFileName, IMAGE_EXTENSIONS) || hasKnownExtension(lowerUrl, IMAGE_EXTENSIONS);
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
        const isDocument = hasKnownExtension(lowerFileName, DOCUMENT_EXTENSIONS) || hasKnownExtension(lowerUrl, DOCUMENT_EXTENSIONS);
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
