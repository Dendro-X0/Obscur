import { describe, expect, it } from "vitest";
import type { Attachment } from "../types";
import { extractAttachmentsFromContent, inferAttachmentKind } from "./logic";

describe("messaging logic attachment inference", () => {
  it("prefers fileName extension when url is extensionless", () => {
    const attachment: Attachment = {
      kind: "video",
      url: "https://nostr.build/i/abcdef1234567890",
      contentType: "video/mp4",
      fileName: "beat-track.mp3",
    };

    expect(inferAttachmentKind(attachment)).toBe("audio");
  });

  it("extracts markdown attachment type from fileName extension when url is extensionless", () => {
    const extracted = extractAttachmentsFromContent(
      "Test [kontraa-no-sleep-hiphop-music-473847.mp3](https://nostr.build/i/abcdef1234567890)"
    );

    expect(extracted).toEqual([
      expect.objectContaining({
        kind: "audio",
        fileName: "kontraa-no-sleep-hiphop-music-473847.mp3",
        url: "https://nostr.build/i/abcdef1234567890",
      }),
    ]);
  });

  it("falls back to image host inference when filename has no known extension", () => {
    const extracted = extractAttachmentsFromContent(
      "photo [cover](https://image.nostr.build/abc123)"
    );

    expect(extracted).toEqual([
      expect.objectContaining({
        kind: "image",
        fileName: "cover",
        url: "https://image.nostr.build/abc123",
      }),
    ]);
  });

  it("treats voice-note prefixed webm attachments as voice_note", () => {
    const attachment: Attachment = {
      kind: "voice_note",
      url: "https://cdn.example.com/voice-note-1774249000000-d64.webm",
      contentType: "audio/webm",
      fileName: "voice-note-1774249000000-d64.webm",
    };

    expect(inferAttachmentKind(attachment)).toBe("voice_note");
  });

  it("extracts voice-note prefixed webm markdown entries as voice_note", () => {
    const extracted = extractAttachmentsFromContent(
      "[voice-note-1774249000000-d12.webm](https://cdn.example.com/voice-note-1774249000000-d12.webm)"
    );

    expect(extracted).toEqual([
      expect.objectContaining({
        kind: "voice_note",
        fileName: "voice-note-1774249000000-d12.webm",
      }),
    ]);
  });

  it("retains extensionless markdown links as media/file attachments when permissive fallback is enabled", () => {
    const extracted = extractAttachmentsFromContent(
      "clip [watch](https://video.nostr.build/i/abcdef123456)",
      { includeGenericLinksAsFiles: true }
    );

    expect(extracted).toEqual([
      expect.objectContaining({
        kind: "video",
        fileName: "watch",
        url: "https://video.nostr.build/i/abcdef123456",
      }),
    ]);
  });
});
