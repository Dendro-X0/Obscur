import { describe, expect, it } from "vitest";
import type { GroupConversation } from "@/app/features/messaging/types";
import type { CommunityMembershipLedgerEntry } from "./community-membership-ledger";
import {
  resolveCommunityMembershipCoordinator,
  resolveCommunityMembershipDisbandMutation,
  persistExplicitCommunityMembershipLeave,
  resolveCommunityMembershipExplicitLeaveMutation,
  resolveCommunityGovernanceMemberExpelledMutation,
  resolveCommunityMembershipRosterSnapshotTerminalMutation,
  resolveCommunityMembershipRuntimeEvidenceDecision,
} from "./community-membership-coordinator";

const PUBLIC_KEY = "f".repeat(64);
const PROFILE_ID = "default";

const createGroup = (overrides: Partial<GroupConversation> = {}): GroupConversation => ({
  kind: "group",
  id: "community:alpha:wss://relay.alpha",
  communityId: "alpha:wss://relay.alpha",
  creatorPubkey: PUBLIC_KEY,
  groupId: "alpha",
  relayUrl: "wss://relay.alpha",
  displayName: "Alpha",
  memberPubkeys: [PUBLIC_KEY],
  lastMessage: "hello",
  unreadCount: 0,
  lastMessageTime: new Date(1_000),
  access: "invite-only",
  memberCount: 1,
  adminPubkeys: [],
  ...overrides,
});

const createLedgerEntry = (overrides: Partial<CommunityMembershipLedgerEntry> = {}): CommunityMembershipLedgerEntry => ({
  communityId: "alpha:wss://relay.alpha",
  groupId: "alpha",
  relayUrl: "wss://relay.alpha",
  status: "joined",
  updatedAtUnixMs: 1_000,
  displayName: "Alpha",
  ...overrides,
});

