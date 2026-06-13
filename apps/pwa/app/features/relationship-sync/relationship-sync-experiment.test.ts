import { beforeEach, describe, expect, it, vi } from "vitest";
import type { PublicKeyHex } from "@dweb/crypto/public-key-hex";
import { setProfileScopeOverride } from "@/app/features/profiles/services/profile-scope";
import { saveCommunityMembershipLedger } from "@/app/features/groups/services/community-membership-ledger";
import { resolveCommunityInviteMemberBlocklist } from "@/app/features/groups/services/community-invite-eligibility-read-model";
import {
  detectRelationshipSyncDrift,
  isCommunityMemberActiveInDirectory,
  isDmContactAccepted,
} from "./relationship-sync-projection";

const PK_A = "aa".repeat(32) as PublicKeyHex;
const PK_B = "bb".repeat(32) as PublicKeyHex;
const PROFILE_ID = "relationship-sync-exp";
const COMMUNITY_ID = "v2_newtest_2";
const RELAY = "ws://localhost:7000";

vi.mock("@/app/features/groups/services/community-dev-flags", () => ({
  isWorkspaceR1MembershipEnforced: vi.fn(() => true),
}));

vi.mock("@/app/features/groups/services/community-membership-sync-mode", () => ({
  isCoordinationConfigured: vi.fn(() => true),
  readMembershipSyncMode: vi.fn(() => "coordination_preferred" as const),
}));

vi.mock("@/app/features/groups/services/community-coordination-membership-directory-store", () => ({
  listCoordinationMembershipDirectoryRecords: vi.fn(() => [{
    communityId: COMMUNITY_ID,
    materialization: {
      activeMemberPubkeys: [PK_A, PK_B],
      leftMemberPubkeys: [],
      expelledMemberPubkeys: [],
      headSeq: 2,
    },
    updatedAtUnixMs: Date.now(),
  }]),
}));

vi.mock("./relationship-sync-policy", () => ({
  isRelationshipSyncExperimentEnabled: vi.fn(() => true),
}));

import { listCoordinationMembershipDirectoryRecords } from "@/app/features/groups/services/community-coordination-membership-directory-store";
import { peerTrustInternals } from "@/app/features/network/hooks/use-peer-trust";

describe("relationship sync experiment", () => {
  beforeEach(() => {
    window.localStorage.clear();
    setProfileScopeOverride(PROFILE_ID);
    vi.mocked(listCoordinationMembershipDirectoryRecords).mockReturnValue([{
      communityId: COMMUNITY_ID,
      materialization: {
        activeMemberPubkeys: [PK_A, PK_B],
        leftMemberPubkeys: [],
        expelledMemberPubkeys: [],
        headSeq: 2,
      },
      updatedAtUnixMs: Date.now(),
    }]);
  });

  it("uses coordination directory as community membership authority", () => {
    expect(isCommunityMemberActiveInDirectory(COMMUNITY_ID, PK_B, PROFILE_ID)).toBe(true);
    vi.mocked(listCoordinationMembershipDirectoryRecords).mockReturnValue([{
      communityId: COMMUNITY_ID,
      materialization: {
        activeMemberPubkeys: [PK_A],
        leftMemberPubkeys: [PK_B],
        expelledMemberPubkeys: [],
        headSeq: 3,
      },
      updatedAtUnixMs: Date.now(),
    }]);
    expect(isCommunityMemberActiveInDirectory(COMMUNITY_ID, PK_B, PROFILE_ID)).toBe(false);
  });

  it("uses peer trust as DM contact authority", () => {
    peerTrustInternals.saveToStorage(PK_A, {
      acceptedPeers: [PK_B],
      mutedPeers: [],
    });
    expect(isDmContactAccepted(PK_A, PK_B)).toBe(true);
    peerTrustInternals.saveToStorage(PK_A, {
      acceptedPeers: [],
      mutedPeers: [],
    });
    expect(isDmContactAccepted(PK_A, PK_B)).toBe(false);
  });

  it("skips join-evidence widen on invite blocklist when experiment is enabled", () => {
    const directory = {
      activeMemberPubkeys: [PK_A],
      leftMemberPubkeys: [],
      expelledMemberPubkeys: [],
      headSeq: 1,
    };
    const blocklist = resolveCommunityInviteMemberBlocklist({
      communityMode: "managed_workspace",
      relayUrl: RELAY,
      coordinationDirectory: directory,
      hybridActiveMemberPubkeys: [PK_A],
      joinEvidenceMemberPubkeys: [PK_B],
    });
    expect(blocklist).toEqual([PK_A]);
    expect(blocklist).not.toContain(PK_B);
  });

  it("detects invite blocklist wider than directory (stale join evidence)", () => {
    const directory = {
      activeMemberPubkeys: [PK_A],
      leftMemberPubkeys: [],
      expelledMemberPubkeys: [],
      headSeq: 1,
    };
    const issues = detectRelationshipSyncDrift({
      ownerPublicKeyHex: PK_A,
      profileId: PROFILE_ID,
      communityId: COMMUNITY_ID,
      relayUrl: RELAY,
      coordinationDirectory: directory,
      joinEvidenceMemberPubkeys: [PK_B],
      hybridActiveMemberPubkeys: [PK_A],
    });
    expect(issues.some((issue) => issue.code === "invite_blocklist_wider_than_directory")).toBe(true);
  });

  it("detects ledger terminal while directory still lists peer active", () => {
    saveCommunityMembershipLedger(PK_B, [{
      communityId: COMMUNITY_ID,
      groupId: "newtest-2",
      relayUrl: RELAY,
      status: "left",
      updatedAtUnixMs: 5_000,
    }], { profileId: PROFILE_ID });

    const issues = detectRelationshipSyncDrift({
      ownerPublicKeyHex: PK_B,
      profileId: PROFILE_ID,
      communityId: COMMUNITY_ID,
      relayUrl: RELAY,
      coordinationDirectory: {
        activeMemberPubkeys: [PK_A, PK_B],
        leftMemberPubkeys: [],
        expelledMemberPubkeys: [],
        headSeq: 2,
      },
      joinEvidenceMemberPubkeys: [],
      hybridActiveMemberPubkeys: [],
    });

    expect(issues.some((issue) => issue.code === "ledger_terminal_while_directory_active")).toBe(true);
  });
});
