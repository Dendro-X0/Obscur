import { beforeEach, describe, expect, it, vi } from "vitest";
import { getScopedStorageKey, setProfileScopeOverride } from "@/app/features/profiles/services/profile-scope";
import { setProfileRuntimeScope } from "@/app/features/profiles/services/profile-runtime-scope";
import { accountSyncMutationSignalInternals } from "@/app/shared/account-sync-mutation-signal";
import {
  COMMUNITY_MEMBERSHIP_LEDGER_UPDATED_EVENT,
  LEDGER_ONLY_GROUP_PLACEHOLDER_MESSAGE,
  loadCommunityMembershipLedger,
  mergeCommunityMembershipLedgerEntries,
  saveCommunityMembershipLedger,
  selectJoinedCommunityMembershipLedgerEntries,
  communityMembershipLedgerInternals,
  toCommunityMembershipLedgerKey,
  toGroupConversationFromMembershipLedgerEntry,
  type CommunityMembershipLedgerEntry,
} from "./community-membership-ledger";
import { validateLedgerEntries } from "./community-ledger-validator";
import { messagingChatStateReadPort } from "@/app/features/messaging/services/messaging-chat-state-read-port";

const PUBLIC_KEY = "a".repeat(64);
const LEGACY_STORAGE_KEY = `obscur.group.membership_ledger.v1.${PUBLIC_KEY}`;
const SCOPED_STORAGE_KEY = getScopedStorageKey(LEGACY_STORAGE_KEY);
const { setCommunityMembershipStatus } = communityMembershipLedgerInternals;

const BASE_ENTRY: CommunityMembershipLedgerEntry = {
  communityId: "group-1:wss://relay.example",
  groupId: "group-1",
  relayUrl: "wss://relay.example",
  status: "joined",
  updatedAtUnixMs: 1_000,
  displayName: "Writers",
  publicKeyHex: PUBLIC_KEY,
  memberPubkeys: [PUBLIC_KEY],
  adminPubkeys: [PUBLIC_KEY],
  ledgerVersion: 2,
  createdAt: 1_000,
  updatedAt: 1_000,
};

