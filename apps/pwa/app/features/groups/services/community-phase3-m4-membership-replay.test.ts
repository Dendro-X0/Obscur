/**
 * v1.5.0 Phase 3 — M4 membership replay (deterministic coordinator).
 *
 * Scope: `docs/v1.5.0-phase3-scope.md` (M4 — Replay and Recovery Proof),
 * `docs/v1.5.0-implementation-plan.md` (Week 6 — A/B replay coverage).
 *
 * These tests exercise the canonical membership coordinator + recovery merge
 * without a live relay: same-process deterministic replay of evidence and
 * ledger-first cold start (restart) reconstruction.
 */

import { describe, expect, it } from "vitest";
import type { GroupConversation } from "@/app/features/messaging/types";
import type { CommunityMembershipLedgerEntry } from "./community-membership-ledger";
import { resolveCommunityMembershipCoordinator } from "./community-membership-coordinator";
import { toGroupTombstoneKey } from "./group-tombstone-store";

const PUBLIC_KEY = "c".repeat(64);
const PROFILE_ID = "profile-m4";

const createGroup = (overrides: Partial<GroupConversation> = {}): GroupConversation => ({
  kind: "group",
  id: "community:gamma:wss://relay.gamma",
  communityId: "gamma:wss://relay.gamma",
  creatorPubkey: PUBLIC_KEY,
  groupId: "gamma",
  relayUrl: "wss://relay.gamma",
  displayName: "Gamma",
  memberPubkeys: [PUBLIC_KEY],
  lastMessage: "hello",
  unreadCount: 0,
  lastMessageTime: new Date(5_000),
  access: "invite-only",
  memberCount: 1,
  adminPubkeys: [],
  ...overrides,
});

