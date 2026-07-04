import { describe, expect, it } from "vitest";
import type { Attachment } from "../types";
import { applyConnectionOverrides, extractAttachmentsFromContent, inferAttachmentKind } from "./logic";
import type { DmConversation } from "../types";

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

  it("extracts adjacent markdown image links with scheme-less nostr.build urls", () => {
    const content = [
      "[dan-freeman-wAn4RfmXtxU-unsplash.jpg](image.nostr.build/6b5397c534f02d06ea2542ed52861e191bebbff169e3cee92c2d587118d68f38.jpg)",
      "[garrett-parker-DlkF4-dbCOU-unsplash.jpg](image.nostr.build/b68455576647a2dc11a541f46d6ac1a648673a106e511a08d73c5a23ae5f0c4d.jpg)",
    ].join(" ");

    const extracted = extractAttachmentsFromContent(content);

    expect(extracted).toHaveLength(2);
    expect(extracted[0]).toEqual(expect.objectContaining({
      kind: "image",
      fileName: "dan-freeman-wAn4RfmXtxU-unsplash.jpg",
      url: "https://image.nostr.build/6b5397c534f02d06ea2542ed52861e191bebbff169e3cee92c2d587118d68f38.jpg",
    }));
    expect(extracted[1]).toEqual(expect.objectContaining({
      kind: "image",
      fileName: "garrett-parker-DlkF4-dbCOU-unsplash.jpg",
      url: "https://image.nostr.build/b68455576647a2dc11a541f46d6ac1a648673a106e511a08d73c5a23ae5f0c4d.jpg",
    }));
  });
});

describe("applyConnectionOverrides", () => {
  const baseConversation: DmConversation = {
    kind: "dm",
    id: "conv-1",
    pubkey: "b".repeat(64) as DmConversation["pubkey"],
    displayName: "Tester2",
    lastMessage: JSON.stringify({ type: "community-invite-response", status: "accepted", groupId: "g1" }),
    unreadCount: 0,
    lastMessageTime: new Date(5_000),
    lastMessageIsOutgoing: false,
  };

  it("ignores stale optimistic overrides when thread history is newer", () => {
    const result = applyConnectionOverrides(baseConversation, {
      "conv-1": {
        lastMessage: "test",
        lastMessageTime: new Date(1_000),
      },
    });
    expect(result.lastMessage).toBe(baseConversation.lastMessage);
    expect(result.lastMessageTime.getTime()).toBe(5_000);
  });
});
