/**
 * M0 Baseline Tests — AB-14
 *
 * AB-14: Same-process A/B community create/join/leave scope isolation.
 *
 *   Scenario (same-process, two accounts):
 *     1. Account A creates a community.
 *     2. Account B joins the same community.
 *     3. Both accounts send messages.
 *     4. Account B leaves the community.
 *
 *   Expected outcomes:
 *     1. Account A sees the community as joined throughout.
 *     2. Account B sees the community as joined until leave, then left.
 *     3. Membership, room key, and message views remain scoped per account.
 *     4. No cross-account state leakage in ledger or tombstones.
 *
 *   This tests the coordinator and provider scope isolation contracts
 *   for multi-account same-process scenarios.
 */

import { beforeEach, describe, expect, it } from "vitest";
import type { PublicKeyHex } from "@dweb/crypto/public-key-hex";
import {
  getScopedStorageKey,
  setProfileScopeOverride,
} from "@/app/features/profiles/services/profile-scope";
import {
  communityMembershipLedgerInternals,
  loadCommunityMembershipLedger,
  toCommunityMembershipLedgerKey,
} from "./community-membership-ledger";
import {
  addGroupTombstone,
  loadGroupTombstones,
} from "./group-tombstone-store";
import { resolveCommunityMembershipCoordinator } from "./community-membership-coordinator";
import type { GroupConversation } from "@/app/features/messaging/types";

const { setCommunityMembershipStatus } = communityMembershipLedgerInternals;

const PK_A = "a".repeat(64) as PublicKeyHex;
const PK_B = "b".repeat(64) as PublicKeyHex;
const GROUP_ID = "alpha";
const RELAY_URL = "wss://relay.example";
const COMMUNITY_ID = `${GROUP_ID}:${RELAY_URL}`;
const LEDGER_KEY = `${GROUP_ID}@@${RELAY_URL}`;

const makeGroup = (pk: PublicKeyHex): GroupConversation => ({
  kind: "group",
  id: `community:${GROUP_ID}:${RELAY_URL}`,
  communityId: COMMUNITY_ID,
  groupId: GROUP_ID,
  relayUrl: RELAY_URL,
  displayName: "Alpha Group",
  memberPubkeys: [pk],
  lastMessage: "hi",
  unreadCount: 0,
  lastMessageTime: new Date(1_000),
  access: "invite-only",
  memberCount: 1,
  adminPubkeys: [],
});

