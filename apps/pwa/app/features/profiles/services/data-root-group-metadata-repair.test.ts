import { describe, expect, it, vi, beforeEach } from "vitest";
import type { PublicKeyHex } from "@dweb/crypto/public-key-hex";

const PUBLIC_KEY = "a".repeat(64) as PublicKeyHex;
const PEER_KEY = "b".repeat(64) as PublicKeyHex;

const loadMock = vi.fn();
const updateMock = vi.fn();
const loadSqliteGroupsMock = vi.fn();
const loadLedgerMock = vi.fn();
const saveLedgerMock = vi.fn();
const harvestMock = vi.fn();

vi.mock("@/app/features/messaging/services/chat-state-store-legacy", () => ({
  chatStateStoreService: {
    load: (...args: unknown[]) => loadMock(...args),
    update: (...args: unknown[]) => updateMock(...args),
  },
}));

vi.mock("@dweb/db", () => ({
  isTauri: () => true,
}));

vi.mock("@/app/features/runtime/native-persistence-policy", () => ({
  requiresSqlitePersistence: () => true,
}));

vi.mock("@/app/features/profiles/services/account-shared-sqlite-profile-ids", () => ({
  listAccountSharedSqliteProfileIds: () => ["tester2", "default"],
}));

vi.mock("@/app/features/groups/services/community-group-sqlite-store", () => ({
  loadSqliteGroupPersistedRows: (...args: unknown[]) => loadSqliteGroupsMock(...args),
}));

vi.mock("@/app/features/groups/services/account-group-sqlite-evidence", () => ({
  accountHasSqliteGroupMessageEvidence: vi.fn(async () => true),
}));

vi.mock("@/app/features/groups/services/community-membership-ledger", async () => {
  const actual = await vi.importActual<typeof import("@/app/features/groups/services/community-membership-ledger")>(
    "@/app/features/groups/services/community-membership-ledger",
  );
  return {
    ...actual,
    loadCommunityMembershipLedger: (...args: unknown[]) => loadLedgerMock(...args),
    saveCommunityMembershipLedger: (...args: unknown[]) => saveLedgerMock(...args),
  };
});

vi.mock("@/app/features/profiles/services/profile-web-storage-harvest-service", () => ({
  harvestProfileWebStorage: (...args: unknown[]) => harvestMock(...args),
  listHarvestedLedgerEntriesForPubkey: (harvest: { ledgers: Array<{ publicKeyHex: string; entries: unknown[] }> }, pubkey: string) => (
    harvest.ledgers
      .filter((snapshot) => snapshot.publicKeyHex === pubkey)
      .flatMap((snapshot) => snapshot.entries)
  ),
  listHarvestedJoinedLedgerEntriesAcrossProfiles: (harvest: { ledgers: Array<{ entries: Array<{ status?: string }> }> }) => (
    harvest.ledgers.flatMap((snapshot) => snapshot.entries.filter((entry) => entry.status === "joined"))
  ),
}));

import {
  repairGroupMetadataAfterStorageLoss,
  repairGroupMetadataFromSiblingWebStorage,
  repairGroupMetadataFromSqliteIfSparse,
} from "./data-root-group-metadata-repair";
import { accountHasSqliteGroupMessageEvidence } from "@/app/features/groups/services/account-group-sqlite-evidence";

describe("repairGroupMetadataFromSqliteIfSparse", () => {
  beforeEach(() => {
    loadMock.mockReset();
    updateMock.mockReset();
    loadSqliteGroupsMock.mockReset();
    loadLedgerMock.mockReset();
    saveLedgerMock.mockReset();
    harvestMock.mockReset();
    vi.mocked(accountHasSqliteGroupMessageEvidence).mockResolvedValue(true);
    loadMock.mockReturnValue({ createdGroups: [] });
    loadLedgerMock.mockReturnValue([]);
    harvestMock.mockResolvedValue({ ledgers: [], directories: [], scannedFileCount: 0 });
  });

  it("restores sparse chat-state groups from sqlite rows", async () => {
    loadSqliteGroupsMock.mockImplementation(async (profileId: string) => (
      profileId === "tester2"
        ? [{
          id: "community:group-a:wss://relay",
          communityId: "group-a:wss://relay",
          groupId: "group-a",
          relayUrl: "wss://relay",
          displayName: "Recovered Group",
          memberPubkeys: [PUBLIC_KEY],
          lastMessage: "",
          unreadCount: 0,
          lastMessageTimeMs: 1,
          access: "invite-only",
          memberCount: 1,
          adminPubkeys: [],
        }]
        : []
    ));

    const restored = await repairGroupMetadataFromSqliteIfSparse({
      publicKeyHex: PUBLIC_KEY,
      profileId: "tester2",
    });

    expect(restored).toBe(1);
    expect(updateMock).toHaveBeenCalled();
    expect(saveLedgerMock).toHaveBeenCalled();
  });

  it("skips orphan sqlite metadata without membership or message evidence", async () => {
    vi.mocked(accountHasSqliteGroupMessageEvidence).mockResolvedValue(false);
    loadSqliteGroupsMock.mockResolvedValue([{
      id: "community:group-a:wss://relay",
      communityId: "group-a:wss://relay",
      groupId: "group-a",
      relayUrl: "wss://relay",
      displayName: "Orphan Group",
      memberPubkeys: [],
      lastMessage: "",
      unreadCount: 0,
      lastMessageTimeMs: 1,
      access: "invite-only",
      memberCount: 0,
      adminPubkeys: [],
    }]);

    const restored = await repairGroupMetadataFromSqliteIfSparse({
      publicKeyHex: PUBLIC_KEY,
      profileId: "tester2",
    });

    expect(restored).toBe(0);
    expect(updateMock).not.toHaveBeenCalled();
    expect(saveLedgerMock).not.toHaveBeenCalled();
  });
});

