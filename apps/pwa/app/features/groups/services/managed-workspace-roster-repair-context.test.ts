import { beforeEach, describe, expect, it, vi } from "vitest";
import type { GroupConversation } from "@/app/features/messaging/types";
import type { PublicKeyHex } from "@dweb/crypto/public-key-hex";

vi.mock("@/app/features/workspace-kernel/workspace-kernel-membership-scope", () => ({
  resolveManagedWorkspaceCommunityId: vi.fn(() => "v2_joined"),
  listManagedWorkspaceCommunityIdCandidates: vi.fn(() => ["v2_joined", "group-1:ws://localhost:7000"]),
  findJoinedLedgerEntryForScope: vi.fn(() => ({
    memberPubkeys: ["aa".repeat(32), "bb".repeat(32)],
  })),
}));

vi.mock("./community-membership-ledger", () => ({
  loadCommunityMembershipLedger: vi.fn(() => []),
}));

import { buildManagedWorkspaceRosterRepairContext } from "./managed-workspace-roster-repair-context";

const PK_A = "aa".repeat(32) as PublicKeyHex;

const GROUP: GroupConversation = {
  kind: "group",
  id: "community:group-1",
  communityId: "v2_joined",
  groupId: "group-1",
  relayUrl: "ws://localhost:7000",
  displayName: "NewTest 2",
  memberPubkeys: [PK_A],
  lastMessage: "",
  unreadCount: 0,
  lastMessageTime: new Date(),
  access: "open",
  memberCount: 1,
  adminPubkeys: [],
  communityMode: "managed_workspace",
};

describe("buildManagedWorkspaceRosterRepairContext", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("resolves managed workspace ids and join-evidence seeds for existing groups", () => {
    const context = buildManagedWorkspaceRosterRepairContext({
      group: GROUP,
      publicKeyHex: PK_A,
    });

    expect(context.resolvedCommunityId).toBe("v2_joined");
    expect(context.communityIdCandidates).toEqual(["v2_joined", "group-1:ws://localhost:7000"]);
    expect(context.joinEvidenceMemberPubkeys).toEqual(["aa".repeat(32), "bb".repeat(32)]);
  });
});
