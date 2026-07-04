import { describe, expect, it } from "vitest";
import {
  assertWorkspaceLeaveRequiresRelayConfirmation,
  buildWorkspaceRosterProjection,
} from "./workspace-roster";

describe("workspace-engine roster", () => {
  it("builds roster projection from membership truth", () => {
    const projection = buildWorkspaceRosterProjection({
      conversationId: "community:g1",
      groupId: "g1",
      relayUrl: "wss://relay.example",
      communityId: "comm-1",
      snapshot: {
        activeMemberPubkeys: ["aa", "bb"],
        syncStatus: "synced",
      },
    });
    expect(projection.memberCount).toBe(2);
    expect(projection.activeMemberPubkeys).toEqual(["aa", "bb"]);
  });

  it("requires relay confirmation before leave commit", () => {
    expect(() => assertWorkspaceLeaveRequiresRelayConfirmation(false)).toThrow(/relayConfirmed required/);
    expect(() => assertWorkspaceLeaveRequiresRelayConfirmation(true)).not.toThrow();
  });
});
