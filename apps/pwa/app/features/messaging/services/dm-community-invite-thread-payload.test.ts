import { describe, expect, it } from "vitest";
import { isCommunityInviteThreadPayloadContent } from "./dm-community-invite-thread-payload";

describe("isCommunityInviteThreadPayloadContent", () => {
  it("detects community invite payloads", () => {
    const content = JSON.stringify({
      type: "community-invite",
      groupId: "g1",
      roomKey: "rk",
      metadata: { id: "g1", name: "Test" },
    });
    expect(isCommunityInviteThreadPayloadContent(content)).toBe(true);
  });

  it("detects invite response payloads", () => {
    const content = JSON.stringify({
      type: "community-invite-response",
      status: "accepted",
      groupId: "g1",
    });
    expect(isCommunityInviteThreadPayloadContent(content)).toBe(true);
  });

  it("rejects plain text", () => {
    expect(isCommunityInviteThreadPayloadContent("hello")).toBe(false);
  });
});
