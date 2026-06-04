/**
 * M0 Baseline Tests — AB-15
 *
 * AB-15: Same-process A/B restore historical evidence boundary.
 *
 *   Scenario (same-process, two accounts):
 *     1. Account A has an old backup containing invite/group history for community "alpha".
 *     2. Account A had previously left "alpha" (ledger status: left).
 *     3. Account A restores the old backup.
 *     4. The restore contains historical evidence (old invites, group messages).
 *
 *   Expected outcomes:
 *     1. Historical evidence from restore does not resurrect current membership.
 *     2. Ledger "left" status remains terminal and suppresses historical "joined" reconstruction.
 *     3. Coordinator respects terminal ledger state over historical restore hints.
 *
 *   This tests the restore/import static boundary to prevent historical evidence
 *   from creating current membership after a user has explicitly left.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { PublicKeyHex } from "@dweb/crypto/public-key-hex";
import {
  setProfileScopeOverride,
} from "@/app/features/profiles/services/profile-scope";
import {
  communityMembershipLedgerInternals,
  loadCommunityMembershipLedger,
} from "./community-membership-ledger";
import { loadGroupTombstones } from "./group-tombstone-store";
import { resolveCommunityMembershipCoordinator } from "./community-membership-coordinator";
import type { GroupConversation } from "@/app/features/messaging/types";

const { setCommunityMembershipStatus } = communityMembershipLedgerInternals;

const PK_A = "a".repeat(64) as PublicKeyHex;
const PK_B = "b".repeat(64) as PublicKeyHex;
const GROUP_ID = "alpha";
const RELAY_URL = "wss://relay.example";
const COMMUNITY_ID = `${GROUP_ID}:${RELAY_URL}`;

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

describe("AB-15 — same-process A/B restore historical evidence boundary", () => {
  beforeEach(() => {
    window.localStorage.clear();
    setProfileScopeOverride(null);
  });

  it("historical restore evidence does not resurrect left membership", () => {
    // Account A has left community (terminal ledger state)
    setProfileScopeOverride("profile-a");
    setCommunityMembershipStatus(PK_A, {
      groupId: GROUP_ID,
      relayUrl: RELAY_URL,
      communityId: COMMUNITY_ID,
      status: "left",
      updatedAtUnixMs: 2_000,
    });

    // Simulate restore with historical evidence (old persisted groups)
    // This represents historical backup data that contains the community
    const historicalPersistedGroups = [makeGroup(PK_A)];

    // Coordinator should suppress historical evidence when terminal left exists
    const ledgerA = loadCommunityMembershipLedger(PK_A);
    const coordinatorA = resolveCommunityMembershipCoordinator({
      publicKeyHex: PK_A,
      profileId: "profile-a",
      persistedGroups: historicalPersistedGroups,
      membershipLedger: ledgerA,
      tombstones: loadGroupTombstones(PK_A),
      runtimeEvidence: [],
    });

    // Historical persisted groups should not materialize due to terminal left status
    expect(coordinatorA.groups).toHaveLength(0);
  });

  it("does not promote persisted chat-state alone to joined under REL-002 default", () => {
    setProfileScopeOverride("profile-a");

    const historicalPersistedGroups = [makeGroup(PK_A)];
    const ledgerA = loadCommunityMembershipLedger(PK_A);
    const coordinatorA = resolveCommunityMembershipCoordinator({
      publicKeyHex: PK_A,
      profileId: "profile-a",
      persistedGroups: historicalPersistedGroups,
      membershipLedger: ledgerA,
      tombstones: loadGroupTombstones(PK_A),
      runtimeEvidence: [],
    });

    expect(coordinatorA.groups).toHaveLength(0);
    expect(coordinatorA.diagnostics.hiddenByRadicalTruthCount).toBeGreaterThan(0);
  });

  it("allows persisted fallback only when radical truth is explicitly disabled (mobile/desktop shells)", () => {
    vi.stubEnv("NEXT_PUBLIC_OBSCUR_RADICAL_TRUTH", "0");
    setProfileScopeOverride("profile-a");

    const historicalPersistedGroups = [makeGroup(PK_A)];
    const ledgerA = loadCommunityMembershipLedger(PK_A);
    const coordinatorA = resolveCommunityMembershipCoordinator({
      publicKeyHex: PK_A,
      profileId: "profile-a",
      persistedGroups: historicalPersistedGroups,
      membershipLedger: ledgerA,
      tombstones: loadGroupTombstones(PK_A),
      runtimeEvidence: [],
    });

    expect(coordinatorA.groups).toHaveLength(1);
    expect(coordinatorA.groups[0]?.groupId).toBe(GROUP_ID);
    expect(coordinatorA.membershipProjections).toEqual(expect.arrayContaining([
      expect.objectContaining({ status: "joined", sourceOfTruth: "persisted_fallback" }),
    ]));
  });

  it("historical restore evidence does not override expelled status", () => {
    // Account A has been expelled from community (terminal ledger state)
    setProfileScopeOverride("profile-a");
    setCommunityMembershipStatus(PK_A, {
      groupId: GROUP_ID,
      relayUrl: RELAY_URL,
      communityId: COMMUNITY_ID,
      status: "expelled",
      updatedAtUnixMs: 2_000,
    });

    // Simulate restore with historical evidence (old persisted groups)
    const historicalPersistedGroups = [makeGroup(PK_A)];

    // Coordinator should suppress historical evidence when terminal expelled exists
    const ledgerA = loadCommunityMembershipLedger(PK_A);
    const coordinatorA = resolveCommunityMembershipCoordinator({
      publicKeyHex: PK_A,
      profileId: "profile-a",
      persistedGroups: historicalPersistedGroups,
      membershipLedger: ledgerA,
      tombstones: loadGroupTombstones(PK_A),
      runtimeEvidence: [],
    });

    // Historical persisted groups should not materialize due to terminal expelled status
    expect(coordinatorA.groups).toHaveLength(0);
  });

  it("historical restore evidence respects profile scope isolation", () => {
    // Account A has left community
    setProfileScopeOverride("profile-a");
    setCommunityMembershipStatus(PK_A, {
      groupId: GROUP_ID,
      relayUrl: RELAY_URL,
      communityId: COMMUNITY_ID,
      status: "left",
      updatedAtUnixMs: 2_000,
    });

    // Account B has no ledger state and restores with historical evidence
    setProfileScopeOverride("profile-b");
    const historicalPersistedGroupsB = [makeGroup(PK_B)];

    // Coordinator B: no ledger — persisted_fallback only (REL-002: no historical auto-join)
    const ledgerB = loadCommunityMembershipLedger(PK_B);
    const coordinatorB = resolveCommunityMembershipCoordinator({
      publicKeyHex: PK_B,
      profileId: "profile-b",
      persistedGroups: historicalPersistedGroupsB,
      membershipLedger: ledgerB,
      tombstones: loadGroupTombstones(PK_B),
      runtimeEvidence: [],
    });

    // Coordinator A should suppress historical evidence (terminal left blocks)
    setProfileScopeOverride("profile-a");
    const ledgerA = loadCommunityMembershipLedger(PK_A);
    const coordinatorA = resolveCommunityMembershipCoordinator({
      publicKeyHex: PK_A,
      profileId: "profile-a",
      persistedGroups: [makeGroup(PK_A)],
      membershipLedger: ledgerA,
      tombstones: loadGroupTombstones(PK_A),
      runtimeEvidence: [],
    });

    // REL-002: persisted chat-state alone must not drive live groups for either profile
    expect(coordinatorB.groups).toHaveLength(0);
    expect(coordinatorA.groups).toHaveLength(0);
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });
});
