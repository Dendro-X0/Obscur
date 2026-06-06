import { describe, expect, it } from "vitest";
import type { PublicKeyHex } from "@dweb/crypto/public-key-hex";
import { resolveCommunityAutoDisbandOnLeaveDecision } from "./community-auto-disband-policy";

const A = "a".repeat(64) as PublicKeyHex;
const B = "b".repeat(64) as PublicKeyHex;

describe("resolveCommunityAutoDisbandOnLeaveDecision", () => {
  it("attempts auto-disband when only the leaver remains in live and seeded rosters", () => {
    const decision = resolveCommunityAutoDisbandOnLeaveDecision({
      liveMemberPubkeys: [A],
      seededMemberPubkeys: [A],
      leftMemberPubkeys: [],
      expelledMemberPubkeys: [],
      myPublicKeyHex: A,
    });
    expect(decision.remainingKnownMembers).toEqual([]);
    expect(decision.shouldAttemptAutoDisband).toBe(true);
  });

  it("skips auto-disband when seeded roster still lists another member", () => {
    const decision = resolveCommunityAutoDisbandOnLeaveDecision({
      liveMemberPubkeys: [A],
      seededMemberPubkeys: [A, B],
      leftMemberPubkeys: [],
      expelledMemberPubkeys: [],
      myPublicKeyHex: A,
    });
    expect(decision.remainingKnownMembers).toEqual([B]);
    expect(decision.shouldAttemptAutoDisband).toBe(false);
  });

  it("skips auto-disband when live CRDT roster lists another member", () => {
    const decision = resolveCommunityAutoDisbandOnLeaveDecision({
      liveMemberPubkeys: [A, B],
      seededMemberPubkeys: [A],
      leftMemberPubkeys: [],
      expelledMemberPubkeys: [],
      myPublicKeyHex: A,
    });
    expect(decision.remainingKnownMembers).toEqual([B]);
    expect(decision.shouldAttemptAutoDisband).toBe(false);
  });

  it("ignores left and expelled members when counting remaining participants", () => {
    const decision = resolveCommunityAutoDisbandOnLeaveDecision({
      liveMemberPubkeys: [A, B],
      seededMemberPubkeys: [A, B],
      leftMemberPubkeys: [B],
      expelledMemberPubkeys: [],
      myPublicKeyHex: A,
    });
    expect(decision.remainingKnownMembers).toEqual([]);
    expect(decision.shouldAttemptAutoDisband).toBe(true);
  });
});
