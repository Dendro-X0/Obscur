import { describe, expect, it, beforeEach } from "vitest";
import type { PublicKeyHex } from "@dweb/crypto/public-key-hex";
import {
  clearCommunityTerminalMembershipCache,
  loadCommunityTerminalMembershipCache,
  mergeTerminalMemberPubkeys,
  reinstateCommunityMemberTerminalEvidence,
  saveCommunityTerminalMembershipCache,
  stripTerminalCommunityMembersWithActiveEvidence,
} from "./community-terminal-membership-cache";

const GROUP_ID = "group-test";
const RELAY_URL = "wss://relay.example";
const PK_LEFT = "a".repeat(64) as PublicKeyHex;
const PK_EXPELLED = "b".repeat(64) as PublicKeyHex;

describe("community-terminal-membership-cache", () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it("merges and dedupes terminal pubkey lists", () => {
    expect(mergeTerminalMemberPubkeys([PK_LEFT], [PK_LEFT, PK_EXPELLED])).toEqual([PK_LEFT, PK_EXPELLED]);
  });

  it("round-trips left and expelled members for a community scope", () => {
    saveCommunityTerminalMembershipCache({
      groupId: GROUP_ID,
      relayUrl: RELAY_URL,
      leftMemberPubkeys: [PK_LEFT],
      expelledMemberPubkeys: [PK_EXPELLED],
    });
    const loaded = loadCommunityTerminalMembershipCache({ groupId: GROUP_ID, relayUrl: RELAY_URL });
    expect(loaded?.leftMemberPubkeys).toEqual([PK_LEFT]);
    expect(loaded?.expelledMemberPubkeys).toEqual([PK_EXPELLED]);
  });

  it("reinstates a member by clearing terminal left/expelled evidence", () => {
    saveCommunityTerminalMembershipCache({
      groupId: GROUP_ID,
      relayUrl: RELAY_URL,
      leftMemberPubkeys: [PK_LEFT],
      expelledMemberPubkeys: [PK_EXPELLED],
    });
    reinstateCommunityMemberTerminalEvidence({
      groupId: GROUP_ID,
      relayUrl: RELAY_URL,
      memberPubkeys: [PK_LEFT],
    });
    const loaded = loadCommunityTerminalMembershipCache({ groupId: GROUP_ID, relayUrl: RELAY_URL });
    expect(loaded?.leftMemberPubkeys).toEqual([]);
    expect(loaded?.expelledMemberPubkeys).toEqual([PK_EXPELLED]);
  });

  it("removes storage when terminal lists are cleared", () => {
    saveCommunityTerminalMembershipCache({
      groupId: GROUP_ID,
      relayUrl: RELAY_URL,
      leftMemberPubkeys: [PK_LEFT],
      expelledMemberPubkeys: [],
    });
    saveCommunityTerminalMembershipCache({
      groupId: GROUP_ID,
      relayUrl: RELAY_URL,
      leftMemberPubkeys: [],
      expelledMemberPubkeys: [],
    });
    expect(loadCommunityTerminalMembershipCache({ groupId: GROUP_ID, relayUrl: RELAY_URL })).toBeNull();
  });

  it("stripTerminalCommunityMembersWithActiveEvidence clears left when author chats again", () => {
    saveCommunityTerminalMembershipCache({
      groupId: GROUP_ID,
      relayUrl: RELAY_URL,
      leftMemberPubkeys: [PK_LEFT],
      expelledMemberPubkeys: [],
    });
    const changed = stripTerminalCommunityMembersWithActiveEvidence({
      groupId: GROUP_ID,
      relayUrl: RELAY_URL,
      conversationAuthorPubkeys: [PK_LEFT],
    });
    expect(changed).toBe(true);
    expect(loadCommunityTerminalMembershipCache({ groupId: GROUP_ID, relayUrl: RELAY_URL })).toBeNull();
  });

  it("does not clear protected sealed leave evidence when author participation exists", () => {
    saveCommunityTerminalMembershipCache({
      groupId: GROUP_ID,
      relayUrl: RELAY_URL,
      leftMemberPubkeys: [PK_LEFT],
      expelledMemberPubkeys: [],
    });
    const changed = stripTerminalCommunityMembersWithActiveEvidence({
      groupId: GROUP_ID,
      relayUrl: RELAY_URL,
      conversationAuthorPubkeys: [PK_LEFT],
      protectedTerminalMemberPubkeys: [PK_LEFT],
    });
    expect(changed).toBe(false);
    expect(loadCommunityTerminalMembershipCache({ groupId: GROUP_ID, relayUrl: RELAY_URL })?.leftMemberPubkeys).toEqual([PK_LEFT]);
  });

  it("clearCommunityTerminalMembershipCache removes persisted terminal evidence", () => {
    saveCommunityTerminalMembershipCache({
      groupId: GROUP_ID,
      relayUrl: RELAY_URL,
      leftMemberPubkeys: [PK_LEFT],
      expelledMemberPubkeys: [PK_EXPELLED],
    });
    clearCommunityTerminalMembershipCache({ groupId: GROUP_ID, relayUrl: RELAY_URL });
    expect(loadCommunityTerminalMembershipCache({ groupId: GROUP_ID, relayUrl: RELAY_URL })).toBeNull();
  });
});
