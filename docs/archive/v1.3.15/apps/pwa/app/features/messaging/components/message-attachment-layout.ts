import type { Attachment } from "../types";
import { inferAttachmentKind } from "../utils/logic";
import { normalizeLocalMediaDisplayFileName } from "@/app/features/vault/services/local-media-store";
import {
    getVoiceNoteAttachmentMetadata,
    type VoiceNoteAttachmentMetadata,
} from "@/app/features/messaging/services/voice-note-metadata";

export type VisualAttachment = Readonly<{
    attachment: Attachment;
    kind: "image" | "video";
}>;

export type AttachmentBuckets = Readonly<{
    visualMedia: ReadonlyArray<VisualAttachment>;
    imageMedia: ReadonlyArray<Attachment>;
    videoMedia: ReadonlyArray<Attachment>;
    audios: ReadonlyArray<Attachment>;
    others: ReadonlyArray<Attachment>;
}>;

export const buildAttachmentBuckets = (
    attachments: ReadonlyArray<Attachment>,
): AttachmentBuckets => {
    const visualMedia: VisualAttachment[] = [];
    const imageMedia: Attachment[] = [];
    const videoMedia: Attachment[] = [];
    const audios: Attachment[] = [];
    const others: Attachment[] = [];

    attachments.forEach((attachment) => {
        const kind = inferAttachmentKind(attachment);
        if (kind === "image") {
            visualMedia.push({ attachment, kind });
            imageMedia.push(attachment);
            return;
        }
        if (kind === "video") {
            visualMedia.push({ attachment, kind });
            videoMedia.push(attachment);
            return;
        }
        if (kind === "audio" || kind === "voice_note") {
            audios.push(attachment);
            return;
        }
        others.push(attachment);
    });

    return {
        visualMedia,
        imageMedia,
        videoMedia,
        audios,
        others,
    };
};

export type AttachmentPresentation = Readonly<{
    displayNameByUrl: Readonly<Record<string, string>>;
    hostByUrl: Readonly<Record<string, string>>;
    voiceNoteMetadataByUrl: Readonly<Record<string, VoiceNoteAttachmentMetadata>>;
}>;

const parseUrlHost = (url: string): string | null => {
    try {
        const host = new URL(url).host.trim();
        return host.length > 0 ? host : null;
    } catch {
        return null;
    }
};

export const buildAttachmentPresentation = (params: Readonly<{
    attachments: ReadonlyArray<Attachment>;
    localAttachmentFileNameByUrl: Readonly<Record<string, string>>;
    fallbackFileLabel: string;
}>): AttachmentPresentation => {
    const displayNameByUrl: Record<string, string> = {};
    const hostByUrl: Record<string, string> = {};
    const voiceNoteMetadataByUrl: Record<string, VoiceNoteAttachmentMetadata> = {};

    params.attachments.forEach((attachment) => {
        const localName = params.localAttachmentFileNameByUrl[attachment.url];
        const normalizedLocalName = localName?.trim()
            ? normalizeLocalMediaDisplayFileName(localName)
            : null;
        const normalizedAttachmentName = attachment.fileName?.trim()
            ? normalizeLocalMediaDisplayFileName(attachment.fileName)
            : null;
        const host = parseUrlHost(attachment.url);

        displayNameByUrl[attachment.url] = normalizedLocalName
            ?? normalizedAttachmentName
            ?? host
            ?? params.fallbackFileLabel;

        hostByUrl[attachment.url] = host ?? attachment.url;
        voiceNoteMetadataByUrl[attachment.url] = getVoiceNoteAttachmentMetadata({
            kind: attachment.kind,
            fileName: attachment.fileName,
            contentType: attachment.contentType,
        });
    });

    return {
        displayNameByUrl,
        hostByUrl,
        voiceNoteMetadataByUrl,
    };
};
