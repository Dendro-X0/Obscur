import { describe, expect, it } from "vitest";
import type { Attachment } from "../types";
import { isVoiceNoteAttachment, shouldCacheAttachmentInVault } from "./attachment-storage-policy";

describe("attachment-storage-policy", () => {
  it("marks explicit voice_note kind as non-cacheable", () => {
    const attachment: Attachment = {
      kind: "voice_note",
      url: "https://cdn.example.com/voice-note-1.webm",
      contentType: "audio/webm",
      fileName: "voice-note-1.webm",
    };

    expect(isVoiceNoteAttachment(attachment)).toBe(true);
    expect(shouldCacheAttachmentInVault(attachment)).toBe(false);
  });

  it("marks legacy voice-note filename as non-cacheable", () => {
    const attachment: Attachment = {
      kind: "audio",
      url: "https://cdn.example.com/voice-note-1774249000000-d12.webm",
      contentType: "audio/webm",
      fileName: "voice-note-1774249000000-d12.webm",
    };

    expect(isVoiceNoteAttachment(attachment)).toBe(true);
    expect(shouldCacheAttachmentInVault(attachment)).toBe(false);
  });

  it("keeps normal audio cacheable", () => {
    const attachment: Attachment = {
      kind: "audio",
      url: "https://cdn.example.com/music.mp3",
      contentType: "audio/mpeg",
      fileName: "music.mp3",
    };

    expect(isVoiceNoteAttachment(attachment)).toBe(false);
    expect(shouldCacheAttachmentInVault(attachment)).toBe(true);
  });
});
