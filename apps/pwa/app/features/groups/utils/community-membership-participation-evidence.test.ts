import { describe, expect, it } from "vitest";
import type { PublicKeyHex } from "@dweb/crypto/public-key-hex";
import {
  filterTerminalMembersWithoutParticipationEvidence,
  getLatestCommunityMessageUnixMsByPubkey,
  shouldSuppressStaleCommunityMemberRemoval,
} from "./community-membership-participation-evidence";

const PK_B = "b".repeat(64) as PublicKeyHex;

describe("community-membership-participation-evidence", () => {
  it("detects latest message timestamps in seconds or milliseconds", () => {
    const latest = getLatestCommunityMessageUnixMsByPubkey([
      { pubkey: PK_B, created_at: 1_700_000_000 },
      { pubkey: PK_B, created_at: 1_700_000_100_000 },
    ]);
    expect(latest.get(PK_B.toLowerCase())).toBe(1_700_000_100_000);
  });

  it("suppresses leave replay when a newer sealed message exists", () => {
    const leaveAtSeconds = 1_700_000_000;
    const messageAtSeconds = leaveAtSeconds + 60;
    expect(shouldSuppressStaleCommunityMemberRemoval({
      subjectPubkey: PK_B,
      removalAtUnixMs: leaveAtSeconds,
      communityMessages: [{ pubkey: PK_B, created_at: messageAtSeconds }],
    })).toBe(true);
  });

  it("does not suppress leave when no participation exists", () => {
    expect(shouldSuppressStaleCommunityMemberRemoval({
      subjectPubkey: PK_B,
      removalAtUnixMs: 1_700_000_100,
      communityMessages: [],
    })).toBe(false);
  });

  it("strips terminal pubkeys that still have author evidence", () => {
    const filtered = filterTerminalMembersWithoutParticipationEvidence({
      leftMemberPubkeys: [PK_B],
      expelledMemberPubkeys: [],
      communityMessages: [{ pubkey: PK_B, created_at: 1_700_000_200 }],
    });
    expect(filtered.leftMemberPubkeys).toEqual([]);
  });
});
