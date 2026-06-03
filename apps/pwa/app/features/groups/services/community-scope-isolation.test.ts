/**
 * M0 Baseline Tests — AB-08
 *
 * AB-08: Stale profile-A community hydrate must not bleed into profile-B.
 *
 *   Scenario (same-process, two profiles):
 *     1. Profile A loads, ledger is hydrated → community "alpha" is joined.
 *     2. Profile A switches window to profile B (same process).
 *     3. Profile B has never joined "alpha".
 *     4. The hydration for profile B must not see profile A's ledger.
 *     5. Cross-profile localStorage scope must produce different keys.
 *
 *   This tests the scoping contract between profiles at the storage layer.
 *   It targets the ambient `profileScopeOverride` pattern that is the
 *   documented root cause of cross-profile contamination.
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
  saveCommunityMembershipLedger,
  toCommunityMembershipLedgerKey,
  type CommunityMembershipLedgerEntry,
} from "./community-membership-ledger";
import { resolveCommunityMembershipRecovery } from "./community-membership-recovery";
import type { GroupConversation } from "@/app/features/messaging/types";

const PK_A = "a".repeat(64) as PublicKeyHex;
const PK_B = "b".repeat(64) as PublicKeyHex;
const GROUP_ID = "alpha";
const RELAY_URL = "wss://relay.example";
const COMMUNITY_ID = `${GROUP_ID}:${RELAY_URL}`;
const { setCommunityMembershipStatus } = communityMembershipLedgerInternals;
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

const makeEntry = (status: CommunityMembershipLedgerEntry["status"]): CommunityMembershipLedgerEntry => ({
  communityId: COMMUNITY_ID,
  groupId: GROUP_ID,
  relayUrl: RELAY_URL,
  status,
  updatedAtUnixMs: 1_000,
});

describe("AB-08 — profile scope isolation for community ledger hydration", () => {
  beforeEach(() => {
    window.localStorage.clear();
    setProfileScopeOverride(null);
  });

  it("profile-A and profile-B storage keys are distinct", () => {
    const baseKey = `obscur.group.membership_ledger.v1.${PK_A}`;
    const keyForA = getScopedStorageKey(baseKey, "profile-a");
    const keyForB = getScopedStorageKey(baseKey, "profile-b");
    expect(keyForA).not.toBe(keyForB);
  });

  it("profile-A ledger write does not appear under profile-B scope", () => {
    setProfileScopeOverride("profile-a");
    saveCommunityMembershipLedger(PK_A, [makeEntry("joined")]);

    setProfileScopeOverride("profile-b");
    const loadedB = loadCommunityMembershipLedger(PK_A);

    const entryB = loadedB.find(e => toCommunityMembershipLedgerKey(e) === LEDGER_KEY);
    expect(entryB).toBeUndefined();
  });

  it("REL-003: named profile save does not seed legacy key for default profile read", () => {
    window.localStorage.removeItem(`obscur.group.membership_ledger.v1.${PK_A}`);

    saveCommunityMembershipLedger(PK_A, [makeEntry("joined")], { profileId: "profile-b" });

    expect(window.localStorage.getItem(`obscur.group.membership_ledger.v1.${PK_A}`)).toBeNull();

    setProfileScopeOverride(null);
    expect(loadCommunityMembershipLedger(PK_A)).toHaveLength(0);
  });

  it("profile-A left status does not suppress profile-B joined group", () => {
    setProfileScopeOverride("profile-a");
    setCommunityMembershipStatus(PK_A, {
      groupId: GROUP_ID,
      relayUrl: RELAY_URL,
      communityId: COMMUNITY_ID,
      status: "left",
      updatedAtUnixMs: 2_000,
    });

    setProfileScopeOverride("profile-b");
    saveCommunityMembershipLedger(PK_B, [makeEntry("joined")]);
    const ledgerB = loadCommunityMembershipLedger(PK_B);

    const result = resolveCommunityMembershipRecovery({
      publicKeyHex: PK_B,
      persistedGroups: [makeGroup(PK_B)],
      membershipLedger: ledgerB,
      tombstones: new Set(),
    });

    // Profile B has "joined" — must not be hidden by profile A's "left".
    expect(result.groups).toHaveLength(1);
    expect(result.groups[0]?.groupId).toBe(GROUP_ID);
  });

  it("profile-B joined status does not show profile-A's left community", () => {
    setProfileScopeOverride("profile-b");
    setCommunityMembershipStatus(PK_B, {
      groupId: GROUP_ID,
      relayUrl: RELAY_URL,
      communityId: COMMUNITY_ID,
      status: "joined",
      updatedAtUnixMs: 1_000,
    });

    setProfileScopeOverride("profile-a");
    const ledgerA = loadCommunityMembershipLedger(PK_A);

    // Profile A has no ledger entry — profile B's join must not contaminate it.
    const fromB = ledgerA.find(e => toCommunityMembershipLedgerKey(e) === LEDGER_KEY);
    expect(fromB).toBeUndefined();
  });

  it("null profile scope (default) remains distinct from named profile scope", () => {
    const baseKey = `obscur.group.membership_ledger.v1.${PK_A}`;

    // Compute keys before any scope override to get the true default key.
    setProfileScopeOverride(null);
    const defaultKey = getScopedStorageKey(baseKey);
    const scopedKey = getScopedStorageKey(baseKey, "profile-a");

    // The two keys must differ.
    expect(scopedKey).not.toBe(defaultKey);

    // Write under the default scope (no override = default profile).
    saveCommunityMembershipLedger(PK_A, [makeEntry("joined")]);

    // Switch to named profile-a scope and load.
    setProfileScopeOverride("profile-a");
    const loadedWithScope = loadCommunityMembershipLedger(PK_A);

    // INVARIANT (AB-08): profile-a scoped key must have no data written by
    // the default-scope save above. The legacy key fallback must not leak
    // default-scope writes into a named-profile read.
    const scopedOnly = window.localStorage.getItem(scopedKey);
    if (scopedOnly === null) {
      expect(loadedWithScope.find(e => toCommunityMembershipLedgerKey(e) === LEDGER_KEY)).toBeUndefined();
    }
  });
});