describe("community-membership-ledger", () => {
  beforeEach(() => {
    window.localStorage.clear();
    setProfileScopeOverride(null);
    setProfileRuntimeScope(null);
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

  it("does not read profile-a scoped membership from profile-b", () => {
    setProfileScopeOverride("profile-a");
    const scopedStorageKeyA = getScopedStorageKey(LEGACY_STORAGE_KEY, "profile-a");
    saveCommunityMembershipLedger(PUBLIC_KEY, [BASE_ENTRY]);
    expect(window.localStorage.getItem(scopedStorageKeyA)).not.toBeNull();

    setProfileScopeOverride("profile-b");
    const loaded = loadCommunityMembershipLedger(PUBLIC_KEY);
    expect(loaded).toHaveLength(0);
  });

  it("does not read legacy snapshots from named profile scope", () => {
    const scopedEmpty = getScopedStorageKey(LEGACY_STORAGE_KEY, "profile-b");
    setProfileScopeOverride("profile-b");
    window.localStorage.setItem(scopedEmpty, JSON.stringify([]));
    window.localStorage.setItem(LEGACY_STORAGE_KEY, JSON.stringify([BASE_ENTRY]));

    const loaded = loadCommunityMembershipLedger(PUBLIC_KEY);
    expect(loaded).toHaveLength(0);
  });

  it("REL-003: named profile save does not seed legacy key readable by default profile", () => {
    window.localStorage.removeItem(LEGACY_STORAGE_KEY);

    saveCommunityMembershipLedger(PUBLIC_KEY, [BASE_ENTRY], { profileId: "profile-b" });

    expect(window.localStorage.getItem(LEGACY_STORAGE_KEY)).toBeNull();

    setProfileScopeOverride(null);
    expect(loadCommunityMembershipLedger(PUBLIC_KEY)).toHaveLength(0);
  });

  it("bootstrap restore seeds legacy key so default profile rebind can hydrate groups", () => {
    window.localStorage.removeItem(LEGACY_STORAGE_KEY);
    setProfileScopeOverride("bootstrap");

    saveCommunityMembershipLedger(PUBLIC_KEY, [BASE_ENTRY], { profileId: "bootstrap" });

    expect(window.localStorage.getItem(LEGACY_STORAGE_KEY)).not.toBeNull();

    setProfileScopeOverride(null);
    expect(loadCommunityMembershipLedger(PUBLIC_KEY)).toEqual([
      expect.objectContaining({
        groupId: BASE_ENTRY.groupId,
        relayUrl: BASE_ENTRY.relayUrl,
        status: "joined",
      }),
    ]);
  });

  it("can read and write an explicit profile scope without ambient profile override", () => {
    const explicitProfileKey = getScopedStorageKey(LEGACY_STORAGE_KEY, "profile-explicit");
    window.localStorage.setItem(LEGACY_STORAGE_KEY, JSON.stringify([]));

    saveCommunityMembershipLedger(PUBLIC_KEY, [BASE_ENTRY], {
      profileId: "profile-explicit",
    });

    expect(window.localStorage.getItem(explicitProfileKey)).not.toBeNull();
    expect(loadCommunityMembershipLedger(PUBLIC_KEY)).toHaveLength(0);
    expect(loadCommunityMembershipLedger(PUBLIC_KEY, {
      profileId: "profile-explicit",
    })).toEqual([
      expect.objectContaining({
        groupId: BASE_ENTRY.groupId,
        relayUrl: BASE_ENTRY.relayUrl,
        status: "joined",
      }),
    ]);
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

  it("REL-001: terminal left beats stale joined row with newer timestamp on restore merge", () => {
    const staleJoined: CommunityMembershipLedgerEntry = {
      ...BASE_ENTRY,
      status: "joined",
      updatedAtUnixMs: 6_000,
    };
    const durableLeft: CommunityMembershipLedgerEntry = {
      ...BASE_ENTRY,
      status: "left",
      updatedAtUnixMs: 5_000,
    };
    const merged = mergeCommunityMembershipLedgerEntries([staleJoined], [durableLeft]);
    expect(merged).toHaveLength(1);
    expect(merged[0]?.status).toBe("left");
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
      relayUrl: BASE_ENTRY.relayUrl!,
      status: "joined",
      updatedAtUnixMs: 100,
    });
    setCommunityMembershipStatus(PUBLIC_KEY, {
      groupId: BASE_ENTRY.groupId,
      relayUrl: BASE_ENTRY.relayUrl!,
      status: "left",
      updatedAtUnixMs: 150,
    });
    const loaded = loadCommunityMembershipLedger(PUBLIC_KEY);
    expect(loaded).toHaveLength(1);
    expect(loaded[0]?.status).toBe("left");
    expect(toCommunityMembershipLedgerKey(loaded[0]!)).toBe("group-1@@wss://relay.example");
  });

  it("preserves memberPubkeys when loading ledger snapshots", () => {
    const peerPubkey = "b".repeat(64);
    saveCommunityMembershipLedger(PUBLIC_KEY, [{
      ...BASE_ENTRY,
      memberPubkeys: [PUBLIC_KEY, peerPubkey],
      adminPubkeys: [peerPubkey],
      ledgerVersion: 2,
    }]);

    const loaded = loadCommunityMembershipLedger(PUBLIC_KEY);
    expect(loaded).toHaveLength(1);
    expect(loaded[0]?.memberPubkeys).toEqual([PUBLIC_KEY, peerPubkey]);
    expect(loaded[0]?.adminPubkeys).toEqual([peerPubkey]);
    expect(loaded[0]?.ledgerVersion).toBe(2);
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
    const { createProfileMessageBus } =
      require("@dweb/core/profile-message-bus") as typeof import("@dweb/core/profile-message-bus");
    const bus = createProfileMessageBus({ profileId: "default" });
    setProfileRuntimeScope({ profileId: "default", bus });
    const publishSpy = vi.spyOn(bus, "publish");

    try {
      saveCommunityMembershipLedger(PUBLIC_KEY, [BASE_ENTRY]);
      saveCommunityMembershipLedger(PUBLIC_KEY, [BASE_ENTRY]);
      saveCommunityMembershipLedger(PUBLIC_KEY, [{ ...BASE_ENTRY, status: "left", updatedAtUnixMs: BASE_ENTRY.updatedAtUnixMs! + 1 }]);

      expect(publishSpy).toHaveBeenCalledTimes(2);
      expect(publishSpy.mock.calls.every(([event]) => (
        typeof event === "object"
        && event !== null
        && (event as { type?: string }).type === "community-membership-ledger-updated"
      ))).toBe(true);
    } finally {
      setProfileRuntimeScope(null);
    }
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

  it("RIW-1: migrates v1 ledger rows on load and persists v2 snapshot", () => {
    const legacyEntry = {
      communityId: "group-1:wss://relay.example",
      groupId: "group-1",
      relayUrl: "wss://relay.example",
      status: "joined",
      updatedAtUnixMs: 1_000,
      displayName: "Writers",
    };
    window.localStorage.setItem(SCOPED_STORAGE_KEY, JSON.stringify([legacyEntry]));

    const loaded = loadCommunityMembershipLedger(PUBLIC_KEY);
    expect(loaded).toHaveLength(1);
    expect(loaded[0]?.ledgerVersion).toBe(2);
    expect(loaded[0]?.publicKeyHex).toBe(PUBLIC_KEY);
    expect(loaded[0]?.memberPubkeys?.length).toBeGreaterThan(0);

    const persistedRaw = window.localStorage.getItem(SCOPED_STORAGE_KEY);
    expect(persistedRaw).toContain("\"ledgerVersion\":2");
  });

  it("RIW-1: repairs joined v2 rows missing displayName on load (NewTest 2 class)", () => {
    const newTest2GroupId = "b93f53e23d8c4456835afd3f4d3a627b";
    const incompleteJoined: CommunityMembershipLedgerEntry = {
      communityId: `group:${newTest2GroupId}:ws://localhost:7000`,
      groupId: newTest2GroupId,
      relayUrl: "ws://localhost:7000",
      status: "joined",
      updatedAtUnixMs: 1_000,
      publicKeyHex: PUBLIC_KEY,
      memberPubkeys: [PUBLIC_KEY],
      adminPubkeys: [PUBLIC_KEY],
      ledgerVersion: 2,
    };
    window.localStorage.setItem(SCOPED_STORAGE_KEY, JSON.stringify([incompleteJoined]));

    vi.spyOn(messagingChatStateReadPort, "load").mockReturnValue(null);

    const loaded = loadCommunityMembershipLedger(PUBLIC_KEY);
    const validation = validateLedgerEntries(loaded, { allowLegacy: true });

    expect(validation.invalid).toBe(0);
    expect(loaded[0]?.displayName).toContain("b93f53e2");
  });

  it("RIW-1: archival historical rows stay valid without active-member fields", () => {
    const historical: CommunityMembershipLedgerEntry = {
      communityId: "group-legacy:ws://localhost:7000",
      groupId: "legacy-group",
      relayUrl: "ws://localhost:7000",
      status: "historical",
      updatedAtUnixMs: 1_000,
    };
    window.localStorage.setItem(SCOPED_STORAGE_KEY, JSON.stringify([historical]));

    const loaded = loadCommunityMembershipLedger(PUBLIC_KEY);
    const validation = validateLedgerEntries(loaded, { allowLegacy: true });

    expect(validation.invalid).toBe(0);
  });
});
