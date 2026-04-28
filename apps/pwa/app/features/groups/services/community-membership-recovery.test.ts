import { describe, expect, it } from "vitest";
import type { GroupConversation } from "@/app/features/messaging/types";
import type { CommunityMembershipLedgerEntry } from "./community-membership-ledger";
import {
  COMMUNITY_MEMBERSHIP_RECOVERY_PRECEDENCE,
  resolveCommunityMembershipRecovery,
} from "./community-membership-recovery";

const PUBLIC_KEY = "f".repeat(64);

const createGroup = (overrides: Partial<GroupConversation> = {}): GroupConversation => ({
  kind: "group",
  id: "community:alpha:wss://relay.alpha",
  communityId: "alpha:wss://relay.alpha",
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
  ...overrides,
});

describe("community-membership-recovery", () => {
  it("locks precedence order as tombstone -> membership ledger -> persisted chat state", () => {
    expect(COMMUNITY_MEMBERSHIP_RECOVERY_PRECEDENCE).toEqual([
      "tombstone",
      "membership_ledger",
      "persisted_chat_state",
    ]);
  });

  it("suppresses persisted groups when ledger status is left", () => {
    const result = resolveCommunityMembershipRecovery({
      publicKeyHex: PUBLIC_KEY,
      persistedGroups: [createGroup()],
      membershipLedger: [createLedgerEntry({ status: "left", updatedAtUnixMs: 2_000 })],
      tombstones: new Set<string>(),
    });

    expect(result.groups).toHaveLength(0);
    expect(result.missingLedgerCoverageEntries).toHaveLength(0);
    expect(result.diagnostics.hiddenByLedgerStatusCount).toBe(1);
    expect(result.diagnostics.hydratedFromPersistedFallbackCount).toBe(0);
  });

  it("keeps persisted groups when ledger coverage is missing and marks missing coverage for backfill", () => {
    const result = resolveCommunityMembershipRecovery({
      publicKeyHex: PUBLIC_KEY,
      persistedGroups: [createGroup()],
      membershipLedger: [],
      tombstones: new Set<string>(),
    });

    expect(result.groups).toHaveLength(1);
    expect(result.groups[0]?.groupId).toBe("alpha");
    expect(result.missingLedgerCoverageEntries).toHaveLength(1);
    expect(result.missingLedgerCoverageEntries[0]).toEqual(expect.objectContaining({
      groupId: "alpha",
      relayUrl: "wss://relay.alpha",
      status: "joined",
    }));
    expect(result.membershipProjections).toEqual(expect.arrayContaining([
      expect.objectContaining({
        communityId: "alpha:wss://relay.alpha",
        status: "joined",
        sourceOfTruth: "persisted_fallback",
      }),
    ]));
    expect(result.diagnostics.hydratedFromPersistedFallbackCount).toBe(1);
    expect(result.diagnostics.missingLedgerCoverageCount).toBe(1);
  });

  it("hydrates joined ledger entries without persisted chat groups", () => {
    const result = resolveCommunityMembershipRecovery({
      publicKeyHex: PUBLIC_KEY,
      persistedGroups: [],
      membershipLedger: [createLedgerEntry({
        groupId: "beta",
        relayUrl: "wss://relay.beta",
        communityId: "beta:wss://relay.beta",
        displayName: "Beta",
      })],
      tombstones: new Set<string>(),
    });

    expect(result.groups).toHaveLength(1);
    expect(result.groups[0]).toEqual(expect.objectContaining({
      groupId: "beta",
      relayUrl: "wss://relay.beta",
      displayName: "Beta",
    }));
    expect(result.descriptorProjections).toEqual(expect.arrayContaining([
      expect.objectContaining({
        communityId: "beta:wss://relay.beta",
        conversationId: "community:beta:wss://relay.beta",
        lifecycleState: "active",
        visibilityState: "visible",
      }),
    ]));
    expect(result.membershipProjections).toEqual(expect.arrayContaining([
      expect.objectContaining({
        communityId: "beta:wss://relay.beta",
        status: "joined",
        sourceOfTruth: "ledger",
      }),
    ]));
    expect(result.diagnostics.hydratedFromLedgerOnlyCount).toBe(1);
  });

  it("suppresses visibility for tombstoned communities regardless of joined sources", () => {
    const tombstones = new Set<string>(["alpha@@wss://relay.alpha"]);
    const result = resolveCommunityMembershipRecovery({
      publicKeyHex: PUBLIC_KEY,
      persistedGroups: [createGroup()],
      membershipLedger: [createLedgerEntry()],
      tombstones,
    });

    expect(result.groups).toHaveLength(0);
    expect(result.diagnostics.hiddenByTombstoneCount).toBe(1);
  });

  it("recovers placeholder persisted display names from richer joined-ledger metadata", () => {
    const result = resolveCommunityMembershipRecovery({
      publicKeyHex: PUBLIC_KEY,
      persistedGroups: [createGroup({ displayName: "Private Group" })],
      membershipLedger: [createLedgerEntry({ displayName: "Recovered Alpha" })],
      tombstones: new Set<string>(),
    });

    expect(result.groups).toHaveLength(1);
    expect(result.groups[0]?.displayName).toBe("Recovered Alpha");
    expect(result.diagnostics.placeholderDisplayNameRecoveredCount).toBe(1);
  });

  it("preserves hashed community identity when joined-ledger fallback is weaker", () => {
    const hashedCommunityId = "v2_bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb";
    const result = resolveCommunityMembershipRecovery({
      publicKeyHex: PUBLIC_KEY,
      persistedGroups: [createGroup({
        id: `community:${hashedCommunityId}`,
        communityId: hashedCommunityId,
        displayName: "Alpha Canonical",
      })],
      membershipLedger: [createLedgerEntry({
        communityId: "alpha:wss://relay.alpha",
        updatedAtUnixMs: 2_000,
      })],
      tombstones: new Set<string>(),
    });

    expect(result.groups).toHaveLength(1);
    expect(result.groups[0]).toEqual(expect.objectContaining({
      id: `community:${hashedCommunityId}`,
      communityId: hashedCommunityId,
      displayName: "Alpha Canonical",
    }));
  });

  it("backfills local member coverage when joined-ledger evidence exists", () => {
    const otherMember = "1".repeat(64);
    const result = resolveCommunityMembershipRecovery({
      publicKeyHex: PUBLIC_KEY,
      persistedGroups: [createGroup({
        memberPubkeys: [otherMember],
        memberCount: 1,
      })],
      membershipLedger: [createLedgerEntry()],
      tombstones: new Set<string>(),
    });

    expect(result.groups).toHaveLength(1);
    expect(result.groups[0]?.memberPubkeys).toEqual(expect.arrayContaining([PUBLIC_KEY, otherMember]));
    expect(result.groups[0]?.memberCount).toBeGreaterThanOrEqual(2);
    expect(result.diagnostics.localMemberBackfillCount).toBe(1);
  });

  it("merges duplicate persisted rows and keeps richer metadata instead of newer placeholder regression", () => {
    const olderRich = createGroup({
      id: "community:alpha-rich",
      displayName: "Alpha Rich",
      memberPubkeys: [PUBLIC_KEY, "2".repeat(64)],
      memberCount: 2,
      lastMessageTime: new Date(1_000),
    });
    const newerRegressed = createGroup({
      id: "community:alpha-regressed",
      displayName: "Private Group",
      memberPubkeys: [],
      memberCount: 0,
      lastMessageTime: new Date(2_000),
    });
    const result = resolveCommunityMembershipRecovery({
      publicKeyHex: PUBLIC_KEY,
      persistedGroups: [olderRich, newerRegressed],
      membershipLedger: [],
      tombstones: new Set<string>(),
    });

    expect(result.groups).toHaveLength(1);
    expect(result.groups[0]?.displayName).toBe("Alpha Rich");
    expect(result.groups[0]?.memberPubkeys).toEqual(expect.arrayContaining([PUBLIC_KEY, "2".repeat(64)]));
    expect(result.diagnostics.persistedDuplicateMergeCount).toBe(1);
  });

  it("preserves richer persisted member roster when joined-ledger recovery is rebuilt", () => {
    const otherMember = "3".repeat(64);
    const result = resolveCommunityMembershipRecovery({
      publicKeyHex: PUBLIC_KEY,
      persistedGroups: [createGroup({
        groupId: "sigma",
        relayUrl: "wss://relay.sigma",
        communityId: "sigma:wss://relay.sigma",
        displayName: "Sigma",
        memberPubkeys: [PUBLIC_KEY, otherMember],
        memberCount: 2,
      })],
      membershipLedger: [createLedgerEntry({
        groupId: "sigma",
        relayUrl: "wss://relay.sigma",
        communityId: "sigma:wss://relay.sigma",
        displayName: "Sigma",
        updatedAtUnixMs: 5_000,
      })],
      tombstones: new Set<string>(),
    });

    expect(result.groups).toHaveLength(1);
    expect(result.groups[0]?.memberPubkeys).toEqual(expect.arrayContaining([PUBLIC_KEY, otherMember]));
    expect(result.groups[0]?.memberCount).toBeGreaterThanOrEqual(2);
  });

  it("backfills invite-derived peer membership when persisted restore only knows the local member", () => {
    const otherMember = "4".repeat(64);
    const result = resolveCommunityMembershipRecovery({
      publicKeyHex: PUBLIC_KEY,
      persistedGroups: [createGroup({
        memberPubkeys: [PUBLIC_KEY],
        memberCount: 1,
      })],
      membershipLedger: [createLedgerEntry()],
      tombstones: new Set<string>(),
      inviteMemberPubkeysByGroupKey: {
        "alpha@@wss://relay.alpha": [otherMember],
      },
    });

    expect(result.groups).toHaveLength(1);
    expect(result.groups[0]?.memberPubkeys).toEqual(expect.arrayContaining([PUBLIC_KEY, otherMember]));
    expect(result.groups[0]?.memberCount).toBeGreaterThanOrEqual(2);
  });
});
