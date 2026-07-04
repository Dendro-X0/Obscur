import { describe, it, expect } from "vitest";
import {
  validateLedgerEntry,
  assertValidLedgerEntry,
  isValidLedgerEntryQuick,
  validateLedgerEntries,
  needsMigration,
  getLedgerVersion,
  CURRENT_LEDGER_VERSION,
  PLACEHOLDER_GROUP_NAME,
} from "./community-ledger-validator";
import type { CommunityMembershipLedgerEntry } from "./community-membership-ledger";

describe("community-ledger-validator", () => {
  const validEntry: CommunityMembershipLedgerEntry = {
    groupId: "test-group-123",
    publicKeyHex: "abcdef1234567890",
    status: "joined",
    displayName: "Test Group",
    memberPubkeys: ["member1", "member2", "member3"],
    adminPubkeys: ["member1"],
    ledgerVersion: 2,
    createdAt: 1000000,
    updatedAt: 1000000,
  };

  describe("validateLedgerEntry", () => {
    it("should pass for a fully valid entry", () => {
      const result = validateLedgerEntry(validEntry);
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
      expect(result.details.hasValidMemberList).toBe(true);
    });

    it("should reject entries without groupId", () => {
      const entry = { ...validEntry, groupId: "" };
      const result = validateLedgerEntry(entry);
      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.includes("groupId"))).toBe(true);
    });

    it("should reject entries without publicKeyHex", () => {
      const entry = { ...validEntry, publicKeyHex: "" };
      const result = validateLedgerEntry(entry);
      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.includes("publicKeyHex"))).toBe(true);
    });

    it("should reject entries without status", () => {
      const entry = { ...validEntry, status: undefined as any };
      const result = validateLedgerEntry(entry);
      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.includes("status"))).toBe(true);
    });

    it("should reject entries with invalid status", () => {
      const entry = { ...validEntry, status: "invalid-status" as any };
      const result = validateLedgerEntry(entry);
      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.includes("Invalid status"))).toBe(true);
    });

    it("should treat archival historical rows as valid when allowLegacy", () => {
      const entry = {
        groupId: "legacy-group",
        status: "historical" as const,
      };
      const result = validateLedgerEntry(entry, { allowLegacy: true });
      expect(result.valid).toBe(true);
      expect(result.warnings.some((warning) => warning.includes("Thin ledger status"))).toBe(true);
    });

    it("should treat terminal left rows as valid when allowLegacy", () => {
      const entry = {
        groupId: "legacy-group",
        status: "left" as const,
        publicKeyHex: "abc",
      };
      const result = validateLedgerEntry(entry, { allowLegacy: true });
      expect(result.valid).toBe(true);
      expect(result.warnings.some((warning) => warning.includes("Thin ledger status"))).toBe(true);
    });

    it("should still reject archival rows without groupId", () => {
      const entry = {
        groupId: "",
        status: "historical" as const,
      };
      const result = validateLedgerEntry(entry, { allowLegacy: true });
      expect(result.valid).toBe(false);
      expect(result.errors.some((error) => error.includes("groupId"))).toBe(true);
    });

    it("should reject entries without displayName", () => {
      const entry = { ...validEntry, displayName: "" };
      const result = validateLedgerEntry(entry);
      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.includes("displayName"))).toBe(true);
    });

    it("should warn for placeholder display name", () => {
      const entry = { ...validEntry, displayName: PLACEHOLDER_GROUP_NAME };
      const result = validateLedgerEntry(entry);
      expect(result.warnings.some(w => w.includes("placeholder"))).toBe(true);
      expect(result.details.hasValidDisplayName).toBe(false);
    });

    it("should reject entries without memberPubkeys", () => {
      const entry = { ...validEntry, memberPubkeys: undefined as any };
      const result = validateLedgerEntry(entry);
      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.includes("memberPubkeys field is missing"))).toBe(true);
      expect(result.details.hasValidMemberList).toBe(false);
    });

    it("should reject entries with empty memberPubkeys", () => {
      const entry = { ...validEntry, memberPubkeys: [] };
      const result = validateLedgerEntry(entry);
      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.includes("memberPubkeys is empty"))).toBe(true);
      expect(result.details.hasValidMemberList).toBe(false);
    });

    it("should reject entries where admin is not in member list", () => {
      const entry = { ...validEntry, adminPubkeys: ["not-a-member"] };
      const result = validateLedgerEntry(entry);
      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.includes("Admin pubkeys not found"))).toBe(true);
    });

    it("should warn for missing ledgerVersion", () => {
      const entry = { ...validEntry, ledgerVersion: undefined as any };
      const result = validateLedgerEntry(entry, { allowLegacy: true });
      expect(result.warnings.some(w => w.includes("ledgerVersion"))).toBe(true);
      expect(result.valid).toBe(true); // Should pass with allowLegacy
    });

    it("should reject missing ledgerVersion when allowLegacy is false", () => {
      const entry = { ...validEntry, ledgerVersion: undefined as any };
      const result = validateLedgerEntry(entry, { allowLegacy: false });
      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.includes("ledgerVersion"))).toBe(true);
    });

    it("should reject unsupported ledgerVersion", () => {
      const entry = { ...validEntry, ledgerVersion: 999 };
      const result = validateLedgerEntry(entry);
      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.includes("Unsupported ledgerVersion"))).toBe(true);
    });

    it("should warn for missing timestamps", () => {
      const entry = { ...validEntry, createdAt: undefined, updatedAt: undefined };
      const result = validateLedgerEntry(entry);
      expect(result.warnings.some(w => w.includes("createdAt"))).toBe(true);
      expect(result.warnings.some(w => w.includes("updatedAt"))).toBe(true);
    });

    it("should include context prefix in errors when provided", () => {
      const entry = { ...validEntry, groupId: "" };
      const result = validateLedgerEntry(entry, { context: "test-context" });
      expect(result.errors[0]).toMatch(/^\[test-context\]/);
    });
  });

  describe("assertValidLedgerEntry", () => {
    it("should not throw for valid entry", () => {
      expect(() => assertValidLedgerEntry(validEntry)).not.toThrow();
    });

    it("should throw for invalid entry", () => {
      const entry = { ...validEntry, groupId: "" };
      expect(() => assertValidLedgerEntry(entry)).toThrow("Invalid ledger entry");
    });

    it("should include error details in thrown message", () => {
      const entry = { ...validEntry, memberPubkeys: [] };
      expect(() => assertValidLedgerEntry(entry)).toThrow("memberPubkeys is empty");
    });
  });

  describe("isValidLedgerEntryQuick", () => {
    it("should return true for valid entry", () => {
      expect(isValidLedgerEntryQuick(validEntry)).toBe(true);
    });

    it("should return false for entry without groupId", () => {
      const entry = { ...validEntry, groupId: "" };
      expect(isValidLedgerEntryQuick(entry)).toBe(false);
    });

    it("should return false for entry without publicKeyHex", () => {
      const entry = { ...validEntry, publicKeyHex: "" };
      expect(isValidLedgerEntryQuick(entry)).toBe(false);
    });

    it("should return false for entry without displayName", () => {
      const entry = { ...validEntry, displayName: "" };
      expect(isValidLedgerEntryQuick(entry)).toBe(false);
    });

    it("should return false for entry without status", () => {
      const entry = { ...validEntry, status: undefined as any };
      expect(isValidLedgerEntryQuick(entry)).toBe(false);
    });

    it("should return false for entry without memberPubkeys", () => {
      const entry = { ...validEntry, memberPubkeys: undefined as any };
      expect(isValidLedgerEntryQuick(entry)).toBe(false);
    });

    it("should return false for entry with empty memberPubkeys", () => {
      const entry = { ...validEntry, memberPubkeys: [] };
      expect(isValidLedgerEntryQuick(entry)).toBe(false);
    });
  });

  describe("validateLedgerEntries", () => {
    it("should validate multiple entries", () => {
      const entries = [
        validEntry,
        { ...validEntry, groupId: "group-2" },
        { ...validEntry, groupId: "", memberPubkeys: [] },
      ];
      const result = validateLedgerEntries(entries);
      expect(result.total).toBe(3);
      expect(result.valid).toBe(2);
      expect(result.invalid).toBe(1);
      expect(result.allValid).toBe(false);
    });

    it("should include per-entry results", () => {
      const entries = [validEntry, { ...validEntry, groupId: "" }];
      const result = validateLedgerEntries(entries);
      expect(result.results).toHaveLength(2);
      expect(result.results[0].result.valid).toBe(true);
      expect(result.results[1].result.valid).toBe(false);
    });

    it("should aggregate errors", () => {
      const entries = [
        { ...validEntry, groupId: "" },
        { ...validEntry, memberPubkeys: [] },
      ];
      const result = validateLedgerEntries(entries);
      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.errors.some(e => e.includes("groupId"))).toBe(true);
      expect(result.errors.some(e => e.includes("memberPubkeys"))).toBe(true);
    });
  });

  describe("needsMigration", () => {
    it("should return true for v1 entries", () => {
      const entry = { ...validEntry, ledgerVersion: 1 };
      expect(needsMigration(entry)).toBe(true);
    });

    it("should return true for entries without ledgerVersion (treated as v1)", () => {
      const entry = { ...validEntry, ledgerVersion: undefined as any };
      expect(needsMigration(entry)).toBe(true);
    });

    it("should return false for v2 entries", () => {
      expect(needsMigration(validEntry)).toBe(false);
    });

    it("should return false for v3 entries (future-proof)", () => {
      const entry = { ...validEntry, ledgerVersion: 3 };
      expect(needsMigration(entry)).toBe(false);
    });
  });

  describe("getLedgerVersion", () => {
    it("should return explicit version", () => {
      expect(getLedgerVersion(validEntry)).toBe(2);
    });

    it("should return 1 for undefined version", () => {
      const entry = { ...validEntry, ledgerVersion: undefined as any };
      expect(getLedgerVersion(entry)).toBe(1);
    });
  });

  describe("CURRENT_LEDGER_VERSION", () => {
    it("should be 2", () => {
      expect(CURRENT_LEDGER_VERSION).toBe(2);
    });
  });

  describe("PLACEHOLDER_GROUP_NAME", () => {
    it("should be 'Private Group'", () => {
      expect(PLACEHOLDER_GROUP_NAME).toBe("Private Group");
    });
  });
});
