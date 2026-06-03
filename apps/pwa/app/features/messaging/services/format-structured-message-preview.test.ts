import { describe, expect, it } from "vitest";
import { formatStructuredMessagePreview } from "./format-structured-message-preview";

describe("formatStructuredMessagePreview", () => {
  it("returns null for plain text", () => {
    expect(formatStructuredMessagePreview("hello")).toBeNull();
  });

  it("labels community invite JSON", () => {
    expect(formatStructuredMessagePreview('{"type":"community-invite","groupId":"g1"}'))
      .toBe("Community invitation");
  });

  it("labels unknown structured types", () => {
    expect(formatStructuredMessagePreview('{"type":"custom-event"}'))
      .toBe("System: custom-event");
  });
});