describe("community-membership-coordinator", () => {
  it("keeps explicit left ledger state above persisted chat-state fallback", () => {
    const result = resolveCommunityMembershipCoordinator({
      publicKeyHex: PUBLIC_KEY,
      profileId: PROFILE_ID,
      persistedGroups: [createGroup()],
      membershipLedger: [createLedgerEntry({ status: "left", updatedAtUnixMs: 2_000 })],
      tombstones: new Set<string>(),
    });

    expect(result.groups).toHaveLength(0);
    expect(result.ledgerMutations).toHaveLength(0);
    expect(result.diagnostics.hiddenByLedgerStatusCount).toBe(1);
    expect(result.diagnostics.explicitTerminalLedgerCount).toBe(1);
  });

  it("allows persisted restore fallback only when ledger coverage is absent", () => {
    const result = resolveCommunityMembershipCoordinator({
      publicKeyHex: PUBLIC_KEY,
      profileId: PROFILE_ID,
      persistedGroups: [createGroup()],
      membershipLedger: [],
      tombstones: new Set<string>(),
    });

    expect(result.groups).toHaveLength(1);
    expect(result.membershipProjections).toEqual(expect.arrayContaining([
      expect.objectContaining({ status: "joined", sourceOfTruth: "persisted_fallback" }),
    ]));
    expect(result.ledgerMutations).toEqual([
      expect.objectContaining({
        reason: "persisted_fallback_backfill",
        entry: expect.objectContaining({ status: "joined", groupId: "alpha" }),
      }),
    ]);
  });

  it("does not promote historical restore evidence to joined on hydrate (REL-002)", () => {
    const result = resolveCommunityMembershipCoordinator({
      publicKeyHex: PUBLIC_KEY,
      profileId: PROFILE_ID,
      persistedGroups: [],
      membershipLedger: [createLedgerEntry({ status: "historical", updatedAtUnixMs: 2_000 })],
      tombstones: new Set<string>(),
    });

    expect(result.groups).toHaveLength(0);
    expect(result.ledgerMutations).not.toEqual(expect.arrayContaining([
      expect.objectContaining({ reason: "historical_restore_backfill" }),
    ]));
  });

  it("suppresses ambient runtime membership confirmation when explicit left exists", () => {
    const result = resolveCommunityMembershipCoordinator({
      publicKeyHex: PUBLIC_KEY,
      profileId: PROFILE_ID,
      persistedGroups: [],
      membershipLedger: [createLedgerEntry({ status: "left", updatedAtUnixMs: 2_000 })],
      tombstones: new Set<string>(),
      runtimeEvidence: [{
        kind: "runtime_membership_confirmed",
        group: createGroup(),
        updatedAtUnixMs: 3_000,
      }],
    });

    expect(result.groups).toHaveLength(0);
    expect(result.ledgerMutations).toHaveLength(0);
    expect(result.diagnostics.runtimeJoinSuppressedByTerminalCount).toBe(1);
  });

  it("returns a materialization suppression decision for ambient runtime evidence blocked by terminal ledger state", () => {
    const result = resolveCommunityMembershipRuntimeEvidenceDecision({
      membershipLedger: [createLedgerEntry({ status: "left", updatedAtUnixMs: 2_000 })],
      evidence: {
        kind: "runtime_membership_confirmed",
        group: createGroup(),
        updatedAtUnixMs: 3_000,
      },
    });

    expect(result).toEqual({
      shouldMaterializeGroup: false,
      suppressedByTerminalLedger: true,
    });
  });

  it("does not write joined ledger for provisional runtime_invite_accepted evidence", () => {
    const result = resolveCommunityMembershipCoordinator({
      publicKeyHex: PUBLIC_KEY,
      profileId: PROFILE_ID,
      persistedGroups: [],
      membershipLedger: [],
      tombstones: new Set<string>(),
      runtimeEvidence: [{
        kind: "runtime_invite_accepted",
        group: createGroup(),
        updatedAtUnixMs: 3_000,
      }],
    });

    expect(result.groups).toHaveLength(0);
    expect(result.ledgerMutations).toHaveLength(0);
    expect(result.diagnostics.runtimeJoinSuppressedByTerminalCount).toBe(0);
  });

  it("suppresses provisional invite-accept materialization when explicit expelled exists", () => {
    const decision = resolveCommunityMembershipRuntimeEvidenceDecision({
      membershipLedger: [createLedgerEntry({ status: "expelled", updatedAtUnixMs: 2_000 })],
      evidence: {
        kind: "runtime_invite_accepted",
        group: createGroup(),
        updatedAtUnixMs: 3_000,
      },
    });

    expect(decision).toEqual({
      shouldMaterializeGroup: false,
      suppressedByTerminalLedger: true,
    });
  });

  it("allows explicit rejoin to revive a previously left community", () => {
    const result = resolveCommunityMembershipCoordinator({
      publicKeyHex: PUBLIC_KEY,
      profileId: PROFILE_ID,
      persistedGroups: [],
      membershipLedger: [createLedgerEntry({ status: "left", updatedAtUnixMs: 2_000 })],
      tombstones: new Set<string>(),
      runtimeEvidence: [{
        kind: "user_explicit_rejoin",
        group: createGroup(),
        updatedAtUnixMs: 3_000,
      }],
    });

    expect(result.groups).toHaveLength(1);
    expect(result.membershipProjections).toEqual(expect.arrayContaining([
      expect.objectContaining({ status: "joined", sourceOfTruth: "ledger" }),
    ]));
    expect(result.ledgerMutations).toEqual([
      expect.objectContaining({
        reason: "explicit_rejoin",
        entry: expect.objectContaining({ status: "joined", groupId: "alpha" }),
      }),
    ]);
    expect(result.diagnostics.explicitRejoinCount).toBe(1);
  });

  it("creates public-key-bound explicit leave mutations", () => {
    const mutation = resolveCommunityMembershipExplicitLeaveMutation({
      publicKeyHex: PUBLIC_KEY,
      group: createGroup(),
      updatedAtUnixMs: 4_000,
    });

    expect(mutation).toEqual(expect.objectContaining({
      reason: "explicit_leave",
      entry: expect.objectContaining({
        groupId: "alpha",
        relayUrl: "wss://relay.alpha",
        status: "left",
        publicKeyHex: PUBLIC_KEY,
        updatedAtUnixMs: 4_000,
      }),
    }));
  });

  it("creates public-key-bound expelled mutations from local-user roster snapshot evidence", () => {
    const mutation = resolveCommunityMembershipRosterSnapshotTerminalMutation({
      publicKeyHex: PUBLIC_KEY,
      group: createGroup(),
      leftMemberPubkeys: [PUBLIC_KEY],
      expelledMemberPubkeys: [PUBLIC_KEY],
      updatedAtUnixMs: 5_000,
    });

    expect(mutation).toEqual(expect.objectContaining({
      reason: "relay_roster_terminal",
      entry: expect.objectContaining({
        groupId: "alpha",
        relayUrl: "wss://relay.alpha",
        status: "expelled",
        publicKeyHex: PUBLIC_KEY,
        updatedAtUnixMs: 5_000,
      }),
    }));
  });

  it("tags governance expulsion with governance_member_expelled reason", () => {
    const target = "b".repeat(64);
    const mutation = resolveCommunityGovernanceMemberExpelledMutation({
      publicKeyHex: PUBLIC_KEY,
      group: createGroup(),
      targetPublicKeyHex: target,
      updatedAtUnixMs: 5_500,
      lastEvidenceEventId: "gov-expel-1",
    });

    expect(mutation.reason).toBe("governance_member_expelled");
    expect(mutation.entry.status).toBe("joined");
    expect(mutation.entry.lastEvidenceEventId).toBe("gov-expel-1");

    const selfMutation = resolveCommunityGovernanceMemberExpelledMutation({
      publicKeyHex: PUBLIC_KEY,
      group: createGroup(),
      targetPublicKeyHex: PUBLIC_KEY,
      updatedAtUnixMs: 5_600,
    });
    expect(selfMutation.entry.status).toBe("expelled");
  });

  it("ignores roster snapshot terminal evidence for non-local members", () => {
    const mutation = resolveCommunityMembershipRosterSnapshotTerminalMutation({
      publicKeyHex: PUBLIC_KEY,
      group: createGroup(),
      leftMemberPubkeys: ["a".repeat(64)],
      expelledMemberPubkeys: [],
      updatedAtUnixMs: 5_000,
    });

    expect(mutation).toBeNull();
  });

  it("creates public-key-bound relay disband mutations without using explicit leave reason", () => {
    const mutation = resolveCommunityMembershipDisbandMutation({
      publicKeyHex: PUBLIC_KEY,
      group: createGroup(),
      disbandedAtUnixMs: 6_000,
    });

    expect(mutation).toEqual(expect.objectContaining({
      reason: "relay_disbanded",
      entry: expect.objectContaining({
        groupId: "alpha",
        relayUrl: "wss://relay.alpha",
        status: "left",
        publicKeyHex: PUBLIC_KEY,
        updatedAtUnixMs: expect.any(Number),
      }),
    }));
    expect(mutation.entry.updatedAtUnixMs).toBeGreaterThanOrEqual(6_000);
  });
});
