import { describe, expect, it } from "vitest";
import type { PublicKeyHex } from "@dweb/crypto/public-key-hex";
import { summarizeCommunityOperatorHealth } from "./community-operator-health";

const PK_A = "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa" as PublicKeyHex;
const PK_B = "bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb" as PublicKeyHex;
const PK_C = "cccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc" as PublicKeyHex;

describe("community-operator-health", () => {
  it("returns stable summary when no risk signals exist", () => {
    const summary = summarizeCommunityOperatorHealth({
      activeMembers: [PK_A, PK_B],
      leftMembers: [],
      expelledMembers: [],
      onlineMemberCount: 1,
      kickVotes: {},
    });

    expect(summary.activeMemberCount).toBe(2);
    expect(summary.quorumThreshold).toBe(2);
    expect(summary.targetsWithKickVotes).toBe(0);
    expect(summary.signals).toHaveLength(1);
    expect(summary.signals[0]?.id).toBe("community_stable");
  });

  it("flags near-quorum kick pressure as critical", () => {
    const summary = summarizeCommunityOperatorHealth({
      activeMembers: [PK_A, PK_B, PK_C],
      leftMembers: [],
      expelledMembers: [],
      onlineMemberCount: 2,
      kickVotes: {
        [PK_C]: [PK_A, PK_B, PK_A],
      },
    });

    expect(summary.quorumThreshold).toBe(2);
    expect(summary.totalKickVotes).toBe(2);
    expect(summary.highestKickPressure?.targetPubkey).toBe(PK_C);
    expect(summary.highestKickPressure?.nearQuorum).toBe(true);
    expect(summary.signals.some((signal) => (
      signal.id === "kick_vote_pressure" && signal.severity === "critical"
    ))).toBe(true);
  });

  it("treats disbanded communities as critical", () => {
    const summary = summarizeCommunityOperatorHealth({
      activeMembers: [PK_A],
      leftMembers: [],
      expelledMembers: [],
      onlineMemberCount: 0,
      kickVotes: {},
      disbandedAt: 12345,
    });

    expect(summary.disbanded).toBe(true);
    expect(summary.signals[0]?.id).toBe("community_disbanded");
    expect(summary.signals[0]?.severity).toBe("critical");
  });

  it("reports lifecycle drift counts and clamps online member count", () => {
    const summary = summarizeCommunityOperatorHealth({
      activeMembers: [PK_A],
      leftMembers: [PK_B],
      expelledMembers: [PK_C],
      onlineMemberCount: 9,
      kickVotes: {},
    });

    expect(summary.onlineMemberCount).toBe(1);
    expect(summary.offlineMemberCount).toBe(0);
    expect(summary.knownMemberCount).toBe(3);
    expect(summary.leftMemberCount).toBe(1);
    expect(summary.expelledMemberCount).toBe(1);
    expect(summary.signals.some((signal) => signal.id === "left_members_present")).toBe(true);
    expect(summary.signals.some((signal) => signal.id === "expelled_members_present")).toBe(true);
  });
});

