import { describe, expect, it, vi } from "vitest";
import type { PublicKeyHex } from "@dweb/crypto/public-key-hex";

vi.mock("./community-dev-flags", () => ({
  isWorkspaceR1MembershipEnforced: vi.fn(() => true),
}));

vi.mock("./community-membership-sync-mode", () => ({
  isCoordinationConfigured: vi.fn(() => true),
  readMembershipSyncMode: vi.fn(() => "coordination_preferred" as const),
}));

import {
  resolveCommunityParticipantDisplayPubkeys,
  shouldApplyTerminalMembershipExclusionsToParticipantRoster,
} from "./community-participant-display-read-model";

const PK_A = "aa".repeat(32) as PublicKeyHex;
const PK_B = "bb".repeat(32) as PublicKeyHex;

describe("community-participant-display-read-model", () => {
  it("excludes left/expelled pubkeys from coordination active display even if still listed active", () => {
    const display = resolveCommunityParticipantDisplayPubkeys({
      communityMode: "managed_workspace",
      coordinationDirectory: {
        activeMemberPubkeys: [PK_A, PK_B],
        leftMemberPubkeys: [PK_B],
        expelledMemberPubkeys: [],
        headSeq: 4,
      },
      monotonicDisplayPubkeys: [PK_A, PK_B],
      localMemberPubkey: PK_A,
    });
    expect(display).toEqual([PK_A]);
  });

  it("shows coordination active members after a peer leaves", () => {
    const display = resolveCommunityParticipantDisplayPubkeys({
      communityMode: "managed_workspace",
      coordinationDirectory: {
        activeMemberPubkeys: [PK_A],
        leftMemberPubkeys: [PK_B],
        expelledMemberPubkeys: [],
        headSeq: 3,
      },
      monotonicDisplayPubkeys: [PK_A, PK_B],
      localMemberPubkey: PK_A,
    });
    expect(display).toEqual([PK_A]);
  });

  it("skips terminal exclusions when coordination directory is authoritative", () => {
    expect(shouldApplyTerminalMembershipExclusionsToParticipantRoster(
      "managed_workspace",
      {
        activeMemberPubkeys: [PK_A],
        leftMemberPubkeys: [],
        expelledMemberPubkeys: [],
        headSeq: 1,
      },
    )).toBe(false);
  });

  it("uses coordination active members even when headSeq is zero", () => {
    const display = resolveCommunityParticipantDisplayPubkeys({
      communityMode: "managed_workspace",
      coordinationDirectory: {
        activeMemberPubkeys: [PK_A],
        leftMemberPubkeys: [PK_B],
        expelledMemberPubkeys: [],
        headSeq: 0,
      },
      monotonicDisplayPubkeys: [PK_A, PK_B],
      localMemberPubkey: PK_A,
    });
    expect(display).toEqual([PK_A]);
  });

  it("applies local terminal expelled evidence when coordination directory is stale", () => {
    const display = resolveCommunityParticipantDisplayPubkeys({
      communityMode: "managed_workspace",
      coordinationDirectory: {
        activeMemberPubkeys: [PK_A, PK_B],
        leftMemberPubkeys: [],
        expelledMemberPubkeys: [],
        headSeq: 2,
      },
      monotonicDisplayPubkeys: [PK_A, PK_B],
      localMemberPubkey: PK_A,
      localExpelledMemberPubkeys: [PK_B],
    });
    expect(display).toEqual([PK_A]);
  });

  it("repairs stale directory shrink from explicit join-evidence member pubkeys", () => {
    const display = resolveCommunityParticipantDisplayPubkeys({
      communityMode: "managed_workspace",
      coordinationDirectory: {
        activeMemberPubkeys: [PK_A],
        leftMemberPubkeys: [],
        expelledMemberPubkeys: [],
        headSeq: 2,
      },
      monotonicDisplayPubkeys: [PK_A],
      joinEvidenceMemberPubkeys: [PK_A, PK_B],
      localMemberPubkey: PK_A,
    });
    expect(display).toEqual([PK_A, PK_B]);
  });

  it("repairs stale directory shrink from known participants when join evidence is thin", () => {
    const display = resolveCommunityParticipantDisplayPubkeys({
      communityMode: "managed_workspace",
      coordinationDirectory: {
        activeMemberPubkeys: [PK_A],
        leftMemberPubkeys: [],
        expelledMemberPubkeys: [],
        headSeq: 2,
      },
      monotonicDisplayPubkeys: [PK_A],
      joinEvidenceMemberPubkeys: [PK_A],
      knownParticipantPubkeys: [PK_A, PK_B],
      localMemberPubkey: PK_A,
    });
    expect(display).toEqual([PK_A, PK_B]);
  });

  it("repairs stale directory shrink from participation author evidence", () => {
    const display = resolveCommunityParticipantDisplayPubkeys({
      communityMode: "managed_workspace",
      coordinationDirectory: {
        activeMemberPubkeys: [PK_A],
        leftMemberPubkeys: [],
        expelledMemberPubkeys: [],
        headSeq: 2,
      },
      monotonicDisplayPubkeys: [PK_A],
      joinEvidenceMemberPubkeys: [PK_A],
      participationAuthorPubkeys: [PK_B],
      localMemberPubkey: PK_A,
    });
    expect(display).toEqual([PK_A, PK_B]);
  });

  it("falls back to durable repair seeds when coordination directory is missing", () => {
    const display = resolveCommunityParticipantDisplayPubkeys({
      communityMode: "managed_workspace",
      coordinationDirectory: null,
      monotonicDisplayPubkeys: [PK_A, PK_B],
      joinEvidenceMemberPubkeys: [PK_A],
      knownParticipantPubkeys: [PK_B],
      localMemberPubkey: PK_A,
    });
    expect(display).toEqual([PK_A, PK_B]);
  });

  it("does not fall back to monotonic roster when coordination is configured but directory and repair seeds are missing", () => {
    const display = resolveCommunityParticipantDisplayPubkeys({
      communityMode: "managed_workspace",
      coordinationDirectory: null,
      monotonicDisplayPubkeys: [PK_A, PK_B],
      localMemberPubkey: PK_A,
    });
    expect(display).toEqual([]);
  });
});
