import { describe, expect, it } from "vitest";
import { buildMessageSearchIndexText } from "./message-search-index";

describe("message-search-index", () => {
  it("includes message content in searchable index text", () => {
    const indexText = buildMessageSearchIndexText({
      content: "Hello from Obscur",
      attachments: [],
    });
    expect(indexText).toContain("hello from obscur");
  });

  it("indexes voice-note attachment metadata for chat-history search", () => {
    const indexText = buildMessageSearchIndexText({
      content: "",
      attachments: [{
        kind: "audio",
        fileName: "voice-note-1774249000000-d64.webm",
        contentType: "audio/webm",
        url: "https://files.example/voice-note-1774249000000-d64.webm",
      }],
    });
    expect(indexText).toContain("voice note");
    expect(indexText).toContain("duration 64s");
    expect(indexText).toContain("1:04");
  });

  it("indexes attachment names and mime types for generic media/file search", () => {
    const indexText = buildMessageSearchIndexText({
      content: "",
      attachments: [{
        kind: "file",
        fileName: "roadmap-v1.pdf",
        contentType: "application/pdf",
        url: "https://files.example/roadmap-v1.pdf",
      }],
    });
    expect(indexText).toContain("roadmap-v1.pdf");
    expect(indexText).toContain("application/pdf");
  });
});