describe("repairGroupMetadataFromSiblingWebStorage", () => {
  beforeEach(() => {
    loadMock.mockReset();
    updateMock.mockReset();
    loadLedgerMock.mockReset();
    saveLedgerMock.mockReset();
    harvestMock.mockReset();
    loadMock.mockReturnValue({ createdGroups: [] });
    loadLedgerMock.mockReturnValue([{
      groupId: "group-a",
      relayUrl: "ws://localhost:7000",
      status: "left",
      updatedAtUnixMs: 100,
      displayName: "NewTest 2",
      memberPubkeys: [PUBLIC_KEY, PEER_KEY],
    }]);
  });

  it("revives terminal left rows when another profile slot still has joined evidence", async () => {
    harvestMock.mockResolvedValue({
      scannedFileCount: 2,
      directories: [],
      ledgers: [{
        profileSlot: "default",
        publicKeyHex: PEER_KEY,
        sourcePath: "profiles/default/leveldb/000005.ldb",
        entries: [{
          groupId: "group-a",
          relayUrl: "ws://localhost:7000",
          status: "joined",
          updatedAtUnixMs: 200,
          displayName: "NewTest 2",
          memberPubkeys: [PUBLIC_KEY, PEER_KEY],
        }],
      }],
    });

    const restored = await repairGroupMetadataFromSiblingWebStorage({
      publicKeyHex: PUBLIC_KEY,
      profileId: "profile-2",
    });

    expect(restored).toBe(1);
    expect(saveLedgerMock).toHaveBeenCalled();
    const savedEntries = saveLedgerMock.mock.calls.at(-1)?.[1] as Array<{ status: string }>;
    expect(savedEntries.some((entry) => entry.status === "joined")).toBe(true);
    expect(updateMock).toHaveBeenCalled();
  });

  it("does not revive stale localhost left rows without peer or directory evidence", async () => {
    loadLedgerMock.mockReturnValue([{
      groupId: "group-a",
      relayUrl: "ws://localhost:7000",
      status: "left",
      updatedAtUnixMs: 100,
      displayName: "NewTest 2",
      communityId: "v2_c32217ec6a10145ff4bb1109b78b73923f2f226ceb7c5f85afac773b0d2cf84f",
      memberPubkeys: [PUBLIC_KEY, PEER_KEY],
    }]);
    harvestMock.mockResolvedValue({
      scannedFileCount: 0,
      directories: [],
      ledgers: [],
    });

    const restored = await repairGroupMetadataFromSiblingWebStorage({
      publicKeyHex: PUBLIC_KEY,
      profileId: "profile-2",
    });

    expect(restored).toBe(0);
    if (saveLedgerMock.mock.calls.length > 0) {
      const savedEntries = saveLedgerMock.mock.calls.at(-1)?.[1] as Array<{ status: string }>;
      expect(savedEntries.every((entry) => entry.status !== "joined")).toBe(true);
    }
  });
});

describe("repairGroupMetadataAfterStorageLoss", () => {
  beforeEach(() => {
    loadMock.mockReset();
    updateMock.mockReset();
    loadSqliteGroupsMock.mockReset();
    loadLedgerMock.mockReset();
    saveLedgerMock.mockReset();
    harvestMock.mockReset();
    loadMock.mockReturnValue({ createdGroups: [] });
    loadLedgerMock.mockReturnValue([]);
    loadSqliteGroupsMock.mockResolvedValue([]);
    harvestMock.mockResolvedValue({ ledgers: [], directories: [], scannedFileCount: 0 });
  });

  it("runs sqlite and sibling repair in sequence", async () => {
    const restored = await repairGroupMetadataAfterStorageLoss({
      publicKeyHex: PUBLIC_KEY,
      profileId: "profile-2",
    });
    expect(restored).toBe(0);
    expect(harvestMock).toHaveBeenCalled();
  });
});
