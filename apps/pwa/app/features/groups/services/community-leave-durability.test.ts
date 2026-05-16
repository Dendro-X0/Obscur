/**
 * M0 Baseline Tests — AB-04, AB-05
 *
 * AB-04: Leave survives restore.
 *        A user who has left a community must not see that community as
 *        current after a fresh-window login or backup restore. The "left"
 *        ledger entry must take precedence over any persisted group row or
 *        historical reconstruction.
 *
 * AB-05: Rate-limited relay publish does not roll back private leave.
 *        When the relay rejects or rate-limits a leave publish, the local
 *        ledger status must remain "left". A relay error must never restore
 *        the status to "joined".
 *
 * These tests encode the invariants the implementation must satisfy.
 * They are expected to PASS already for AB-04 (guard) and to guide
 * implementation for the outbox path in AB-05.
 */

import { beforeEach, describe, expect, it } from "vitest";
import { setProfileScopeOverride } from "@/app/features/profiles/services/profile-scope";
import {
  communityMembershipLedgerInternals,
  loadCommunityMembershipLedger,
  saveCommunityMembershipLedger,
  toCommunityMembershipLedgerKey,
  type CommunityMembershipLedgerEntry,
} from "./community-membership-ledger";
import { resolveCommunityMembershipRecovery } from "./community-membership-recovery";
import type { GroupConversation } from "@/app/features/messaging/types";

const PUBLIC_KEY = "d".repeat(64);
const GROUP_ID = "left-group-1";
const RELAY_URL = "wss://relay.example";
const LEDGER_KEY = `${GROUP_ID}@@${RELAY_URL}`;
const { setCommunityMembershipStatus } = communityMembershipLedgerInternals;

const makeGroup = (overrides: Partial<GroupConversation> = {}): GroupConversation => ({
  kind: "group",
  id: `community:${GROUP_ID}:${RELAY_URL}`,
  communityId: `${GROUP_ID}:${RELAY_URL}`,
  groupId: GROUP_ID,
  relayUrl: RELAY_URL,
  displayName: "Left Group",
  memberPubkeys: [PUBLIC_KEY],
  lastMessage: "hello",
  unreadCount: 0,
  lastMessageTime: new Date(1_000),
  access: "invite-only",
  memberCount: 1,
  adminPubkeys: [],
  ...overrides,
});

const makeEntry = (overrides: Partial<CommunityMembershipLedgerEntry> = {}): CommunityMembershipLedgerEntry => ({
  communityId: `${GROUP_ID}:${RELAY_URL}`,
  groupId: GROUP_ID,
  relayUrl: RELAY_URL,
  status: "joined",
  updatedAtUnixMs: 1_000,
  ...overrides,
});

describe("AB-04 — left ledger status suppresses group on restore", () => {
  beforeEach(() => {
    window.localStorage.clear();
    setProfileScopeOverride(null);
  });

  it("recovery hides group when ledger status is left", () => {
    const result = resolveCommunityMembershipRecovery({
      publicKeyHex: PUBLIC_KEY,
      persistedGroups: [makeGroup()],
      membershipLedger: [makeEntry({ status: "left", updatedAtUnixMs: 2_000 })],
      tombstones: new Set(),
    });

    expect(result.groups).toHaveLength(0);
    expect(result.diagnostics.hiddenByLedgerStatusCount).toBe(1);
  });

  it("recovery shows group when ledger status is joined", () => {
    const result = resolveCommunityMembershipRecovery({
      publicKeyHex: PUBLIC_KEY,
      persistedGroups: [makeGroup()],
      membershipLedger: [makeEntry({ status: "joined" })],
      tombstones: new Set(),
    });

    expect(result.groups).toHaveLength(1);
  });

  it("left status persisted to storage survives a reload read", () => {
    setCommunityMembershipStatus(PUBLIC_KEY, {
      groupId: GROUP_ID,
      relayUrl: RELAY_URL,
      communityId: `${GROUP_ID}:${RELAY_URL}`,
      status: "left",
      displayName: "Left Group",
    });

    const loaded = loadCommunityMembershipLedger(PUBLIC_KEY);
    const entry = loaded.find(e => toCommunityMembershipLedgerKey(e) === LEDGER_KEY);
    expect(entry).toBeDefined();
    expect(entry?.status).toBe("left");
  });

  it("left status beats a later re-save of the joined group row", () => {
    setCommunityMembershipStatus(PUBLIC_KEY, {
      groupId: GROUP_ID,
      relayUrl: RELAY_URL,
      communityId: `${GROUP_ID}:${RELAY_URL}`,
      status: "left",
      updatedAtUnixMs: 3_000,
    });

    saveCommunityMembershipLedger(PUBLIC_KEY, [
      makeEntry({ status: "joined", updatedAtUnixMs: 2_000 }),
    ]);

    const loaded = loadCommunityMembershipLedger(PUBLIC_KEY);
    const entry = loaded.find(e => toCommunityMembershipLedgerKey(e) === LEDGER_KEY);
    expect(entry?.status).toBe("left");
  });

  it("left status propagates correctly across profile-scope transitions (A/B isolation)", () => {
    setProfileScopeOverride("profile-a");
    setCommunityMembershipStatus(PUBLIC_KEY, {
      groupId: GROUP_ID,
      relayUrl: RELAY_URL,
      communityId: `${GROUP_ID}:${RELAY_URL}`,
      status: "left",
      updatedAtUnixMs: 2_000,
    });

    const loadedA = loadCommunityMembershipLedger(PUBLIC_KEY);
    expect(loadedA.find(e => toCommunityMembershipLedgerKey(e) === LEDGER_KEY)?.status).toBe("left");

    setProfileScopeOverride("profile-b");
    saveCommunityMembershipLedger(PUBLIC_KEY, [
      makeEntry({ status: "joined", updatedAtUnixMs: 1_000 }),
    ]);

    setProfileScopeOverride("profile-a");
    const reloadedA = loadCommunityMembershipLedger(PUBLIC_KEY);
    expect(reloadedA.find(e => toCommunityMembershipLedgerKey(e) === LEDGER_KEY)?.status).toBe("left");
  });
});

