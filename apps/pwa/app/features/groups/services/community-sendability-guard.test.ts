import { describe, expect, it } from "vitest";
import {
  checkCommunitySendability,
  formatSendabilityForComposer,
  type CommunitySendabilityCheckParams,
} from "./community-sendability-guard";

describe("community-sendability-guard", () => {
  const baseParams: CommunitySendabilityCheckParams = {
    groupId: "test-group",
    localMemberPubkey: "pubkey1" as import("@dweb/crypto/public-key-hex").PublicKeyHex,
    membershipStatus: "member",
    hasRoomKey: true,
    roomKeyEpochMs: Date.now(),
    expelledPubkeys: new Set(),
    leftPubkeys: new Set(),
  };

  describe("checkCommunitySendability", () => {
    it("allows sending when member has room key", () => {
      const result = checkCommunitySendability(baseParams);
      expect(result.canSend).toBe(true);
      expect(result.reasonCode).toBe("ready");
    });

    it("blocks sending when no membership", () => {
      const result = checkCommunitySendability({
        ...baseParams,
        membershipStatus: "none",
      });
      expect(result.canSend).toBe(false);
      expect(result.reasonCode).toBe("no_membership");
    });

    it("blocks sending when membership pending", () => {
      const result = checkCommunitySendability({
        ...baseParams,
        membershipStatus: "unknown",
      });
      expect(result.canSend).toBe(false);
      expect(result.reasonCode).toBe("pending_join");
    });

    it("blocks sending when no room key", () => {
      const result = checkCommunitySendability({
        ...baseParams,
        hasRoomKey: false,
      });
      expect(result.canSend).toBe(false);
      expect(result.reasonCode).toBe("no_room_key");
    });

    it("blocks sending when expelled", () => {
      const result = checkCommunitySendability({
        ...baseParams,
        expelledPubkeys: new Set(["pubkey1"]),
      });
      expect(result.canSend).toBe(false);
      expect(result.reasonCode).toBe("expelled");
    });

    it("blocks sending when left", () => {
      const result = checkCommunitySendability({
        ...baseParams,
        leftPubkeys: new Set(["pubkey1"]),
      });
      expect(result.canSend).toBe(false);
      expect(result.reasonCode).toBe("left");
    });

    it("blocks sending when room key is stale (>7 days)", () => {
      const oldEpoch = Date.now() - 8 * 24 * 60 * 60 * 1000; // 8 days ago
      const result = checkCommunitySendability({
        ...baseParams,
        roomKeyEpochMs: oldEpoch,
      });
      expect(result.canSend).toBe(false);
      expect(result.reasonCode).toBe("stale_room_key");
    });

    it("allows sending when room key is fresh (<7 days)", () => {
      const recentEpoch = Date.now() - 3 * 24 * 60 * 60 * 1000; // 3 days ago
      const result = checkCommunitySendability({
        ...baseParams,
        roomKeyEpochMs: recentEpoch,
      });
      expect(result.canSend).toBe(true);
      expect(result.reasonCode).toBe("ready");
    });

    it("expulsion takes priority over missing room key", () => {
      const result = checkCommunitySendability({
        ...baseParams,
        hasRoomKey: false,
        expelledPubkeys: new Set(["pubkey1"]),
      });
      expect(result.canSend).toBe(false);
      expect(result.reasonCode).toBe("expelled");
    });

    it("includes debug context in result", () => {
      const result = checkCommunitySendability(baseParams);
      expect(result.debugContext).toBeDefined();
      expect(result.debugContext?.groupId).toBe("test-group");
      expect(result.debugContext?.hasMembership).toBe(true);
      expect(result.debugContext?.hasRoomKey).toBe(true);
    });

    it("handles null local pubkey gracefully", () => {
      const result = checkCommunitySendability({
        ...baseParams,
        localMemberPubkey: null,
      });
      expect(result.canSend).toBe(true);
      expect(result.reasonCode).toBe("ready");
    });
  });

  describe("formatSendabilityForComposer", () => {
    it("enables composer when sendable", () => {
      const status = checkCommunitySendability(baseParams);
      const formatted = formatSendabilityForComposer(status);
      expect(formatted.disabled).toBe(false);
      expect(formatted.placeholder).toBe("Type a message...");
    });

    it("disables composer with specific message when not sendable", () => {
      const status = checkCommunitySendability({
        ...baseParams,
        hasRoomKey: false,
      });
      const formatted = formatSendabilityForComposer(status);
      expect(formatted.disabled).toBe(true);
      expect(formatted.placeholder).toContain("Cannot send");
    });
  });
});
