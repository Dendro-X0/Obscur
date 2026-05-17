import { beforeEach, describe, expect, it, vi } from "vitest";
import { getScopedStorageKey, setProfileScopeOverride } from "@/app/features/profiles/services/profile-scope";
import { accountSyncMutationSignalInternals } from "@/app/shared/account-sync-mutation-signal";
import {
  COMMUNITY_MEMBERSHIP_LEDGER_UPDATED_EVENT,
  LEDGER_ONLY_GROUP_PLACEHOLDER_MESSAGE,
  loadCommunityMembershipLedger,
  mergeCommunityMembershipLedgerEntries,
  saveCommunityMembershipLedger,
  selectJoinedCommunityMembershipLedgerEntries,
  setCommunityMembershipStatus,
  toCommunityMembershipLedgerKey,
  toGroupConversationFromMembershipLedgerEntry,
  type CommunityMembershipLedgerEntry,
} from "./community-membership-ledger";

const PUBLIC_KEY = "a".repeat(64);
const LEGACY_STORAGE_KEY = `obscur.group.membership_ledger.v1.${PUBLIC_KEY}`;
const SCOPED_STORAGE_KEY = getScopedStorageKey(LEGACY_STORAGE_KEY);

const BASE_ENTRY: CommunityMembershipLedgerEntry = {
  communityId: "group-1:wss://relay.example",
  groupId: "group-1",
  relayUrl: "wss://relay.example",
  status: "joined",
  updatedAtUnixMs: 1_000,
  displayName: "Writers",
};