describe("Phase 3 M4 — membership replay (coordinator)", () => {
  it("invite-accept path: runtime_invite_accepted alone does not commit joined ledger (provisional)", () => {
    const group = createGroup();
    const result = resolveCommunityMembershipCoordinator({
      publicKeyHex: PUBLIC_KEY,
      profileId: PROFILE_ID,
      persistedGroups: [],
      membershipLedger: [],
      tombstones: new Set<string>(),
      runtimeEvidence: [{
        kind: "runtime_invite_accepted",
        group,
        updatedAtUnixMs: 9_000,
      }],
    });

    expect(result.groups).toHaveLength(0);
    expect(result.ledgerMutations).toHaveLength(0);
    expect(result.diagnostics.hydratedFromLedgerOnlyCount).toBe(0);
  });

  it("invite-accept path: relay_gossip_ingress yields visible joined membership", () => {
    const group = createGroup();
    const result = resolveCommunityMembershipCoordinator({
      publicKeyHex: PUBLIC_KEY,
      profileId: PROFILE_ID,
      persistedGroups: [],
      membershipLedger: [],
      tombstones: new Set<string>(),
      runtimeEvidence: [{
        kind: "relay_gossip_ingress",
        group,
        updatedAtUnixMs: 9_000,
      }],
    });

    expect(result.groups).toHaveLength(1);
    expect(result.groups[0]?.groupId).toBe("gamma");
    expect(result.membershipProjections).toEqual(expect.arrayContaining([
      expect.objectContaining({ status: "joined", sourceOfTruth: "ledger" }),
    ]));
    expect(result.ledgerMutations).toEqual([
      expect.objectContaining({
        reason: "runtime_join_confirmed",
        entry: expect.objectContaining({ status: "joined", groupId: "gamma" }),
      }),
    ]);
    expect(result.diagnostics.hydratedFromLedgerOnlyCount).toBe(1);
  });

  it("restart replay: persisted chat-state empty but ledger joined still reconstructs membership", () => {
    const ledgerEntry: CommunityMembershipLedgerEntry = {
      communityId: "gamma:wss://relay.gamma",
      groupId: "gamma",
      relayUrl: "wss://relay.gamma",
      status: "joined",
      updatedAtUnixMs: 12_000,
      displayName: "Gamma",
      publicKeyHex: PUBLIC_KEY,
    };

    const result = resolveCommunityMembershipCoordinator({
      publicKeyHex: PUBLIC_KEY,
      profileId: PROFILE_ID,
      persistedGroups: [],
      membershipLedger: [ledgerEntry],
      tombstones: new Set<string>(),
    });

    expect(result.groups).toHaveLength(1);
    expect(result.groups[0]?.id).toContain("gamma");
    expect(result.membershipProjections).toEqual(expect.arrayContaining([
      expect.objectContaining({ status: "joined", sourceOfTruth: "ledger" }),
    ]));
    expect(result.diagnostics.hydratedFromLedgerOnlyCount).toBe(1);
    expect(result.ledgerMutations).toHaveLength(0);
  });

  it("sequential replay: relay gossip then cold-start on saved ledger keeps visibility", () => {
    const group = createGroup();
    const afterAccept = resolveCommunityMembershipCoordinator({
      publicKeyHex: PUBLIC_KEY,
      profileId: PROFILE_ID,
      persistedGroups: [],
      membershipLedger: [],
      tombstones: new Set<string>(),
      runtimeEvidence: [{
        kind: "relay_gossip_ingress",
        group,
        updatedAtUnixMs: 9_000,
      }],
    });

    const savedJoined = afterAccept.ledgerMutations.find(m => m.reason === "runtime_join_confirmed")?.entry;
    expect(savedJoined).toBeDefined();
    if (!savedJoined) {
      throw new Error("expected runtime_join_confirmed mutation");
    }

    const afterRestart = resolveCommunityMembershipCoordinator({
      publicKeyHex: PUBLIC_KEY,
      profileId: PROFILE_ID,
      persistedGroups: [],
      membershipLedger: [savedJoined],
      tombstones: new Set<string>(),
    });

    expect(afterRestart.groups).toHaveLength(1);
    expect(afterRestart.groups[0]?.groupId).toBe("gamma");
    expect(afterRestart.ledgerMutations).toHaveLength(0);
  });

  it("leave terminal then stale invite-accept evidence does not resurrect membership", () => {
    const group = createGroup();
    const joined = resolveCommunityMembershipCoordinator({
      publicKeyHex: PUBLIC_KEY,
      profileId: PROFILE_ID,
      persistedGroups: [],
      membershipLedger: [],
      tombstones: new Set<string>(),
      runtimeEvidence: [{
        kind: "relay_gossip_ingress",
        group,
        updatedAtUnixMs: 9_000,
      }],
    });
    const joinedEntry = joined.ledgerMutations.find(m => m.reason === "runtime_join_confirmed")?.entry;
    expect(joinedEntry).toBeDefined();
    if (!joinedEntry) {
      throw new Error("expected joined ledger entry");
    }

    const leftLedger: CommunityMembershipLedgerEntry = {
      ...joinedEntry,
      status: "left",
      updatedAtUnixMs: 20_000,
    };

    const afterLeave = resolveCommunityMembershipCoordinator({
      publicKeyHex: PUBLIC_KEY,
      profileId: PROFILE_ID,
      persistedGroups: [group],
      membershipLedger: [leftLedger],
      tombstones: new Set<string>(),
    });
    expect(afterLeave.groups).toHaveLength(0);

    const afterStaleInvite = resolveCommunityMembershipCoordinator({
      publicKeyHex: PUBLIC_KEY,
      profileId: PROFILE_ID,
      persistedGroups: [],
      membershipLedger: [leftLedger],
      tombstones: new Set<string>(),
      runtimeEvidence: [{
        kind: "runtime_invite_accepted",
        group,
        updatedAtUnixMs: 99_000,
      }],
    });

    expect(afterStaleInvite.groups).toHaveLength(0);
    expect(afterStaleInvite.diagnostics.runtimeJoinSuppressedByTerminalCount).toBe(1);
    expect(afterStaleInvite.ledgerMutations).toHaveLength(0);
  });

  it("tombstone hides joined ledger and persisted group (disband / local remove)", () => {
    const group = createGroup();
    const tombstoneKey = toGroupTombstoneKey({ groupId: group.groupId, relayUrl: group.relayUrl });
    const ledgerEntry: CommunityMembershipLedgerEntry = {
      communityId: "gamma:wss://relay.gamma",
      groupId: "gamma",
      relayUrl: "wss://relay.gamma",
      status: "joined",
      updatedAtUnixMs: 12_000,
      displayName: "Gamma",
      publicKeyHex: PUBLIC_KEY,
    };

    const result = resolveCommunityMembershipCoordinator({
      publicKeyHex: PUBLIC_KEY,
      profileId: PROFILE_ID,
      persistedGroups: [group],
      membershipLedger: [ledgerEntry],
      tombstones: new Set([tombstoneKey]),
    });

    expect(result.groups).toHaveLength(0);
    expect(result.diagnostics.hiddenByTombstoneCount).toBe(1);
  });

  it("offline divergence: terminal ledger hides stale persisted chat-state group", () => {
    const group = createGroup();
    const joinedEntry: CommunityMembershipLedgerEntry = {
      communityId: "gamma:wss://relay.gamma",
      groupId: "gamma",
      relayUrl: "wss://relay.gamma",
      status: "joined",
      updatedAtUnixMs: 10_000,
      displayName: "Gamma",
      publicKeyHex: PUBLIC_KEY,
    };
    const leftEntry: CommunityMembershipLedgerEntry = {
      ...joinedEntry,
      status: "left",
      updatedAtUnixMs: 25_000,
    };

    const result = resolveCommunityMembershipCoordinator({
      publicKeyHex: PUBLIC_KEY,
      profileId: PROFILE_ID,
      persistedGroups: [group],
      membershipLedger: [leftEntry],
      tombstones: new Set<string>(),
    });

    expect(result.groups).toHaveLength(0);
    expect(result.diagnostics.hiddenByLedgerStatusCount).toBe(1);
  });

  it("reconnect: explicit rejoin after terminal left restores visible membership", () => {
    const group = createGroup();
    const joined = resolveCommunityMembershipCoordinator({
      publicKeyHex: PUBLIC_KEY,
      profileId: PROFILE_ID,
      persistedGroups: [],
      membershipLedger: [],
      tombstones: new Set<string>(),
      runtimeEvidence: [{
        kind: "relay_gossip_ingress",
        group,
        updatedAtUnixMs: 9_000,
      }],
    });
    const joinedEntry = joined.ledgerMutations.find(m => m.reason === "runtime_join_confirmed")?.entry;
    expect(joinedEntry).toBeDefined();
    if (!joinedEntry) {
      throw new Error("expected joined ledger entry");
    }

    const leftEntry: CommunityMembershipLedgerEntry = {
      ...joinedEntry,
      status: "left",
      updatedAtUnixMs: 30_000,
    };

    const afterRejoin = resolveCommunityMembershipCoordinator({
      publicKeyHex: PUBLIC_KEY,
      profileId: PROFILE_ID,
      persistedGroups: [group],
      membershipLedger: [leftEntry],
      tombstones: new Set<string>(),
      runtimeEvidence: [{
        kind: "user_explicit_rejoin",
        group,
        updatedAtUnixMs: 40_000,
      }],
    });

    expect(afterRejoin.groups).toHaveLength(1);
    expect(afterRejoin.groups[0]?.groupId).toBe("gamma");
    expect(afterRejoin.ledgerMutations.some(m => m.reason === "explicit_rejoin")).toBe(true);
    expect(afterRejoin.diagnostics.explicitRejoinCount).toBe(1);
  });

  it("deterministic merge: duplicate ledger keys keep newer updatedAtUnixMs", () => {
    const stale: CommunityMembershipLedgerEntry = {
      communityId: "gamma:wss://relay.gamma",
      groupId: "gamma",
      relayUrl: "wss://relay.gamma",
      status: "joined",
      updatedAtUnixMs: 5_000,
      displayName: "OldName",
      publicKeyHex: PUBLIC_KEY,
    };
    const newer: CommunityMembershipLedgerEntry = {
      ...stale,
      updatedAtUnixMs: 50_000,
      displayName: "Gamma",
    };

    const result = resolveCommunityMembershipCoordinator({
      publicKeyHex: PUBLIC_KEY,
      profileId: PROFILE_ID,
      persistedGroups: [],
      membershipLedger: [stale, newer],
      tombstones: new Set<string>(),
    });

    expect(result.groups).toHaveLength(1);
    expect(result.groups[0]?.displayName).toBe("Gamma");
  });
});
