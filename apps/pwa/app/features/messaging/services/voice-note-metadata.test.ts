import { describe, expect, it } from "vitest";
import {
  buildVoiceNoteSearchTokens,
  formatVoiceNoteRecordedAtLabel,
  formatVoiceNoteDurationLabel,
  getVoiceNoteAttachmentMetadata,
  parseVoiceNoteFileName,
} from "./voice-note-metadata";

describe("voice-note-metadata", () => {
  it("parses strict voice-note filename with duration payload", () => {
    const parsed = parseVoiceNoteFileName("voice-note-1774249000000-d83.webm");
    expect(parsed).toEqual({
      isVoiceNote: true,
      recordedAtUnixMs: 1774249000000,
      durationSeconds: 83,
      durationLabel: "1:23",
    });
  });

  it("marks loose voice-note filename as voice note even when metadata suffix is missing", () => {
    const parsed = parseVoiceNoteFileName("voice-note-legacy.webm");
    expect(parsed).toEqual({
      isVoiceNote: true,
      recordedAtUnixMs: null,
      durationSeconds: null,
      durationLabel: null,
    });
  });

  it("returns non-voice metadata for regular audio attachments", () => {
    const metadata = getVoiceNoteAttachmentMetadata({
      kind: "audio",
      fileName: "podcast-episode-4.mp3",
      contentType: "audio/mpeg",
    });
    expect(metadata.isVoiceNote).toBe(false);
    expect(metadata.durationSeconds).toBeNull();
  });

  it("builds stable search tokens for parsed voice-note metadata", () => {
    const metadata = parseVoiceNoteFileName("voice-note-1774249000000-d12.ogg");
    const tokens = buildVoiceNoteSearchTokens(metadata);
    expect(tokens).toEqual(expect.arrayContaining([
      "voice",
      "voice note",
      "audio note",
      "duration 12s",
      "duration 12 sec",
      "0:12",
      "1774249000000",
    ]));
  });

  it("formats duration labels for sub-minute and multi-minute voice notes", () => {
    expect(formatVoiceNoteDurationLabel(5)).toBe("0:05");
    expect(formatVoiceNoteDurationLabel(125)).toBe("2:05");
  });

  it("formats recorded-at labels for valid unix-ms timestamps", () => {
    const label = formatVoiceNoteRecordedAtLabel(1774249000000);
    expect(typeof label).toBe("string");
    expect(label).toBeTruthy();
  });

  it("returns null for invalid recorded-at timestamps", () => {
    expect(formatVoiceNoteRecordedAtLabel(-10)).toBeNull();
    expect(formatVoiceNoteRecordedAtLabel(Number.NaN)).toBeNull();
  });
});
