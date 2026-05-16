import { describe, expect, it } from "vitest";
import { toConversationIdDiagnosticLabel } from "./messaging-diagnostics";

describe("toConversationIdDiagnosticLabel", () => {
  it("returns unknown for empty input", () => {
    expect(toConversationIdDiagnosticLabel("")).toBe("unknown");
    expect(toConversationIdDiagnosticLabel("   ")).toBe("unknown");
  });

  it("returns short ids unchanged", () => {
    expect(toConversationIdDiagnosticLabel("dm:abc")).toBe("dm:abc");
  });

  it("redacts long ids", () => {
    const longId = "dm:" + "a".repeat(40);
    expect(toConversationIdDiagnosticLabel(longId)).toMatch(/^dm:aaaa\.\.\./);
  });
});
