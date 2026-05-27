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

  it("does not fall back to monotonic roster when coordination is configured but directory is missing", () => {
    const display = resolveCommunityParticipantDisplayPubkeys({
      communityMode: "managed_workspace",
      coordinationDirectory: null,
      monotonicDisplayPubkeys: [PK_A, PK_B],
      localMemberPubkey: PK_A,
    });
    expect(display).toEqual([]);
  });
});
