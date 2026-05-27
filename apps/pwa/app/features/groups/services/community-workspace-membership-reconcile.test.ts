import { beforeEach, describe, expect, it, vi } from "vitest";

const runCoordination = vi.hoisted(() => vi.fn());
const reconcileLocal = vi.hoisted(() => vi.fn());

vi.mock("./community-coordination-membership-reconcile", () => ({
  runCoordinationMembershipReconcile: runCoordination,
}));

vi.mock("./community-membership-evidence-actions", () => ({
  reconcileCommunityMembershipEvidence: reconcileLocal,
}));

vi.mock("./community-workspace-r1-policy", () => ({
  shouldUseCoordinationMembershipAuthority: (mode?: string | null) => mode === "managed_workspace",
}));

import { reconcileWorkspaceMembershipEvidence } from "./community-workspace-membership-reconcile";

describe("reconcileWorkspaceMembershipEvidence", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    runCoordination.mockResolvedValue({
      ok: true,
      appliedDeltaCount: 1,
      headSeq: 1,
      fromSeq: 0,
      toSeq: 1,
    });
  });

  it("runs coordination full resync for managed_workspace", async () => {
    const onSemanticMemberEvent = vi.fn();
    const refreshRelaySubscription = vi.fn();

    const outcome = await reconcileWorkspaceMembershipEvidence({
      groupId: "g1",
      relayUrl: "wss://relay.example.com",
      profileId: "p1",
      communityId: "c1",
      communityMode: "managed_workspace",
      refreshRelaySubscription,
      onSemanticMemberEvent,
    });

    expect(reconcileLocal).toHaveBeenCalled();
    expect(runCoordination).toHaveBeenCalledWith(
      expect.objectContaining({
        communityId: "c1",
        forceFull: true,
        onSemanticMemberEvent,
      }),
    );
    expect(refreshRelaySubscription).toHaveBeenCalled();
    expect(outcome.coordination?.appliedDeltaCount).toBe(1);
  });

  it("skips coordination when not managed_workspace", async () => {
    const outcome = await reconcileWorkspaceMembershipEvidence({
      groupId: "g1",
      relayUrl: "wss://relay.example.com",
      communityMode: "sovereign_room",
      refreshRelaySubscription: vi.fn(),
      onSemanticMemberEvent: vi.fn(),
    });

    expect(runCoordination).not.toHaveBeenCalled();
    expect(outcome.coordination).toBeNull();
  });
});
