import { describe, expect, it, vi } from "vitest";
import {
  buildComMemTwoProfileScenarioDeltas,
  evaluateComMemTwoProfileGate,
} from "./workspace-kernel-com-mem-gate";
import { isWorkspaceCommunityCreateAllowed } from "./workspace-kernel-sovereign-create-policy";
import { isWorkspaceKernelMembershipPortReady } from "./workspace-kernel-membership-port";
import { publishWorkspaceKernelLeave } from "./workspace-kernel-leave-port";

vi.mock("@/app/features/runtime/native-persistence-policy", () => ({
  requiresSqlitePersistence: vi.fn(() => true),
}));

vi.mock("@/app/features/groups/services/community-membership-sync-mode", () => ({
  isCoordinationConfigured: vi.fn(() => true),
  getCoordinationBaseUrl: vi.fn(() => "http://127.0.0.1:8787"),
}));

vi.mock("@/app/features/groups/services/community-relay-confirmed-leave", () => ({
  publishRelayConfirmedCommunityLeave: vi.fn(async () => true),
}));

describe("workspace-kernel COM-MEM gate", () => {
  const creator = "aa".repeat(32) as `${string}`;
  const joiner = "bb".repeat(32) as `${string}`;
  const communityId = "room-1:ws://localhost:7000";

  it("passes two-profile join then leave materialization", () => {
    const deltas = buildComMemTwoProfileScenarioDeltas({
      communityId,
      creatorPubkey: creator,
      joinerPubkey: joiner,
    });
    const result = evaluateComMemTwoProfileGate({ deltas, creatorPubkey: creator, joinerPubkey: joiner });
    expect(result.passed).toBe(true);
    expect(result.reason).toBe("com_mem_ok");
    expect(result.creatorView.activeMemberPubkeys).toContain(creator);
    expect(result.creatorView.activeMemberPubkeys).not.toContain(joiner);
    expect(result.creatorView.leftMemberPubkeys).toContain(joiner);
  });
});

describe("workspace-kernel membership port readiness", () => {
  it("is ready on native when coordination is configured", () => {
    expect(isWorkspaceKernelMembershipPortReady()).toBe(true);
    expect(isWorkspaceCommunityCreateAllowed()).toBe(true);
  });
});

describe("workspace-kernel leave-port", () => {
  it("returns relay confirmation without local commit", async () => {
    const confirmed = await publishWorkspaceKernelLeave({
      pool: {} as never,
      group: {
        kind: "group",
        id: "g1",
        groupId: "room",
        relayUrl: "ws://localhost:7000",
        communityId: "room:ws://localhost:7000",
        communityMode: "managed_workspace",
        displayName: "Room",
        memberPubkeys: [],
        lastMessage: "",
        unreadCount: 0,
        lastMessageTime: new Date(),
        access: "invite-only",
        memberCount: 1,
        adminPubkeys: [],
      },
      myPublicKeyHex: "aa".repeat(32) as `${string}`,
      myPrivateKeyHex: "cc".repeat(32) as `${string}`,
    });
    expect(confirmed).toBe(true);
  });
});
