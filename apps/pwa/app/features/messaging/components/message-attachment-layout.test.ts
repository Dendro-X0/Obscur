import { describe, expect, it } from "vitest";
import type { Attachment } from "../types";
import { buildAttachmentBuckets, buildAttachmentPresentation } from "./message-attachment-layout";

const createAttachment = (overrides: Partial<Attachment>): Attachment => ({
    kind: "file",
    url: "https://cdn.example.com/default.bin",
    contentType: "application/octet-stream",
    fileName: "default.bin",
    ...overrides,
});

describe("message attachment layout utils", () => {
    it("classifies attachments into visual/audio/file buckets in one pass", () => {
        const image = createAttachment({
            kind: "image",
            url: "https://cdn.example.com/a.png",
            contentType: "image/png",
            fileName: "a.png",
        });
        const video = createAttachment({
            kind: "video",
            url: "https://cdn.example.com/b.mp4",
            contentType: "video/mp4",
            fileName: "b.mp4",
        });
        const audio = createAttachment({
            kind: "audio",
            url: "https://cdn.example.com/c.mp3",
            contentType: "audio/mpeg",
            fileName: "c.mp3",
        });
        const file = createAttachment({
            kind: "file",
            url: "https://cdn.example.com/d.pdf",
            contentType: "application/pdf",
            fileName: "d.pdf",
        });

        const buckets = buildAttachmentBuckets([image, video, audio, file]);

        expect(buckets.visualMedia).toEqual([
            { attachment: image, kind: "image" },
            { attachment: video, kind: "video" },
        ]);
        expect(buckets.imageMedia).toEqual([image]);
        expect(buckets.videoMedia).toEqual([video]);
        expect(buckets.audios).toEqual([audio]);
        expect(buckets.others).toEqual([file]);
    });

    it("derives display name and host metadata with stable fallback order", () => {
        const localPreferred = createAttachment({
            kind: "audio",
            url: "https://relay.example.com/voice-note.ogg",
            contentType: "audio/ogg",
            fileName: "remote-name.ogg",
        });
        const attachmentNamePreferred = createAttachment({
            kind: "file",
            url: "https://relay.example.com/archive.zip",
            contentType: "application/zip",
            fileName: "archive.zip",
        });
        const hostFallback = createAttachment({
            kind: "file",
            url: "https://files.example.net/path/without-name",
            contentType: "application/octet-stream",
            fileName: "",
        });
        const invalidUrlFallback = createAttachment({
            kind: "file",
            url: "not-a-valid-url",
            contentType: "application/octet-stream",
            fileName: "",
        });

        const presentation = buildAttachmentPresentation({
            attachments: [localPreferred, attachmentNamePreferred, hostFallback, invalidUrlFallback],
            localAttachmentFileNameByUrl: {
                [localPreferred.url]: "local-voice-note.ogg",
            },
            fallbackFileLabel: "File",
        });

        expect(presentation.displayNameByUrl[localPreferred.url]).toBe("local-voice-note.ogg");
        expect(presentation.displayNameByUrl[attachmentNamePreferred.url]).toBe("archive.zip");
        expect(presentation.displayNameByUrl[hostFallback.url]).toBe("files.example.net");
        expect(presentation.displayNameByUrl[invalidUrlFallback.url]).toBe("File");

        expect(presentation.hostByUrl[localPreferred.url]).toBe("relay.example.com");
        expect(presentation.hostByUrl[invalidUrlFallback.url]).toBe("not-a-valid-url");
        expect(presentation.voiceNoteMetadataByUrl[localPreferred.url]).toEqual({
            isVoiceNote: false,
            recordedAtUnixMs: null,
            durationSeconds: null,
            durationLabel: null,
        });
    });

    it("exposes parsed voice-note metadata for audio attachments", () => {
        const voiceAttachment = createAttachment({
            kind: "audio",
            url: "https://relay.example.com/voice-note-1774249000000-d64.webm",
            contentType: "audio/webm",
            fileName: "voice-note-1774249000000-d64.webm",
        });

        const presentation = buildAttachmentPresentation({
            attachments: [voiceAttachment],
            localAttachmentFileNameByUrl: {},
            fallbackFileLabel: "File",
        });

        expect(presentation.voiceNoteMetadataByUrl[voiceAttachment.url]).toEqual({
            isVoiceNote: true,
            recordedAtUnixMs: 1774249000000,
            durationSeconds: 64,
            durationLabel: "1:04",
        });
    });
});
