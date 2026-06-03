import { beforeEach, describe, expect, it } from "vitest";
import type { PublicKeyHex } from "@dweb/crypto/public-key-hex";
import { setProfileScopeOverride } from "@/app/features/profiles/services/profile-scope";
import {
  loadCommunityTerminalMembershipCache,
  saveCommunityTerminalMembershipCache,
} from "./community-terminal-membership-cache";
import {
  persistTerminalInvitePeerLeftEvidence,
  removePubkeyFromMemberList,
} from "./community-invite-terminal-membership";

const OWNER = "a".repeat(64) as PublicKeyHex;
const PEER = "b".repeat(64) as PublicKeyHex;
const GROUP_ID = "decline-peer";
const RELAY_URL = "wss://relay.peer";

describe("community-invite-terminal-membership (MEM-005)", () => {
  beforeEach(() => {
    window.localStorage.clear();
    setProfileScopeOverride(null);
  });

  it("persists terminal left evidence for declined/canceled invite peer", () => {
    persistTerminalInvitePeerLeftEvidence({
      groupId: GROUP_ID,
      relayUrl: RELAY_URL,
      peerPublicKeyHex: PEER,
      responseStatus: "declined",
    });

    const cache = loadCommunityTerminalMembershipCache({
      groupId: GROUP_ID,
      relayUrl: RELAY_URL,
    });
    expect(cache?.leftMemberPubkeys).toEqual([PEER]);
  });

  it("merges terminal left evidence without dropping prior entries", () => {
    saveCommunityTerminalMembershipCache({
      groupId: GROUP_ID,
      relayUrl: RELAY_URL,
      leftMemberPubkeys: ["c".repeat(64)],
      expelledMemberPubkeys: [],
    });

    persistTerminalInvitePeerLeftEvidence({
      groupId: GROUP_ID,
      relayUrl: RELAY_URL,
      peerPublicKeyHex: PEER,
      responseStatus: "canceled",
    });

    const cache = loadCommunityTerminalMembershipCache({
      groupId: GROUP_ID,
      relayUrl: RELAY_URL,
    });
    expect(cache?.leftMemberPubkeys).toEqual(expect.arrayContaining([PEER, "c".repeat(64)]));
  });

  it("removePubkeyFromMemberList drops only the target peer", () => {
    expect(removePubkeyFromMemberList([OWNER, PEER], PEER)).toEqual([OWNER]);
  });
});
