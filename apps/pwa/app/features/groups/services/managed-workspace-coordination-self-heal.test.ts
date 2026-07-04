import { beforeEach, describe, expect, it, vi } from "vitest";
import type { PublicKeyHex } from "@dweb/crypto/public-key-hex";

const publishDelta = vi.hoisted(() => vi.fn());
const refreshDirectory = vi.hoisted(() => vi.fn());
const loadDirectory = vi.hoisted(() => vi.fn());
const loadLedger = vi.hoisted(() => vi.fn());

vi.mock("./community-coordination-membership-client", () => ({
  publishCoordinationMembershipDelta: vi.fn(publishDelta),
}));

vi.mock("./community-coordination-membership-directory-store", () => ({
  loadCoordinationMembershipDirectory: vi.fn(loadDirectory),
  refreshCoordinationMembershipDirectory: vi.fn(refreshDirectory),
}));

vi.mock("./community-membership-ledger", () => ({
  loadCommunityMembershipLedger: vi.fn(loadLedger),
}));

vi.mock("./community-workspace-r1-policy", () => ({
  shouldUseCoordinationMembershipAuthority: () => true,
}));

import { attemptManagedWorkspaceCoordinationSelfHeal } from "./managed-workspace-coordination-self-heal";

const member = "aa".repeat(32) as PublicKeyHex;
const privateKey = "bb".repeat(32);

describe("attemptManagedWorkspaceCoordinationSelfHeal", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    loadLedger.mockReturnValue([{
      groupId: "newtest-2",
      relayUrl: "ws://localhost:7000",
      status: "joined",
      memberPubkeys: [member],
    }]);
    loadDirectory.mockReturnValue(null);
    publishDelta.mockResolvedValue({ success: true, seq: 2 });
    refreshDirectory.mockResolvedValue({
      activeMemberPubkeys: [member],
      leftMemberPubkeys: [],
      expelledMemberPubkeys: [],
      headSeq: 2,
    });
  });

  it("republishes join when ledger is joined but directory omits local member", async () => {
    loadDirectory
      .mockReturnValueOnce(null)
      .mockReturnValueOnce({
        activeMemberPubkeys: [member],
        leftMemberPubkeys: [],
        expelledMemberPubkeys: [],
        headSeq: 2,
      });

    const result = await attemptManagedWorkspaceCoordinationSelfHeal({
      groupId: "newtest-2",
      relayUrl: "ws://localhost:7000",
      communityId: "v2_community",
      communityMode: "managed_workspace",
      localMemberPubkey: member,
      actorPrivateKeyHex: privateKey,
    });

    expect(publishDelta).toHaveBeenCalledWith(expect.objectContaining({
      communityId: "v2_community",
      action: "join",
      subjectPubkey: member,
    }));
    expect(result.healed).toBe(true);
  });

  it("skips publish when directory already lists local member", async () => {
    loadDirectory.mockReturnValue({
      activeMemberPubkeys: [member],
      leftMemberPubkeys: [],
      expelledMemberPubkeys: [],
      headSeq: 1,
    });

    const result = await attemptManagedWorkspaceCoordinationSelfHeal({
      groupId: "newtest-2",
      relayUrl: "ws://localhost:7000",
      communityId: "v2_community",
      communityMode: "managed_workspace",
      localMemberPubkey: member,
      actorPrivateKeyHex: privateKey,
    });

    expect(publishDelta).not.toHaveBeenCalled();
    expect(result.healed).toBe(true);
  });
});
