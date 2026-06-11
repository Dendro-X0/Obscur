import { beforeEach, describe, expect, it, vi } from "vitest";
import type { PublicKeyHex } from "@dweb/crypto/public-key-hex";
import type { GroupConversation } from "@/app/features/messaging/types";
import { upsertWorkspaceGroupMetadata } from "./workspace-kernel-group-metadata-cache";

const PUBLIC_KEY = "a".repeat(64) as PublicKeyHex;
const PROFILE_ID = "default";
const RELAY_URL = "ws://localhost:7000";

vi.mock("./workspace-kernel-policy", () => ({
  isWorkspaceKernelAuthority: () => true,
}));

vi.mock("@/app/features/groups/services/group-tombstone-store", () => ({
  isGroupTombstoned: vi.fn(() => false),
}));

vi.mock("@/app/features/groups/services/community-membership-ledger", () => ({
  loadCommunityMembershipLedger: vi.fn(() => []),
  toGroupConversationFromMembershipLedgerEntry: vi.fn(),
}));

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

describe("workspace-kernel-group-metadata-cache", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    window.localStorage.clear();
  });

  it("upsert writes durable metadata for restart recovery", () => {
    const group = createGroup("newtest-1");
    upsertWorkspaceGroupMetadata(PUBLIC_KEY, PROFILE_ID, group);

    const raw = window.localStorage.getItem(`obscur.workspace-kernel.group_metadata.v1.${PUBLIC_KEY}::${PROFILE_ID}`);
    expect(raw).toContain("newtest-1");
  });
});
