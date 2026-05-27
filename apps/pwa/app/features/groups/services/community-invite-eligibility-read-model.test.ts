import { beforeEach, describe, expect, it, vi } from "vitest";
import type { PublicKeyHex } from "@dweb/crypto/public-key-hex";

vi.mock("./community-dev-flags", () => ({
  isWorkspaceR1MembershipEnforced: vi.fn(() => true),
}));

vi.mock("./community-membership-sync-mode", () => ({
  isCoordinationConfigured: vi.fn(() => true),
  readMembershipSyncMode: vi.fn(() => "coordination_preferred" as const),
}));

import {
  isPubkeyBlockedFromCommunityInvite,
  resolveCommunityInviteMemberBlocklist,
} from "./community-invite-eligibility-read-model";

const PK_A = "aa".repeat(32) as PublicKeyHex;
const PK_B = "bb".repeat(32) as PublicKeyHex;
const PK_C = "cc".repeat(32) as PublicKeyHex;

describe("community-invite-eligibility-read-model", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("uses coordination directory active set instead of stale monotonic roster", () => {
    const blocklist = resolveCommunityInviteMemberBlocklist({
      communityMode: "managed_workspace",
      coordinationDirectory: {
        activeMemberPubkeys: [PK_A],
        leftMemberPubkeys: [PK_B],
        expelledMemberPubkeys: [],
        headSeq: 4,
      },
      hybridActiveMemberPubkeys: [PK_A, PK_B, PK_C],
      leftMemberPubkeys: [],
      expelledMemberPubkeys: [],
    });
    expect(blocklist).toEqual([PK_A]);
    expect(isPubkeyBlockedFromCommunityInvite(PK_B, blocklist)).toBe(false);
    expect(isPubkeyBlockedFromCommunityInvite(PK_C, blocklist)).toBe(false);
  });

  it("falls back to hybrid active roster when coordination directory is unavailable", () => {
    const blocklist = resolveCommunityInviteMemberBlocklist({
      communityMode: "managed_workspace",
      coordinationDirectory: null,
      hybridActiveMemberPubkeys: [PK_A, PK_B],
      leftMemberPubkeys: [PK_B],
      expelledMemberPubkeys: [],
    });
    expect(blocklist).toEqual([PK_A]);
  });
});
