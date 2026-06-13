import { beforeEach, describe, expect, it, vi } from "vitest";
import type { PublicKeyHex } from "@dweb/crypto/public-key-hex";
import type { GroupConversation } from "@/app/features/messaging/types";
import {
  appendDirectoryBackedSidebarGroups,
  resolveDirectorySidebarScope,
} from "./relationship-sync-directory-sidebar";

const PK_A = "aa".repeat(32) as PublicKeyHex;
const PK_B = "bb".repeat(32) as PublicKeyHex;
const PROFILE_ID = "default";
const RELAY = "ws://localhost:7000";
const COMMUNITY_ID = "v2_newtest_2";

vi.mock("./relationship-sync-policy", () => ({
  isRelationshipSyncExperimentEnabled: vi.fn(() => true),
}));

vi.mock("@/app/features/groups/services/community-coordination-membership-directory-store", () => ({
  listCoordinationMembershipDirectoryRecords: vi.fn(() => [{
    communityId: COMMUNITY_ID,
    materialization: {
      activeMemberPubkeys: [PK_A, PK_B],
      leftMemberPubkeys: [],
      expelledMemberPubkeys: [],
      headSeq: 3,
    },
    updatedAtUnixMs: Date.now(),
  }]),
}));

vi.mock("@/app/features/groups/services/community-membership-ledger", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/app/features/groups/services/community-membership-ledger")>();
  return {
    ...actual,
    loadCommunityMembershipLedger: vi.fn(() => [{
      communityId: COMMUNITY_ID,
      groupId: "newtest-2",
      relayUrl: RELAY,
      status: "left",
    }]),
  };
});

vi.mock("@/app/features/groups/services/community-leave-outbox", () => ({
  readCommunityLeaveOutbox: vi.fn(() => []),
}));

vi.mock("@/app/features/groups/services/group-tombstone-store", () => ({
  isGroupTombstoned: vi.fn(() => false),
  loadGroupTombstones: vi.fn(() => new Set<string>()),
}));

vi.mock("@/app/features/groups/services/community-membership-mutation-owner", () => ({
  applyCommunityMembershipRuntimeEvidence: vi.fn(() => ({
    ledgerMutations: [{ reason: "explicit_rejoin", entry: { status: "joined" } }],
  })),
}));

import { loadCommunityMembershipLedger } from "@/app/features/groups/services/community-membership-ledger";
import { applyCommunityMembershipRuntimeEvidence } from "@/app/features/groups/services/community-membership-mutation-owner";
import { readCommunityLeaveOutbox } from "@/app/features/groups/services/community-leave-outbox";

describe("relationship-sync-directory-sidebar", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(loadCommunityMembershipLedger)
      .mockReturnValueOnce([{
        communityId: COMMUNITY_ID,
        groupId: "newtest-2",
        relayUrl: RELAY,
        status: "left",
      }])
      .mockReturnValue([{
        communityId: COMMUNITY_ID,
        groupId: "newtest-2",
        relayUrl: RELAY,
        status: "joined",
        memberPubkeys: [PK_A, PK_B],
        displayName: "NewTest 2",
      }]);
  });

  it("resolves scope from terminal ledger rows", () => {
    const scope = resolveDirectorySidebarScope({
      communityId: COMMUNITY_ID,
      ledger: [{
        communityId: COMMUNITY_ID,
        groupId: "newtest-2",
        relayUrl: RELAY,
        status: "left",
      }],
      persistedGroups: [],
    });
    expect(scope).toEqual({ groupId: "newtest-2", relayUrl: RELAY });
  });

  it("repairs terminal ledger and materializes sidebar row for active directory member", () => {
    const remembered: GroupConversation[] = [];
    const appended = appendDirectoryBackedSidebarGroups({
      publicKeyHex: PK_B,
      profileId: PROFILE_ID,
      persistedGroups: [],
      rememberGroup: (group) => {
        remembered.push(group);
      },
      hasConversationForScope: () => false,
    });

    expect(appended).toBe(1);
    expect(applyCommunityMembershipRuntimeEvidence).toHaveBeenCalledWith(
      expect.objectContaining({
        evidence: expect.objectContaining({ kind: "user_explicit_rejoin" }),
        relayConfirmed: true,
      }),
    );
    expect(remembered[0]?.groupId).toBe("newtest-2");
    expect(remembered[0]?.memberPubkeys).toEqual([PK_A, PK_B]);
  });

  it("skips materialization when leave outbox records intentional leave", () => {
    vi.mocked(readCommunityLeaveOutbox).mockReturnValue([{
      id: "leave-2",
      publicKeyHex: PK_B,
      groupId: "newtest-2",
      relayUrl: RELAY,
      communityId: COMMUNITY_ID,
      intentUnixMs: Date.now(),
      status: "published",
      attemptCount: 1,
    }]);

    const remembered: GroupConversation[] = [];
    const appended = appendDirectoryBackedSidebarGroups({
      publicKeyHex: PK_B,
      profileId: PROFILE_ID,
      persistedGroups: [],
      rememberGroup: (group) => {
        remembered.push(group);
      },
      hasConversationForScope: () => false,
    });

    expect(appended).toBe(0);
    expect(remembered).toHaveLength(0);
    expect(applyCommunityMembershipRuntimeEvidence).not.toHaveBeenCalled();
  });
});