describe("community-membership-ledger", () => {
  beforeEach(() => {
    window.localStorage.clear();
    setProfileScopeOverride(null);
  });

  it("writes to scoped storage key and reads legacy key fallback", () => {
    saveCommunityMembershipLedger(PUBLIC_KEY, [BASE_ENTRY]);
    expect(window.localStorage.getItem(SCOPED_STORAGE_KEY)).not.toBeNull();
    expect(window.localStorage.getItem(LEGACY_STORAGE_KEY)).not.toBeNull();

    window.localStorage.clear();
    window.localStorage.setItem(LEGACY_STORAGE_KEY, JSON.stringify([BASE_ENTRY]));
    const loaded = loadCommunityMembershipLedger(PUBLIC_KEY);
    expect(loaded).toHaveLength(1);
    expect(loaded[0]).toEqual(expect.objectContaining({
      groupId: "group-1",
      relayUrl: "wss://relay.example",
      status: "joined",
    }));
  });

  it("keeps membership ledger readable across profile-scope transitions", () => {
    setProfileScopeOverride("profile-a");
    const scopedStorageKeyA = getScopedStorageKey(LEGACY_STORAGE_KEY, "profile-a");
    saveCommunityMembershipLedger(PUBLIC_KEY, [BASE_ENTRY]);
    expect(window.localStorage.getItem(scopedStorageKeyA)).not.toBeNull();

    setProfileScopeOverride("profile-b");
    const loaded = loadCommunityMembershipLedger(PUBLIC_KEY);
    expect(loaded).toHaveLength(1);
    expect(loaded[0]).toEqual(expect.objectContaining({
      groupId: BASE_ENTRY.groupId,
      relayUrl: BASE_ENTRY.relayUrl,
      status: "joined",
    }));
  });

  it("merges scoped and legacy snapshots instead of letting empty scoped data hide legacy membership", () => {
    const scopedEmpty = getScopedStorageKey(LEGACY_STORAGE_KEY, "profile-b");
    setProfileScopeOverride("profile-b");
    window.localStorage.setItem(scopedEmpty, JSON.stringify([]));
    window.localStorage.setItem(LEGACY_STORAGE_KEY, JSON.stringify([BASE_ENTRY]));

    const loaded = loadCommunityMembershipLedger(PUBLIC_KEY);
    expect(loaded).toHaveLength(1);
    expect(loaded[0]).toEqual(expect.objectContaining({
      groupId: BASE_ENTRY.groupId,
      relayUrl: BASE_ENTRY.relayUrl,
      status: "joined",
    }));
  });

  it("merges by newest entry timestamp per community key", () => {
    const older: CommunityMembershipLedgerEntry = { ...BASE_ENTRY, status: "joined", updatedAtUnixMs: 100 };
    const newer: CommunityMembershipLedgerEntry = { ...BASE_ENTRY, status: "left", updatedAtUnixMs: 200 };
    const merged = mergeCommunityMembershipLedgerEntries([older], [newer]);
    expect(merged).toHaveLength(1);
    expect(merged[0]).toEqual(expect.objectContaining({
      status: "left",
      updatedAtUnixMs: 200,
    }));
  });

  it("preserves hashed community identity and richer metadata when newer fallback evidence arrives", () => {
    const hashedCommunityId = "v2_aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";
    const hashedEntry: CommunityMembershipLedgerEntry = {
      ...BASE_ENTRY,
      communityId: hashedCommunityId,
      updatedAtUnixMs: 100,
      displayName: "Canonical Writers",
      avatar: "https://cdn.example/canonical.png",
    };
    const newerFallback: CommunityMembershipLedgerEntry = {
      ...BASE_ENTRY,
      communityId: "group-1:wss://relay.example",
      updatedAtUnixMs: 200,
      displayName: undefined,
      avatar: undefined,
    };

    const merged = mergeCommunityMembershipLedgerEntries([hashedEntry], [newerFallback]);

    expect(merged).toHaveLength(1);
    expect(merged[0]).toEqual(expect.objectContaining({
      communityId: hashedCommunityId,
      updatedAtUnixMs: 200,
      displayName: "Canonical Writers",
      avatar: "https://cdn.example/canonical.png",
    }));
  });

  it("tracks lifecycle transitions through setCommunityMembershipStatus", () => {
    setCommunityMembershipStatus(PUBLIC_KEY, {
      groupId: BASE_ENTRY.groupId,
      relayUrl: BASE_ENTRY.relayUrl,
      status: "joined",
      updatedAtUnixMs: 100,
    });
    setCommunityMembershipStatus(PUBLIC_KEY, {
      groupId: BASE_ENTRY.groupId,
      relayUrl: BASE_ENTRY.relayUrl,
      status: "left",
      updatedAtUnixMs: 150,
    });
    const loaded = loadCommunityMembershipLedger(PUBLIC_KEY);
    expect(loaded).toHaveLength(1);
    expect(loaded[0]?.status).toBe("left");
    expect(toCommunityMembershipLedgerKey(loaded[0]!)).toBe("group-1@@wss://relay.example");
  });

  it("selects joined entries and builds fallback group conversation for ledger-only hydration", () => {
    const leftEntry: CommunityMembershipLedgerEntry = {
      ...BASE_ENTRY,
      status: "left",
      updatedAtUnixMs: 1_200,
    };
    const entries = [BASE_ENTRY, leftEntry];
    const joined = selectJoinedCommunityMembershipLedgerEntries(entries);
    expect(joined).toHaveLength(1);
    const group = toGroupConversationFromMembershipLedgerEntry(joined[0]!, {
      fallbackMemberPubkeys: [PUBLIC_KEY],
    });
    expect(group.kind).toBe("group");
    expect(group.id).toContain("community:");
    expect(group.memberPubkeys).toEqual([PUBLIC_KEY]);
    expect(group.lastMessage).toBe(LEDGER_ONLY_GROUP_PLACEHOLDER_MESSAGE);
  });

  it("emits update events only when snapshot changes", () => {
    const listener = vi.fn();
    window.addEventListener(COMMUNITY_MEMBERSHIP_LEDGER_UPDATED_EVENT, listener);

    saveCommunityMembershipLedger(PUBLIC_KEY, [BASE_ENTRY]);
    saveCommunityMembershipLedger(PUBLIC_KEY, [BASE_ENTRY]);
    saveCommunityMembershipLedger(PUBLIC_KEY, [{ ...BASE_ENTRY, status: "left", updatedAtUnixMs: BASE_ENTRY.updatedAtUnixMs + 1 }]);

    expect(listener).toHaveBeenCalledTimes(2);
    window.removeEventListener(COMMUNITY_MEMBERSHIP_LEDGER_UPDATED_EVENT, listener);
  });

  it("emits account-sync mutation signal when snapshot changes", () => {
    const listener = vi.fn((event: Event) => event);
    window.addEventListener(accountSyncMutationSignalInternals.ACCOUNT_SYNC_MUTATION_EVENT, listener as EventListener);

    saveCommunityMembershipLedger(PUBLIC_KEY, [BASE_ENTRY]);
    saveCommunityMembershipLedger(PUBLIC_KEY, [BASE_ENTRY]);

    expect(listener).toHaveBeenCalledTimes(1);
    const firstEvent = listener.mock.calls[0]?.[0] as CustomEvent<{ reason: string }>;
    expect(firstEvent.detail.reason).toBe("community_membership_changed");
    window.removeEventListener(accountSyncMutationSignalInternals.ACCOUNT_SYNC_MUTATION_EVENT, listener as EventListener);
  });
});
