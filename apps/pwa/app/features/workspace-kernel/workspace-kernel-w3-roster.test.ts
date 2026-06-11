import { describe, expect, it, vi } from "vitest";
import {
  buildWorkspaceKernelRosterProjection,
  isWorkspaceKernelRosterPortReady,
  resolveWorkspaceKernelActiveMemberPubkeys,
} from "./workspace-kernel-roster-port";
import { evaluateComRosterTwoProfileGate } from "./workspace-kernel-com-roster-gate";

vi.mock("@/app/features/runtime/native-persistence-policy", () => ({
  requiresSqlitePersistence: vi.fn(() => true),
}));

describe("workspace-kernel COM-ROSTER gate", () => {
  const creator = "aa".repeat(32) as `${string}`;
  const joiner = "bb".repeat(32) as `${string}`;
  const communityId = "room-1:ws://localhost:7000";

  it("passes two-profile join then leave roster projection", () => {
    const result = evaluateComRosterTwoProfileGate({
      communityId,
      creatorPubkey: creator,
      joinerPubkey: joiner,
    });
    expect(result.passed).toBe(true);
    expect(result.reason).toBe("com_roster_ok");
    expect(result.afterJoin.activeMemberPubkeys).toContain(creator);
    expect(result.afterJoin.activeMemberPubkeys).toContain(joiner);
    expect(result.afterLeave.activeMemberPubkeys).toContain(creator);
    expect(result.afterLeave.activeMemberPubkeys).not.toContain(joiner);
  });
});

describe("workspace-kernel roster port", () => {
  it("is ready when workspace-kernel authority is on", () => {
    expect(isWorkspaceKernelRosterPortReady()).toBe(true);
  });

  it("projects active member pubkeys from coordination snapshot", () => {
    const creator = "cc".repeat(32) as `${string}`;
    const projection = buildWorkspaceKernelRosterProjection(
      {
        kind: "group",
        id: "community:room-1",
        communityId: "room-1:ws://localhost:7000",
        groupId: "room-1",
        relayUrl: "ws://localhost:7000",
        communityMode: "managed_workspace",
        displayName: "Ops",
        memberPubkeys: [],
        lastMessage: "",
        unreadCount: 0,
        lastMessageTime: new Date(),
        access: "invite-only",
        memberCount: 1,
        adminPubkeys: [],
      },
      {
        syncStatus: "fresh",
        coordinationDirectory: {
          activeMemberPubkeys: [creator],
          leftMemberPubkeys: [],
          expelledMemberPubkeys: [],
        },
        activeMemberPubkeys: [creator],
        leftMemberPubkeys: [],
        expelledMemberPubkeys: [],
        inviteBlocklistPubkeys: [creator],
      },
    );
    expect(resolveWorkspaceKernelActiveMemberPubkeys({ rosterProjection: projection })).toEqual([creator]);
  });
});
