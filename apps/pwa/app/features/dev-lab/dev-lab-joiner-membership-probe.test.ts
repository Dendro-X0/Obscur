import { beforeEach, describe, expect, it, vi } from "vitest";
import type { PublicKeyHex } from "@dweb/crypto/public-key-hex";
import type { GroupConversation } from "@/app/features/messaging/types";

vi.mock("@/app/features/workspace-kernel/workspace-kernel-policy", () => ({
  isWorkspaceKernelAuthority: vi.fn(() => true),
}));

vi.mock("@/app/features/groups/services/community-dev-flags", () => ({
  isWorkspaceR1MembershipEnforced: vi.fn(() => true),
}));

vi.mock("@/app/features/groups/services/community-membership-sync-mode", () => ({
  isCoordinationConfigured: vi.fn(() => true),
  readMembershipSyncMode: vi.fn(() => "coordination_preferred" as const),
}));

vi.mock("@/app/features/workspace-kernel/workspace-kernel-group-metadata-store", () => ({
  loadWorkspaceGroupMetadataRecords: vi.fn(() => []),
}));

vi.mock("@/app/features/groups/services/community-coordination-membership-directory-store", () => ({
  loadCoordinationMembershipDirectory: vi.fn(() => ({
    activeMemberPubkeys: ["aa".repeat(32)],
    leftMemberPubkeys: [],
    expelledMemberPubkeys: [],
    headSeq: 2,
  })),
  listCoordinationMembershipDirectoryRecords: vi.fn(() => []),
}));

vi.mock("@/app/features/groups/services/community-membership-ledger", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/app/features/groups/services/community-membership-ledger")>();
  return {
    ...actual,
    loadCommunityMembershipLedger: vi.fn(() => []),
  };
});

vi.mock("@/app/features/groups/services/group-tombstone-store", () => ({
  loadGroupTombstones: vi.fn(() => new Set()),
  isGroupTombstoned: vi.fn(() => false),
}));

import { runJoinerMembershipRepairProbe } from "./dev-lab-joiner-membership-probe";
import { loadWorkspaceGroupMetadataRecords } from "@/app/features/workspace-kernel/workspace-kernel-group-metadata-store";

const PK_A = "aa".repeat(32) as PublicKeyHex;
const PK_B = "bb".repeat(32) as PublicKeyHex;
const LOCAL_RELAY = "ws://localhost:7000";

const LEGACY_JOINER_GROUP: GroupConversation = {
  kind: "group",
  id: "community:probe-group",
  groupId: "probe-group",
  relayUrl: LOCAL_RELAY,
  displayName: "Probe Group",
  memberPubkeys: [PK_A, PK_B],
  lastMessage: "",
  unreadCount: 0,
  lastMessageTime: new Date(),
  access: "open",
  memberCount: 2,
  adminPubkeys: [],
};

describe("dev-lab joiner membership probe", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("passes when join-evidence members appear in display and invite blocklist", () => {
    vi.mocked(loadWorkspaceGroupMetadataRecords).mockReturnValue([LEGACY_JOINER_GROUP]);
    const result = runJoinerMembershipRepairProbe({ publicKeyHex: PK_A, profileId: "profile-a" });
    expect(result.skipped).toBe(false);
    expect(result.ok).toBe(true);
    expect(result.groupsChecked).toBe(1);
    expect(result.groups[0]?.passed).toBe(true);
    expect(result.groups[0]?.effectiveCommunityMode).toBe("managed_workspace");
  });

  it("skips when no multi-member join evidence groups exist", () => {
    vi.mocked(loadWorkspaceGroupMetadataRecords).mockReturnValue([{
      ...LEGACY_JOINER_GROUP,
      memberPubkeys: [PK_A],
      memberCount: 1,
    }]);
    const result = runJoinerMembershipRepairProbe({ publicKeyHex: PK_A, profileId: "profile-a" });
    expect(result.skipped).toBe(true);
    expect(result.ok).toBe(true);
    expect(result.reason).toBe("no_multi_member_join_evidence_groups");
  });
});
