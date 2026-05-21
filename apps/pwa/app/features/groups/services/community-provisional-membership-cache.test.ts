import { beforeEach, describe, expect, it, vi } from "vitest";
import type { PublicKeyHex } from "@dweb/crypto/public-key-hex";
import {
  clearCommunityProvisionalMembershipRecord,
  loadCommunityProvisionalMemberPubkeys,
  markCommunityProvisionalMembers,
  stripProvisionalCommunityMembersConfirmedOnRelay,
} from "./community-provisional-membership-cache";

const GROUP_ID = "group-test";
const RELAY_URL = "wss://relay.example";
const PK_A = "a".repeat(64) as PublicKeyHex;
const PK_B = "b".repeat(64) as PublicKeyHex;

describe("community-provisional-membership-cache", () => {
  beforeEach(() => {
    vi.useRealTimers();
    window.localStorage.clear();
  });

  it("stores and loads provisional members", () => {
    markCommunityProvisionalMembers({
      groupId: GROUP_ID,
      relayUrl: RELAY_URL,
      memberPubkeys: [PK_A, PK_B],
      ttlMs: 60_000,
    });
    expect(loadCommunityProvisionalMemberPubkeys({ groupId: GROUP_ID, relayUrl: RELAY_URL })).toEqual([PK_A, PK_B]);
  });

  it("expires provisional members after ttl", () => {
    vi.useFakeTimers();
    markCommunityProvisionalMembers({
      groupId: GROUP_ID,
      relayUrl: RELAY_URL,
      memberPubkeys: [PK_A],
      ttlMs: 1,
    });
    vi.advanceTimersByTime(5);
    expect(loadCommunityProvisionalMemberPubkeys({ groupId: GROUP_ID, relayUrl: RELAY_URL })).toEqual([]);
  });

  it("stripProvisionalCommunityMembersConfirmedOnRelay removes relay-confirmed pubkeys", () => {
    markCommunityProvisionalMembers({
      groupId: GROUP_ID,
      relayUrl: RELAY_URL,
      memberPubkeys: [PK_A, PK_B],
      ttlMs: 60_000,
    });
    const changed = stripProvisionalCommunityMembersConfirmedOnRelay({
      groupId: GROUP_ID,
      relayUrl: RELAY_URL,
      relayBackedMemberPubkeys: [PK_A.toUpperCase()],
    });
    expect(changed).toBe(true);
    expect(loadCommunityProvisionalMemberPubkeys({ groupId: GROUP_ID, relayUrl: RELAY_URL })).toEqual([PK_B]);
  });

  it("stripProvisionalCommunityMembersConfirmedOnRelay returns false when nothing to remove", () => {
    markCommunityProvisionalMembers({
      groupId: GROUP_ID,
      relayUrl: RELAY_URL,
      memberPubkeys: [PK_A],
      ttlMs: 60_000,
    });
    const changed = stripProvisionalCommunityMembersConfirmedOnRelay({
      groupId: GROUP_ID,
      relayUrl: RELAY_URL,
      relayBackedMemberPubkeys: [PK_B],
    });
    expect(changed).toBe(false);
    expect(loadCommunityProvisionalMemberPubkeys({ groupId: GROUP_ID, relayUrl: RELAY_URL })).toEqual([PK_A]);
  });

  it("clearCommunityProvisionalMembershipRecord removes the overlay", () => {
    markCommunityProvisionalMembers({
      groupId: GROUP_ID,
      relayUrl: RELAY_URL,
      memberPubkeys: [PK_A],
      ttlMs: 60_000,
    });
    clearCommunityProvisionalMembershipRecord({ groupId: GROUP_ID, relayUrl: RELAY_URL });
    expect(loadCommunityProvisionalMemberPubkeys({ groupId: GROUP_ID, relayUrl: RELAY_URL })).toEqual([]);
  });
});
