import { beforeEach, describe, expect, it, vi } from "vitest";
import type { PublicKeyHex } from "@dweb/crypto/public-key-hex";
import type { GroupConversation } from "@/app/features/messaging/types";
import type { CommunityMembershipLedgerEntry } from "@/app/features/groups/services/community-membership-ledger";

const PUBLIC_KEY = "a".repeat(64) as PublicKeyHex;
const PROFILE_ID = "default";
const RELAY_URL = "ws://localhost:7000";

vi.mock("./workspace-kernel-policy", () => ({
  isWorkspaceKernelAuthority: () => true,
}));

vi.mock("@/app/features/groups/services/group-tombstone-store", () => ({
  isGroupTombstoned: vi.fn(() => false),
}));

const chatStateReplace = vi.hoisted(() => vi.fn());
const chatStateLoad = vi.hoisted(() => vi.fn<(profileId?: string) => unknown>(() => null));
const loadCommunityMembershipLedgerMock = vi.hoisted(() => (
  vi.fn<(publicKeyHex: string, options?: { profileId?: string }) => ReadonlyArray<CommunityMembershipLedgerEntry>>(() => [])
));

vi.mock("@/app/features/messaging/services/chat-state-store", () => ({
  chatStateStoreService: {
    load: (profileId?: string) => chatStateLoad(profileId),
    replace: (
      publicKeyHex: string,
      state: unknown,
      options?: { profileId?: string },
    ) => chatStateReplace(publicKeyHex, state, options),
    update: vi.fn(),
  },
}));

vi.mock("@/app/features/groups/services/community-membership-ledger", () => ({
  loadCommunityMembershipLedger: (publicKeyHex: string, options?: { profileId?: string }) => (
    loadCommunityMembershipLedgerMock(publicKeyHex, options)
  ),
  toGroupConversationFromMembershipLedgerEntry: vi.fn(),
}));

import {
  loadWorkspaceGroupMetadataRecords,
  saveWorkspaceGroupMetadataRecords,
  upsertWorkspaceGroupMetadataRecord,
} from "./workspace-kernel-group-metadata-store";

const createGroup = (groupId: string): GroupConversation => ({
  kind: "group",
  id: `community:${groupId}:${RELAY_URL}`,
  communityId: `v2_${groupId}`,
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

describe("workspace-kernel-group-metadata-store", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    window.localStorage.clear();
    chatStateLoad.mockReturnValue(null);
    loadCommunityMembershipLedgerMock.mockReturnValue([]);
  });

  it("persists groups in dedicated storage independent of chat-state", () => {
    const group = createGroup("newtest-1");
    saveWorkspaceGroupMetadataRecords(PUBLIC_KEY, PROFILE_ID, [group]);

    chatStateReplace(PUBLIC_KEY, {
      version: 2,
      createdGroups: [createGroup("test-10")].map((row) => ({
        id: row.id,
        communityId: row.communityId,
        groupId: row.groupId,
        relayUrl: row.relayUrl,
        displayName: row.displayName,
        memberPubkeys: row.memberPubkeys,
        lastMessage: row.lastMessage,
        unreadCount: 0,
        lastMessageTimeMs: 0,
        access: row.access,
        memberCount: row.memberCount,
        adminPubkeys: row.adminPubkeys,
        communityMode: row.communityMode,
      })),
      createdConnections: [],
      unreadByConversationId: {},
      connectionOverridesByConnectionId: {},
      messagesByConversationId: {},
      groupMessages: {},
      pinnedChatIds: [],
      hiddenChatIds: [],
    }, { profileId: PROFILE_ID });

    const loaded = loadWorkspaceGroupMetadataRecords(PUBLIC_KEY, PROFILE_ID);
    expect(loaded).toHaveLength(1);
    expect(loaded[0]?.groupId).toBe("newtest-1");
  });

  it("does not migrate chat-state groups with terminal ledger evidence", () => {
    loadCommunityMembershipLedgerMock.mockReturnValue([{
      communityId: "v2_test10",
      groupId: "test-10",
      relayUrl: RELAY_URL,
      status: "left",
    } satisfies CommunityMembershipLedgerEntry]);
    chatStateLoad.mockReturnValue({
      createdGroups: [{
        id: `community:test-10:${RELAY_URL}`,
        communityId: "v2_test10",
        groupId: "test-10",
        relayUrl: RELAY_URL,
        displayName: "Test 10",
        memberPubkeys: [PUBLIC_KEY],
        lastMessage: "",
        unreadCount: 0,
        lastMessageTimeMs: 0,
        access: "open",
        memberCount: 1,
        adminPubkeys: [],
        communityMode: "managed_workspace",
      }],
    });

    const loaded = loadWorkspaceGroupMetadataRecords(PUBLIC_KEY, PROFILE_ID);
    expect(loaded).toHaveLength(0);
  });

  it("upsert keeps prior dedicated rows when adding another group", () => {
    upsertWorkspaceGroupMetadataRecord(PUBLIC_KEY, PROFILE_ID, createGroup("newtest-1"));
    const next = upsertWorkspaceGroupMetadataRecord(PUBLIC_KEY, PROFILE_ID, createGroup("newtest-2"));
    expect(next.map((group) => group.groupId).sort()).toEqual(["newtest-1", "newtest-2"]);
  });

  it("save does not re-insert joined ledger rows into dedicated metadata", () => {
    loadCommunityMembershipLedgerMock.mockReturnValue([{
      communityId: "v2_test10",
      groupId: "test-10",
      relayUrl: RELAY_URL,
      status: "joined",
    } satisfies CommunityMembershipLedgerEntry]);
    saveWorkspaceGroupMetadataRecords(PUBLIC_KEY, PROFILE_ID, [createGroup("newtest-1")]);
    const loaded = loadWorkspaceGroupMetadataRecords(PUBLIC_KEY, PROFILE_ID);
    expect(loaded.map((group) => group.groupId)).toEqual(["newtest-1"]);
  });
});
