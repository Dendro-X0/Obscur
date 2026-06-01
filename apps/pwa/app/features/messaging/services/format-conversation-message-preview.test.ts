import { describe, expect, it } from "vitest";

import {
  COMMUNITY_INVITE_LIST_PREVIEW,
  COMMUNITY_INVITE_RESPONSE_ACCEPTED_PREVIEW,
  formatConversationMessagePreview,
} from "./format-conversation-message-preview";

describe("formatConversationMessagePreview", () => {
  it("formats community invite JSON with community name", () => {
    const preview = formatConversationMessagePreview(JSON.stringify({
      type: "community-invite",
      groupId: "g1",
      roomKey: "rk",
      metadata: { id: "g1", name: "Test 8" },
    }));
    expect(preview).toBe("Community invite: Test 8");
  });

  it("formats community invite response JSON", () => {
    const preview = formatConversationMessagePreview(JSON.stringify({
      type: "community-invite-response",
      inviteId: "legacy:abc",
      status: "accepted",
      groupId: "",
    }));
    expect(preview).toBe(COMMUNITY_INVITE_RESPONSE_ACCEPTED_PREVIEW);
  });

  it("falls back to default invite name when metadata is missing", () => {
    const preview = formatConversationMessagePreview('{"type":"community-invite","groupId":"g1"}');
    expect(preview).toBe("Community invite: Private Group");
  });

  it("truncates long plain text", () => {
    const preview = formatConversationMessagePreview("a".repeat(200));
    expect(preview.endsWith("...")).toBe(true);
    expect(preview.length).toBe(143);
  });
});
