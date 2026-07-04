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

  it("returns empty blocklist when coordination directory is unavailable and no join evidence", () => {
    const blocklist = resolveCommunityInviteMemberBlocklist({
      communityMode: "managed_workspace",
      coordinationDirectory: null,
      hybridActiveMemberPubkeys: [PK_A, PK_B],
      leftMemberPubkeys: [PK_B],
      expelledMemberPubkeys: [],
    });
    expect(blocklist).toEqual([]);
  });

  it("blocks invite for join-evidence members when coordination directory is missing", () => {
    const blocklist = resolveCommunityInviteMemberBlocklist({
      communityMode: "managed_workspace",
      relayUrl: "ws://localhost:7000",
      coordinationDirectory: null,
      hybridActiveMemberPubkeys: [PK_A],
      joinEvidenceMemberPubkeys: [PK_A, PK_B],
      leftMemberPubkeys: [],
      expelledMemberPubkeys: [],
    });
    expect(blocklist).toEqual([PK_A, PK_B]);
  });

  it("blocks invite for participation authors when coordination directory lags relay chat", () => {
    const blocklist = resolveCommunityInviteMemberBlocklist({
      communityMode: "managed_workspace",
      relayUrl: "ws://localhost:7000",
      coordinationDirectory: {
        activeMemberPubkeys: [PK_A],
        leftMemberPubkeys: [],
        expelledMemberPubkeys: [],
        headSeq: 2,
      },
      hybridActiveMemberPubkeys: [PK_A],
      participationAuthorPubkeys: [PK_B],
      leftMemberPubkeys: [],
      expelledMemberPubkeys: [],
    });
    expect(isPubkeyBlockedFromCommunityInvite(PK_B, blocklist)).toBe(true);
    expect(blocklist).toContain(PK_A);
    expect(blocklist).toContain(PK_B);
  });
});
