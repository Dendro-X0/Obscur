import { beforeEach, describe, expect, it, vi } from "vitest";
import type { PublicKeyHex } from "@dweb/crypto/public-key-hex";
import type { GroupConversation } from "@/app/features/messaging/types";

vi.mock("./community-dev-flags", () => ({
  isWorkspaceR1MembershipEnforced: vi.fn(() => true),
}));

vi.mock("./community-membership-sync-mode", () => ({
  isCoordinationConfigured: vi.fn(() => true),
  readMembershipSyncMode: vi.fn(() => "coordination_preferred" as const),
}));

vi.mock("@/app/features/workspace-kernel/workspace-kernel-policy", () => ({
  isWorkspaceKernelAuthority: vi.fn(() => true),
}));

vi.mock("./strict-managed-workspace", () => ({
  isStrictManagedWorkspaceRelay: vi.fn((relayUrl?: string | null) => (
    (relayUrl ?? "").includes("localhost")
  )),
}));

import { enrichWorkspaceGroupConversation, shouldUseCoordinationMembershipAuthority } from "./community-workspace-r1-policy";
import { usesCoordinationMembershipDirectory } from "./community-workspace-transport-policy";
import { resolveCommunityInviteMemberBlocklist } from "./community-invite-eligibility-read-model";
import { resolveCommunityParticipantDisplayPubkeys } from "./community-participant-display-read-model";

const PK_A = "aa".repeat(32) as PublicKeyHex;
const PK_B = "bb".repeat(32) as PublicKeyHex;
const LOCAL_RELAY = "ws://localhost:7000";

const LEGACY_JOINER_GROUP: GroupConversation = {
  kind: "group",
  id: "community:newtest-2",
  groupId: "newtest-2",
  relayUrl: LOCAL_RELAY,
  displayName: "NewTest 2",
  memberPubkeys: [PK_A, PK_B],
  lastMessage: "",
  unreadCount: 0,
  lastMessageTime: new Date(),
  access: "open",
  memberCount: 2,
  adminPubkeys: [],
};

describe("community joiner membership repair", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("infers managed_workspace for legacy join rows on local operator relay", () => {
    const enriched = enrichWorkspaceGroupConversation(LEGACY_JOINER_GROUP);
    expect(enriched.communityMode).toBe("managed_workspace");
    expect(shouldUseCoordinationMembershipAuthority(undefined, LOCAL_RELAY)).toBe(true);
    expect(usesCoordinationMembershipDirectory(undefined, LOCAL_RELAY)).toBe(true);
  });

  it("shows both join-evidence members when coordination directory only has self", () => {
    const display = resolveCommunityParticipantDisplayPubkeys({
      communityMode: "managed_workspace",
      relayUrl: LOCAL_RELAY,
      coordinationDirectory: {
        activeMemberPubkeys: [PK_A],
        leftMemberPubkeys: [],
        expelledMemberPubkeys: [],
        headSeq: 2,
      },
      monotonicDisplayPubkeys: [PK_A],
      joinEvidenceMemberPubkeys: [PK_A, PK_B],
      localMemberPubkey: PK_A,
    });
    expect(display).toEqual([PK_A, PK_B]);
  });

  it("blocks re-invite for join-evidence members when directory is stale", () => {
    const blocklist = resolveCommunityInviteMemberBlocklist({
      communityMode: "managed_workspace",
      relayUrl: LOCAL_RELAY,
      coordinationDirectory: {
        activeMemberPubkeys: [PK_A],
        leftMemberPubkeys: [],
        expelledMemberPubkeys: [],
        headSeq: 2,
      },
      hybridActiveMemberPubkeys: [PK_A],
      joinEvidenceMemberPubkeys: [PK_A, PK_B],
      leftMemberPubkeys: [],
      expelledMemberPubkeys: [],
    });
    expect(blocklist).toEqual([PK_A, PK_B]);
  });
});
