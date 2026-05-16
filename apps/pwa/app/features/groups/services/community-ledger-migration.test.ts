import { describe, it, expect } from "vitest";
import {
  migrateLedgerEntry,
  migrateLedgerEntries,
  getMigrationStats,
  getEntryVersion,
  needsMigrationToVersion,
} from "./community-ledger-migration";
import { CURRENT_LEDGER_VERSION, PLACEHOLDER_GROUP_NAME } from "./community-ledger-validator";
import type { CommunityMembershipLedgerEntry } from "./community-membership-ledger";

describe("community-ledger-migration", () => {
  const publicKeyHex = "test-pubkey-123";
  const now = Date.now();

  // Legacy v1 entry (no ledgerVersion, no memberPubkeys, no adminPubkeys)
  const v1Entry: CommunityMembershipLedgerEntry = {
    groupId: "test-group",
    relayUrl: "wss://relay.example.com",
    status: "joined",
    updatedAtUnixMs: 1000000,
    displayName: "Test Group",
  } as CommunityMembershipLedgerEntry; // Cast to bypass type checking for legacy data

  // Entry with partial v2 fields
  const partialV2Entry: CommunityMembershipLedgerEntry = {
    groupId: "test-group-2",
    publicKeyHex,
    relayUrl: "wss://relay.example.com",
    status: "joined",
    updatedAtUnixMs: 2000000,
    displayName: "Another Group",
    memberPubkeys: ["member1"],
    adminPubkeys: ["member1"],
    ledgerVersion: 1, // Still v1
  };

  // Full v2 entry
  const v2Entry: CommunityMembershipLedgerEntry = {
    groupId: "test-group-3",
    publicKeyHex,
    relayUrl: "wss://relay.example.com",
    status: "joined",
    updatedAtUnixMs: 3000000,
    displayName: "V2 Group",
    memberPubkeys: ["member1", "member2"],
    adminPubkeys: ["member1"],
    ledgerVersion: 2,
    createdAt: 3000000,
    updatedAt: 3000000,
  };

  describe("getEntryVersion", () => {
    it("should return 1 for undefined ledgerVersion", () => {
      expect(getEntryVersion(v1Entry)).toBe(1);
    });

    it("should return explicit ledgerVersion", () => {
      expect(getEntryVersion(partialV2Entry)).toBe(1);
      expect(getEntryVersion(v2Entry)).toBe(2);
    });
  });

  describe("needsMigrationToVersion", () => {
    it("should return true for v1 entries", () => {
      expect(needsMigrationToVersion(v1Entry, 2)).toBe(true);
      expect(needsMigrationToVersion(partialV2Entry, 2)).toBe(true);
    });

    it("should return false for current version", () => {
      expect(needsMigrationToVersion(v2Entry, 2)).toBe(false);
    });

    it("should return false for future versions", () => {
      const v3Entry = { ...v2Entry, ledgerVersion: 3 };
      expect(needsMigrationToVersion(v3Entry, 2)).toBe(false);
    });
  });

  describe("migrateLedgerEntry", () => {
    const context = {
      publicKeyHex,
      persistedGroups: [
        {
          groupId: "test-group",
          displayName: "Persisted Group Name",
          memberPubkeys: ["persisted1", "persisted2"],
          adminPubkeys: ["persisted1"],
        },
      ],
      now,
    };

    it("should not migrate v2 entries", () => {
      const result = migrateLedgerEntry(v2Entry, context);
      expect(result).toEqual(v2Entry);
    });

    it("should migrate v1 entries to v2", () => {
      const result = migrateLedgerEntry(v1Entry, context);
      expect(result.ledgerVersion).toBe(2);
    });

    it("should add memberPubkeys from persisted groups", () => {
      const result = migrateLedgerEntry(v1Entry, context);
      expect(result.memberPubkeys).toContain("persisted1");
      expect(result.memberPubkeys).toContain("persisted2");
    });

    it("should add adminPubkeys from persisted groups", () => {
      const result = migrateLedgerEntry(v1Entry, context);
      expect(result.adminPubkeys).toContain("persisted1");
    });

    it("should fallback to publicKeyHex when no persisted data", () => {
      const entry = { ...v1Entry, groupId: "unknown-group" };
      const result = migrateLedgerEntry(entry, context);
      expect(result.memberPubkeys).toContain(publicKeyHex);
      expect(result.adminPubkeys).toContain(publicKeyHex);
    });

    it("should add createdAt and updatedAt timestamps", () => {
      const result = migrateLedgerEntry(v1Entry, context);
      expect(result.createdAt).toBeDefined();
      expect(result.updatedAt).toBe(now);
    });

    it("should add publicKeyHex", () => {
      const result = migrateLedgerEntry(v1Entry, context);
      expect(result.publicKeyHex).toBe(publicKeyHex);
    });

    it("should preserve existing memberPubkeys if present", () => {
      const entryWithMembers = {
        ...partialV2Entry,
        groupId: "unknown-group", // Not in persisted groups
      };
      const result = migrateLedgerEntry(entryWithMembers, context);
      expect(result.memberPubkeys).toContain("member1");
    });

    it("should preserve displayName if present", () => {
      const result = migrateLedgerEntry(v1Entry, context);
      expect(result.displayName).toBe("Test Group"); // Original, not persisted
    });

    it("should use persisted displayName if original is placeholder", () => {
      const entry = { ...v1Entry, displayName: PLACEHOLDER_GROUP_NAME };
      const result = migrateLedgerEntry(entry, context);
      expect(result.displayName).toBe("Persisted Group Name");
    });

    it("should convert avatar to avatarUrl", () => {
      const entry = { ...v1Entry, avatar: "hash123" };
      const result = migrateLedgerEntry(entry, context);
      expect(result.avatarUrl).toBe("hash123");
    });

    it("should preserve avatarUrl if already present", () => {
      const entry = { ...partialV2Entry, avatarUrl: "existing-hash" };
      const result = migrateLedgerEntry(entry, context);
      expect(result.avatarUrl).toBe("existing-hash");
    });

    it("should preserve legacy fields for backward compatibility", () => {
      const result = migrateLedgerEntry(v1Entry, context);
      expect(result.communityId).toBe(v1Entry.communityId);
      expect(result.relayUrl).toBe(v1Entry.relayUrl);
      expect(result.updatedAtUnixMs).toBe(v1Entry.updatedAtUnixMs);
    });
  });

  describe("migrateLedgerEntries", () => {
    const entries = [v1Entry, partialV2Entry, v2Entry];

    it("should migrate all entries needing migration", async () => {
      const result = await migrateLedgerEntries(entries, publicKeyHex);
      expect(result.stats.migrated).toBe(2); // v1 and partialV2
      expect(result.stats.alreadyCurrent).toBe(1); // v2
    });

    it("should return correct stats", async () => {
      const result = await migrateLedgerEntries(entries, publicKeyHex);
      expect(result.stats.total).toBe(3);
      expect(result.stats.failed).toBe(0);
    });

    it("should return migrated entries", async () => {
      const result = await migrateLedgerEntries(entries, publicKeyHex);
      expect(result.migrated).toHaveLength(3);
      expect(result.migrated[0].ledgerVersion).toBe(2);
      expect(result.migrated[1].ledgerVersion).toBe(2);
      expect(result.migrated[2].ledgerVersion).toBe(2);
    });

    it("should use persisted groups when provided", async () => {
      const loadPersistedGroups = async () => [
        {
          groupId: "test-group",
          displayName: "Loaded Persisted",
          memberPubkeys: ["loaded1"],
          adminPubkeys: ["loaded1"],
        },
      ];

      const result = await migrateLedgerEntries(
        [v1Entry],
        publicKeyHex,
        loadPersistedGroups
      );

      expect(result.migrated[0].memberPubkeys).toContain("loaded1");
    });
  });

  describe("getMigrationStats", () => {
    it("should return correct totals", () => {
      const entries = [v1Entry, partialV2Entry, v2Entry];
      const stats = getMigrationStats(entries);
      expect(stats.total).toBe(3);
    });

    it("should count by version", () => {
      const entries = [v1Entry, partialV2Entry, v2Entry];
      const stats = getMigrationStats(entries);
      expect(stats.byVersion[1]).toBe(2);
      expect(stats.byVersion[2]).toBe(1);
    });

    it("should count needing migration", () => {
      const entries = [v1Entry, partialV2Entry, v2Entry];
      const stats = getMigrationStats(entries);
      expect(stats.needMigration).toBe(2);
    });

    it("should handle empty entries", () => {
      const stats = getMigrationStats([]);
      expect(stats.total).toBe(0);
      expect(stats.needMigration).toBe(0);
    });
  });

  describe("CURRENT_LEDGER_VERSION", () => {
    it("should be 2", () => {
      expect(CURRENT_LEDGER_VERSION).toBe(2);
    });
  });
});
