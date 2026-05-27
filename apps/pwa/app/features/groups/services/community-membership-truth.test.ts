import { describe, expect, it, vi, beforeEach } from "vitest";
import type { PublicKeyHex } from "@dweb/crypto/public-key-hex";

vi.mock("./community-dev-flags", () => ({
  isWorkspaceR1MembershipEnforced: vi.fn(() => true),
}));

vi.mock("./community-membership-sync-mode", () => ({
  isCoordinationConfigured: vi.fn(() => true),
}));

const loadCoordinationMembershipDirectory = vi.fn();
const refreshCoordinationMembershipDirectory = vi.fn();

vi.mock("./community-coordination-membership-directory-store", () => ({
  loadCoordinationMembershipDirectory: (...args: unknown[]) => loadCoordinationMembershipDirectory(...args),
  refreshCoordinationMembershipDirectory: (...args: unknown[]) => refreshCoordinationMembershipDirectory(...args),
}));

import {
  readCommunityMembershipTruthSnapshot,
  refreshCommunityMembershipTruth,
  usesCoordinationMembershipTruth,
} from "./community-membership-truth";

const PK_A = "aa".repeat(32) as PublicKeyHex;
const PK_B = "bb".repeat(32) as PublicKeyHex;

describe("community-membership-truth", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("uses coordination directory for managed workspace when configured", () => {
    loadCoordinationMembershipDirectory.mockReturnValue({
      activeMemberPubkeys: [PK_A],
      leftMemberPubkeys: [PK_B],
      expelledMemberPubkeys: [],
      headSeq: 2,
    });

    const snapshot = readCommunityMembershipTruthSnapshot({
      communityId: "community:test",
      communityMode: "managed_workspace",
      localMemberPubkey: PK_A,
    });

    expect(usesCoordinationMembershipTruth("managed_workspace")).toBe(true);
    expect(snapshot.syncStatus).toBe("fresh");
    expect(snapshot.activeMemberPubkeys).toEqual([PK_A]);
    expect(snapshot.inviteBlocklistPubkeys).toEqual([PK_A]);
  });

  it("reports stale when coordination is configured but directory is not loaded", () => {
    loadCoordinationMembershipDirectory.mockReturnValue(null);

    const snapshot = readCommunityMembershipTruthSnapshot({
      communityId: "community:test",
      communityMode: "managed_workspace",
    });

    expect(snapshot.syncStatus).toBe("stale");
    expect(snapshot.activeMemberPubkeys).toEqual([]);
  });

  it("refresh forces full directory rebuild", async () => {
    refreshCoordinationMembershipDirectory.mockResolvedValue({
      activeMemberPubkeys: [PK_A],
      leftMemberPubkeys: [PK_B],
      expelledMemberPubkeys: [],
      headSeq: 4,
    });
    loadCoordinationMembershipDirectory.mockReturnValue({
      activeMemberPubkeys: [PK_A],
      leftMemberPubkeys: [PK_B],
      expelledMemberPubkeys: [],
      headSeq: 4,
    });

    const snapshot = await refreshCommunityMembershipTruth({
      communityId: "community:test",
      communityMode: "managed_workspace",
      forceFull: true,
    });

    expect(refreshCoordinationMembershipDirectory).toHaveBeenCalledWith({
      communityId: "community:test",
      profileId: undefined,
      forceFull: true,
    });
    expect(snapshot.activeMemberPubkeys).toEqual([PK_A]);
  });
});
