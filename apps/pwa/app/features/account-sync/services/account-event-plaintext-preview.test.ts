import { describe, expect, it } from "vitest";
import { toAccountEventPlaintextPreview, toConversationListPreview } from "./account-event-plaintext-preview";

describe("toAccountEventPlaintextPreview", () => {
  it("keeps full community-invite JSON including room key and metadata", () => {
    const invite = JSON.stringify({
      type: "community-invite",
      groupId: "group-abc",
      roomKey: "a".repeat(80),
      metadata: { id: "group-abc", name: "GroupTset 1", access: "invite-only" },
      relayUrl: "ws://localhost:7000",
    });
    expect(toAccountEventPlaintextPreview(invite)).toBe(
      invite.replace(/\s+/g, " ").trim(),
    );
  });

  it("keeps structured invite JSON for sidebar re-formatting", () => {
    const response = JSON.stringify({
      type: "community-invite-response",
      status: "accepted",
      groupId: "g1",
    });
    expect(toConversationListPreview(response)).toBe(response);
  });

  it("clips long ordinary chat text", () => {
    const longText = "hello ".repeat(40).trim();
    const preview = toAccountEventPlaintextPreview(longText);
    expect(preview.endsWith("...")).toBe(true);
    expect(preview.length).toBeLessThanOrEqual(143);
  });
});
