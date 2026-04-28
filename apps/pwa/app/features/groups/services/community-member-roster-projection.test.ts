import { describe, expect, it } from "vitest";
import type { PublicKeyHex } from "@dweb/crypto/public-key-hex";
import {
  buildCommunityRosterProjection,
  buildCommunityRosterProjectionByConversationId,
  dedupeCommunityMemberPubkeys,
  projectCommunityMemberRoster,
  resolveCommunityMemberSnapshotApplication,
  seedCommunityMemberLedgerMembers,
} from "./community-member-roster-projection";
import type { GroupConversation } from "@/app/features/messaging/types";

const MEMBER_A = "a".repeat(64) as PublicKeyHex;
const MEMBER_B = "b".repeat(64) as PublicKeyHex;
const MEMBER_C = "c".repeat(64) as PublicKeyHex;

const createGroup = (overrides: Partial<GroupConversation> = {}): GroupConversation => ({
  kind: "group",
  id: "community:alpha:wss://relay.alpha",
  communityId: "alpha:wss://relay.alpha",
  groupId: "alpha",
  relayUrl: "wss://relay.alpha",
  displayName: "Alpha",
  memberPubkeys: [MEMBER_A, MEMBER_B],
  lastMessage: "",
  unreadCount: 0,
  lastMessageTime: new Date(1_000),
  access: "invite-only",
  memberCount: 2,
  adminPubkeys: [],
  ...overrides,
});

describe("community-member-roster-projection", () => {
  it("projects one canonical active roster from seeded/live/author evidence", () => {
    expect(projectCommunityMemberRoster({
      seededMemberPubkeys: [MEMBER_A, MEMBER_B],
      liveMemberPubkeys: [MEMBER_A],
      authorEvidencePubkeys: [MEMBER_B, MEMBER_C],
      leftMemberPubkeys: [MEMBER_C],
    })).toEqual(expect.objectContaining({
      allKnownMemberPubkeys: [MEMBER_A, MEMBER_B, MEMBER_C],
      activeMemberPubkeys: [MEMBER_A, MEMBER_B],
    }));
  });

  it("seeds ledger members from restored initial members plus local identity evidence", () => {
    expect(seedCommunityMemberLedgerMembers({
      initialMembers: [MEMBER_A, MEMBER_B],
      localMemberPubkey: MEMBER_A,
      hasLocalMembershipEvidence: true,
    })).toEqual([MEMBER_A, MEMBER_B]);
  });

  it("refuses to apply thinner snapshots without leave or expel evidence", () => {
    expect(resolveCommunityMemberSnapshotApplication({
      currentMemberPubkeys: [MEMBER_A, MEMBER_B],
      incomingActiveMemberPubkeys: [MEMBER_A],
      leftMemberPubkeys: [],
      expelledMemberPubkeys: [],
    })).toEqual({
      shouldApply: false,
      reasonCode: "missing_removal_evidence",
      nextMemberPubkeys: [MEMBER_A, MEMBER_B],
      removedWithoutEvidence: [MEMBER_B],
    });
  });

  it("applies thinner snapshots when explicit removal evidence exists", () => {
    expect(resolveCommunityMemberSnapshotApplication({
      currentMemberPubkeys: [MEMBER_A, MEMBER_B],
      incomingActiveMemberPubkeys: [MEMBER_A],
      leftMemberPubkeys: [MEMBER_B],
      expelledMemberPubkeys: [],
    })).toEqual({
      shouldApply: true,
      reasonCode: "apply_snapshot",
      nextMemberPubkeys: [MEMBER_A],
      removedWithoutEvidence: [],
    });
  });

  it("dedupes pubkeys without changing order", () => {
    expect(dedupeCommunityMemberPubkeys([MEMBER_A, MEMBER_B, MEMBER_A])).toEqual([MEMBER_A, MEMBER_B]);
  });

  it("builds a provider-owned roster projection from a group conversation", () => {
    expect(buildCommunityRosterProjection(createGroup({
      memberPubkeys: [MEMBER_A, MEMBER_B, MEMBER_A],
      memberCount: 99,
    }))).toEqual(expect.objectContaining({
      conversationId: "community:alpha:wss://relay.alpha",
      activeMemberPubkeys: [MEMBER_A, MEMBER_B],
      memberCount: 2,
    }));
  });

  it("indexes roster projections by conversation id", () => {
    const byConversationId = buildCommunityRosterProjectionByConversationId([
      createGroup(),
      createGroup({
        id: "community:beta:wss://relay.beta",
        communityId: "beta:wss://relay.beta",
        groupId: "beta",
        relayUrl: "wss://relay.beta",
        memberPubkeys: [MEMBER_C],
        memberCount: 1,
      }),
    ]);
    expect(byConversationId["community:alpha:wss://relay.alpha"]?.memberCount).toBe(2);
    expect(byConversationId["community:beta:wss://relay.beta"]?.activeMemberPubkeys).toEqual([MEMBER_C]);
  });
});
