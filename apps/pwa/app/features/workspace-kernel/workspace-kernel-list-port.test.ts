import { describe, expect, it, beforeEach, vi } from "vitest";
import type { PublicKeyHex } from "@dweb/crypto/public-key-hex";
import type { GroupConversation } from "@/app/features/messaging/types";
import { resolveManagedWorkspaceGroupList } from "./workspace-kernel-list-port";

const PUBLIC_KEY = "a".repeat(64) as PublicKeyHex;
const OTHER_KEY = "b".repeat(64) as PublicKeyHex;
const PROFILE_ID = "default";
const RELAY_URL = "ws://localhost:7000";

vi.mock("./workspace-kernel-policy", () => ({
  isWorkspaceKernelAuthority: () => true,
}));

vi.mock("@/app/features/groups/services/group-tombstone-store", () => ({
  isGroupTombstoned: vi.fn(() => false),
  loadGroupTombstones: vi.fn(() => new Set<string>()),
}));

vi.mock("@/app/features/groups/services/community-coordination-membership-directory-store", () => ({
  listCoordinationMembershipDirectoryRecords: vi.fn(() => []),
}));

vi.mock("@/app/features/groups/services/community-membership-ledger", () => ({
  loadCommunityMembershipLedger: vi.fn(() => []),
  toGroupConversationFromMembershipLedgerEntry: vi.fn(),
}));

import { isGroupTombstoned } from "@/app/features/groups/services/group-tombstone-store";
import { listCoordinationMembershipDirectoryRecords } from "@/app/features/groups/services/community-coordination-membership-directory-store";
import {
  loadCommunityMembershipLedger,
  toGroupConversationFromMembershipLedgerEntry,
} from "@/app/features/groups/services/community-membership-ledger";

const createGroup = (groupId: string, communityId: string): GroupConversation => ({
  kind: "group",
  id: `community:${groupId}:${RELAY_URL}`,
  communityId,
  groupId,
  relayUrl: RELAY_URL,
  displayName: groupId,
  memberPubkeys: [PUBLIC_KEY],
  lastMessage: "",
  unreadCount: 0,
  lastMessageTime: new Date(0),
  access: "open",
  memberCount: 1,
  adminPubkeys: [],
  communityMode: "managed_workspace",
});

describe("resolveManagedWorkspaceGroupList", () => {
  beforeEach(() => {
    vi.mocked(isGroupTombstoned).mockReturnValue(false);
    vi.mocked(listCoordinationMembershipDirectoryRecords).mockReturnValue([]);
    vi.mocked(loadCommunityMembershipLedger).mockReturnValue([]);
  });

  it("keeps local metadata rows regardless of coordination directory state", () => {
    const group = createGroup("newtest-1", "v2_newtest");
    vi.mocked(listCoordinationMembershipDirectoryRecords).mockReturnValue([{
      communityId: "v2_newtest",
      materialization: {
        activeMemberPubkeys: [],
        leftMemberPubkeys: [PUBLIC_KEY],
        expelledMemberPubkeys: [],
        headSeq: 2,
      },
      updatedAtUnixMs: Date.now(),
    }]);

    const result = resolveManagedWorkspaceGroupList({
      publicKeyHex: PUBLIC_KEY,
      profileId: PROFILE_ID,
      persistedGroups: [group],
    });

    expect(result).toEqual([group]);
  });

  it("hides groups only when ledger is terminal", () => {
    const communityId = "v2_left_group";
    const group = createGroup("left-group", communityId);
    vi.mocked(loadCommunityMembershipLedger).mockReturnValue([{
      communityId,
      groupId: "left-group",
      relayUrl: RELAY_URL,
      status: "left",
    }]);

    const result = resolveManagedWorkspaceGroupList({
      publicKeyHex: PUBLIC_KEY,
      profileId: PROFILE_ID,
      persistedGroups: [group],
    });

    expect(result).toHaveLength(0);
  });

  it("backfills active memberships from joined ledger rows", () => {
    const communityId = "v2_newtest";
    const ledgerGroup = createGroup("newtest-1", communityId);
    vi.mocked(loadCommunityMembershipLedger).mockReturnValue([{
      communityId,
      groupId: "newtest-1",
      relayUrl: RELAY_URL,
      status: "joined",
      displayName: "NewTest 1",
      memberPubkeys: [PUBLIC_KEY, OTHER_KEY],
      adminPubkeys: [PUBLIC_KEY],
    }]);
    vi.mocked(toGroupConversationFromMembershipLedgerEntry).mockReturnValue(ledgerGroup);

    const result = resolveManagedWorkspaceGroupList({
      publicKeyHex: PUBLIC_KEY,
      profileId: PROFILE_ID,
      persistedGroups: [],
    });

    expect(result).toEqual([ledgerGroup]);
  });

  it("skips tombstoned groups", () => {
    const group = createGroup("tombstoned", "v2_tombstoned");
    vi.mocked(isGroupTombstoned).mockReturnValue(true);

    const result = resolveManagedWorkspaceGroupList({
      publicKeyHex: PUBLIC_KEY,
      profileId: PROFILE_ID,
      persistedGroups: [group],
    });

    expect(result).toHaveLength(0);
  });
});
