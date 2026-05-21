import { beforeEach, describe, expect, it, vi } from "vitest";
import type { PublicKeyHex } from "@dweb/crypto/public-key-hex";
import { loadCommunityProvisionalMemberPubkeys, markCommunityProvisionalMembers } from "./community-provisional-membership-cache";
import {
  clearCommunityTerminalMembershipEvidence,
  reconcileCommunityMembershipEvidence,
} from "./community-membership-evidence-actions";

vi.mock("@/app/shared/log-app-event", () => ({
  logAppEvent: vi.fn(),
}));

const GROUP_ID = "group-evidence";
const RELAY_URL = "wss://relay.example";
const PK = "c".repeat(64) as PublicKeyHex;

describe("community-membership-evidence-actions", () => {
  beforeEach(() => {
    window.localStorage.clear();
    vi.clearAllMocks();
  });

  it("reconcileCommunityMembershipEvidence clears provisional overlay and calls refresh", () => {
    markCommunityProvisionalMembers({
      groupId: GROUP_ID,
      relayUrl: RELAY_URL,
      memberPubkeys: [PK],
      ttlMs: 60_000,
    });
    const refresh = vi.fn();
    reconcileCommunityMembershipEvidence({
      groupId: GROUP_ID,
      relayUrl: RELAY_URL,
      refreshRelaySubscription: refresh,
    });
    expect(loadCommunityProvisionalMemberPubkeys({ groupId: GROUP_ID, relayUrl: RELAY_URL })).toEqual([]);
    expect(refresh).toHaveBeenCalledTimes(1);
  });

  it("clearCommunityTerminalMembershipEvidence invokes terminal clear and refresh", () => {
    const clearTerminal = vi.fn();
    const refresh = vi.fn();
    clearCommunityTerminalMembershipEvidence({
      groupId: GROUP_ID,
      relayUrl: RELAY_URL,
      clearLocalTerminalMembershipEvidence: clearTerminal,
      refreshRelaySubscription: refresh,
    });
    expect(clearTerminal).toHaveBeenCalledTimes(1);
    expect(refresh).toHaveBeenCalledTimes(1);
  });
});