describe("AB-05 — relay publish failure must not roll back private leave", () => {
  beforeEach(() => {
    window.localStorage.clear();
    setProfileScopeOverride(null);
  });

  it("left status written to ledger is durable before any relay publish attempt", () => {
    setCommunityMembershipStatus(PUBLIC_KEY, {
      groupId: GROUP_ID,
      relayUrl: RELAY_URL,
      communityId: `${GROUP_ID}:${RELAY_URL}`,
      status: "left",
    });

    const loaded = loadCommunityMembershipLedger(PUBLIC_KEY);
    const entry = loaded.find(e => toCommunityMembershipLedgerKey(e) === LEDGER_KEY);
    expect(entry?.status).toBe("left");
  });

  it("left status is not changed to joined after a simulated relay rejection", () => {
    setCommunityMembershipStatus(PUBLIC_KEY, {
      groupId: GROUP_ID,
      relayUrl: RELAY_URL,
      communityId: `${GROUP_ID}:${RELAY_URL}`,
      status: "left",
      updatedAtUnixMs: 2_000,
    });

    const simulateRelayRejection = () => {
      // In the current system there is no relay publish outbox.
      // This test documents that a relay rejection (modeled here as a caller
      // attempting to write "joined" back) must not win over the newer "left".
      saveCommunityMembershipLedger(PUBLIC_KEY, [
        makeEntry({ status: "joined", updatedAtUnixMs: 1_000 }),
      ]);
    };

    simulateRelayRejection();

    const loaded = loadCommunityMembershipLedger(PUBLIC_KEY);
    const entry = loaded.find(e => toCommunityMembershipLedgerKey(e) === LEDGER_KEY);
    // Newer "left" (ts=2000) must win over older "joined" (ts=1000).
    expect(entry?.status).toBe("left");
  });

  it("recovery still hides the group after simulated relay rejection", () => {
    setCommunityMembershipStatus(PUBLIC_KEY, {
      groupId: GROUP_ID,
      relayUrl: RELAY_URL,
      communityId: `${GROUP_ID}:${RELAY_URL}`,
      status: "left",
      updatedAtUnixMs: 2_000,
    });

    // Simulate relay rejection by attempting re-add with older timestamp.
    saveCommunityMembershipLedger(PUBLIC_KEY, [
      makeEntry({ status: "joined", updatedAtUnixMs: 1_000 }),
    ]);

    const ledger = loadCommunityMembershipLedger(PUBLIC_KEY);
    const result = resolveCommunityMembershipRecovery({
      publicKeyHex: PUBLIC_KEY,
      persistedGroups: [makeGroup()],
      membershipLedger: ledger,
      tombstones: new Set(),
    });

    expect(result.groups).toHaveLength(0);
    expect(result.diagnostics.hiddenByLedgerStatusCount).toBe(1);
  });

  it("TODO(AB-05): relay publish outbox item preserves pending state after rate-limit", () => {
    // This test documents the REQUIRED future behavior for the relay publish outbox.
    // When the outbox is implemented, this should:
    //   1. create a CommunityRelayPublishOutboxItem with status "rate_limited" or "pending"
    //   2. confirm the local ledger status remains "left"
    //   3. confirm the outbox item is retrievable and retryable
    // For now it just asserts the precondition: leave is durable without the outbox.
    setCommunityMembershipStatus(PUBLIC_KEY, {
      groupId: GROUP_ID,
      relayUrl: RELAY_URL,
      communityId: `${GROUP_ID}:${RELAY_URL}`,
      status: "left",
    });

    const loaded = loadCommunityMembershipLedger(PUBLIC_KEY);
    const entry = loaded.find(e => toCommunityMembershipLedgerKey(e) === LEDGER_KEY);
    expect(entry?.status).toBe("left");
  });
});
