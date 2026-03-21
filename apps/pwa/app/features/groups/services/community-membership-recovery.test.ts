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
});