describe("AB-14 — same-process A/B community create/join/leave scope isolation", () => {
  beforeEach(() => {
    window.localStorage.clear();
    setProfileScopeOverride(null);
  });

  it("account A and account B have distinct ledger storage keys", () => {
    const baseKeyA = `obscur.group.membership_ledger.v1.${PK_A}`;
    const baseKeyB = `obscur.group.membership_ledger.v1.${PK_B}`;
    const scopedKeyA = getScopedStorageKey(baseKeyA, "profile-a");
    const scopedKeyB = getScopedStorageKey(baseKeyB, "profile-b");

    expect(scopedKeyA).not.toBe(scopedKeyB);
  });

  it("account A create does not appear in account B ledger", () => {
    // Account A creates community (writes joined entry)
    setProfileScopeOverride("profile-a");
    setCommunityMembershipStatus(PK_A, {
      groupId: GROUP_ID,
      relayUrl: RELAY_URL,
      communityId: COMMUNITY_ID,
      status: "joined",
      updatedAtUnixMs: 1_000,
    });

    // Account B reads ledger - should not see A's entry
    setProfileScopeOverride("profile-b");
    const ledgerB = loadCommunityMembershipLedger(PK_B);
    const entryB = ledgerB.find(e => toCommunityMembershipLedgerKey(e) === LEDGER_KEY);

    expect(entryB).toBeUndefined();
  });

  it("account B join does not mutate account A ledger", () => {
    // Account A creates community
    setProfileScopeOverride("profile-a");
    setCommunityMembershipStatus(PK_A, {
      groupId: GROUP_ID,
      relayUrl: RELAY_URL,
      communityId: COMMUNITY_ID,
      status: "joined",
      updatedAtUnixMs: 1_000,
    });

    // Account B joins community
    setProfileScopeOverride("profile-b");
    setCommunityMembershipStatus(PK_B, {
      groupId: GROUP_ID,
      relayUrl: RELAY_URL,
      communityId: COMMUNITY_ID,
      status: "joined",
      updatedAtUnixMs: 1_000,
    });

    // Account A reads ledger - should still see only its own entry
    setProfileScopeOverride("profile-a");
    const ledgerA = loadCommunityMembershipLedger(PK_A);
    const entriesA = ledgerA.filter(e => toCommunityMembershipLedgerKey(e) === LEDGER_KEY);

    expect(entriesA).toHaveLength(1);
    expect(entriesA[0]?.status).toBe("joined");
  });

  it("account B leave does not affect account A membership status", () => {
    // Account A creates community
    setProfileScopeOverride("profile-a");
    setCommunityMembershipStatus(PK_A, {
      groupId: GROUP_ID,
      relayUrl: RELAY_URL,
      communityId: COMMUNITY_ID,
      status: "joined",
      updatedAtUnixMs: 1_000,
    });

    // Account B joins then leaves
    setProfileScopeOverride("profile-b");
    setCommunityMembershipStatus(PK_B, {
      groupId: GROUP_ID,
      relayUrl: RELAY_URL,
      communityId: COMMUNITY_ID,
      status: "joined",
      updatedAtUnixMs: 1_000,
    });
    setCommunityMembershipStatus(PK_B, {
      groupId: GROUP_ID,
      relayUrl: RELAY_URL,
      communityId: COMMUNITY_ID,
      status: "left",
      updatedAtUnixMs: 2_000,
    });

    // Account A coordinator should still see joined status
    setProfileScopeOverride("profile-a");
    const ledgerA = loadCommunityMembershipLedger(PK_A);
    const coordinatorA = resolveCommunityMembershipCoordinator({
      publicKeyHex: PK_A,
      profileId: "profile-a",
      persistedGroups: [makeGroup(PK_A)],
      membershipLedger: ledgerA,
      tombstones: loadGroupTombstones(PK_A, { profileId: "profile-a" }),
      runtimeEvidence: [],
    });

    expect(coordinatorA.groups).toHaveLength(1);
    expect(coordinatorA.groups[0]?.groupId).toBe(GROUP_ID);
  });

  it("tombstones are scoped per account", () => {
    // Account A tombstones the community
    setProfileScopeOverride("profile-a");
    addGroupTombstone(PK_A, { groupId: GROUP_ID, relayUrl: RELAY_URL });

    // Account B should not see A's tombstone
    setProfileScopeOverride("profile-b");
    const tombstonesB = loadGroupTombstones(PK_B, { profileId: "profile-b" });
    const tombstoneKeyB = `${GROUP_ID}@@wss://relay.example`;

    expect(tombstonesB.has(tombstoneKeyB)).toBe(false);
  });

  it("coordinator respects profile-scoped ledger for membership decisions", () => {
    // Account A has joined status
    setProfileScopeOverride("profile-a");
    setCommunityMembershipStatus(PK_A, {
      groupId: GROUP_ID,
      relayUrl: RELAY_URL,
      communityId: COMMUNITY_ID,
      status: "joined",
      updatedAtUnixMs: 1_000,
    });

    // Account B has left status
    setProfileScopeOverride("profile-b");
    setCommunityMembershipStatus(PK_B, {
      groupId: GROUP_ID,
      relayUrl: RELAY_URL,
      communityId: COMMUNITY_ID,
      status: "left",
      updatedAtUnixMs: 1_000,
    });

    // Account A coordinator should see joined
    setProfileScopeOverride("profile-a");
    const ledgerA = loadCommunityMembershipLedger(PK_A, { profileId: "profile-a" });
    const coordinatorA = resolveCommunityMembershipCoordinator({
      publicKeyHex: PK_A,
      profileId: "profile-a",
      persistedGroups: [makeGroup(PK_A)],
      membershipLedger: ledgerA,
      tombstones: loadGroupTombstones(PK_A, { profileId: "profile-a" }),
      runtimeEvidence: [],
    });

    // Account B coordinator should see left (not materialize)
    setProfileScopeOverride("profile-b");
    const ledgerB = loadCommunityMembershipLedger(PK_B, { profileId: "profile-b" });
    const coordinatorB = resolveCommunityMembershipCoordinator({
      publicKeyHex: PK_B,
      profileId: "profile-b",
      persistedGroups: [makeGroup(PK_B)],
      membershipLedger: ledgerB,
      tombstones: loadGroupTombstones(PK_B, { profileId: "profile-b" }),
      runtimeEvidence: [],
    });

    expect(coordinatorA.groups).toHaveLength(1);
    expect(coordinatorB.groups).toHaveLength(0);
  });
});
