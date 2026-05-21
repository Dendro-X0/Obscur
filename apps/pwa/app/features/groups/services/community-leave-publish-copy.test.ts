import { describe, expect, it } from "vitest";
import { resolveCommunityLeavePublishSurfaceCopy } from "./community-leave-publish-copy";
import type { CommunityLeaveOutboxItem } from "./community-leave-outbox";

const baseItem = (status: CommunityLeaveOutboxItem["status"]): CommunityLeaveOutboxItem => ({
  id: "g@@wss://relay.example",
  publicKeyHex: "aa".repeat(32),
  groupId: "g",
  relayUrl: "wss://relay.example",
  intentUnixMs: 1_700_000_000_000,
  status,
  attemptCount: 1,
});

describe("resolveCommunityLeavePublishSurfaceCopy", () => {
  it("describes pending relay confirmation honestly", () => {
    const copy = resolveCommunityLeavePublishSurfaceCopy(baseItem("pending"));
    expect(copy.shortLabel).toBe("Relay pending");
    expect(copy.detail).toContain("not joined");
  });

  it("includes retry timing for rate limited leaves", () => {
    const copy = resolveCommunityLeavePublishSurfaceCopy({
      ...baseItem("rate_limited"),
      retryAfterUnixMs: 1_700_000_300_000,
    }, 1_700_000_000_000);
    expect(copy.shortLabel).toBe("Relay retry");
    expect(copy.detail).toContain("retry");
  });

  it("surfaces relay rejection without implying the user is still joined", () => {
    const copy = resolveCommunityLeavePublishSurfaceCopy({
      ...baseItem("rejected"),
      rejectedReasonCode: "publish_failed",
    });
    expect(copy.shortLabel).toBe("Relay declined");
    expect(copy.detail).toContain("not joined");
  });
});
