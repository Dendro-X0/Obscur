import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { resolveCommunityMembershipRecovery } from "./community-membership-recovery";
import { resolveCommunityMembershipCoordinator } from "./community-membership-coordinator";

const PUBKEY = "a".repeat(64);

const makeGroup = (groupId: string) => ({
  kind: "group" as const,
  id: `group:${groupId}`,
  groupId,
  communityId: `community:${groupId}`,
  relayUrl: "wss://relay.example",
  displayName: "Test Room",
  memberPubkeys: [PUBKEY],
  adminPubkeys: [PUBKEY],
  lastMessage: "",
  unreadCount: 0,
  access: "invite-only" as const,
  memberCount: 1,
  lastMessageTime: new Date(1_000),
});

describe("radical membership truth", () => {
  beforeEach(() => {
    vi.stubEnv("NEXT_PUBLIC_OBSCUR_RADICAL_TRUTH", "1");
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("recovery hides persisted chat-state without ledger joined row", () => {
    const result = resolveCommunityMembershipRecovery({
      publicKeyHex: PUBKEY,
      persistedGroups: [makeGroup("room-1")],
      membershipLedger: [],
      tombstones: new Set(),
    });

    expect(result.groups).toHaveLength(0);
    expect(result.diagnostics.hiddenByRadicalTruthCount).toBe(1);
    expect(result.diagnostics.hydratedFromPersistedFallbackCount).toBe(0);
  });

  it("recovery keeps ledger-joined communities", () => {
    const group = makeGroup("room-2");
    const result = resolveCommunityMembershipRecovery({
      publicKeyHex: PUBKEY,
      persistedGroups: [group],
      membershipLedger: [{
        groupId: group.groupId,
        relayUrl: group.relayUrl,
        communityId: group.communityId,
        publicKeyHex: PUBKEY,
        status: "joined",
        updatedAtUnixMs: 2_000,
      }],
      tombstones: new Set(),
    });

    expect(result.groups).toHaveLength(1);
    expect(result.membershipProjections[0]?.sourceOfTruth).toBe("ledger");
  });

  it("coordinator skips persisted_fallback_backfill when radical truth is on", () => {
    const coordinator = resolveCommunityMembershipCoordinator({
      publicKeyHex: PUBKEY,
      profileId: "default",
      persistedGroups: [makeGroup("room-3")],
      membershipLedger: [],
      tombstones: new Set(),
    });

    expect(coordinator.groups).toHaveLength(0);
    expect(coordinator.ledgerMutations.filter((m) => m.reason === "persisted_fallback_backfill")).toHaveLength(0);
  });
});
