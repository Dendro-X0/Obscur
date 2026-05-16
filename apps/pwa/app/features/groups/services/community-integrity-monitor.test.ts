import { describe, it, expect } from "vitest";
import {
  checkGroupIntegrity,
  checkAllGroupsIntegrity,
  attemptGroupRepair,
} from "./community-integrity-monitor";
import { PLACEHOLDER_GROUP_NAME } from "./community-ledger-validator";
import type { CommunityMembershipLedgerEntry } from "./community-membership-ledger";
import type { GroupConversation } from "@/app/features/messaging/types";

describe("community-integrity-monitor", () => {
  const publicKeyHex = "test-pubkey-123";

  const validLedgerEntry: CommunityMembershipLedgerEntry = {
    groupId: "test-group",
    publicKeyHex,
    status: "joined",
    displayName: "Test Group",
    memberPubkeys: ["member1", "member2"],
    adminPubkeys: ["member1"],
    ledgerVersion: 2,
    createdAt: 1000000,
    updatedAt: 1000000,
  };

  const validPersistedGroup: GroupConversation = {
    kind: "group",
    id: "test-group@@wss://relay.example/",
    communityId: "community-123",
    groupId: "test-group",
    relayUrl: "wss://relay.example/",
    displayName: "Test Group",
    memberPubkeys: ["member1", "member2"],
    adminPubkeys: ["member1"],
    memberCount: 2,
    access: "open",
    lastMessage: "Hello",
    unreadCount: 0,
    lastMessageTime: new Date(1000000),
  } as GroupConversation;

  describe("checkGroupIntegrity", () => {
    it("should pass for valid complete data", () => {
      const result = checkGroupIntegrity(
        "test-group",
        validLedgerEntry,
        validPersistedGroup,
        { checkPersisted: true }
      );
      expect(result.passed).toBe(true);
      expect(result.severity).toBe("ok");
    });

    it("should fail for missing ledger entry", () => {
      const result = checkGroupIntegrity("test-group", undefined, validPersistedGroup);
      expect(result.passed).toBe(false);
      expect(result.severity).toBe("critical");
      expect(result.checks.ledgerEntryExists).toBe(false);
      expect(result.discrepancies.some(d => d.includes("No ledger entry"))).toBe(true);
    });

    it("should fail for empty member list", () => {
      const entry = { ...validLedgerEntry, memberPubkeys: [] };
      const result = checkGroupIntegrity("test-group", entry, undefined);
      expect(result.passed).toBe(false);
      expect(result.severity).toBe("critical");
      expect(result.checks.memberListNonEmpty).toBe(false);
    });

    it("should fail for undefined member list", () => {
      const entry = { ...validLedgerEntry, memberPubkeys: undefined as any };
      const result = checkGroupIntegrity("test-group", entry, undefined);
      expect(result.passed).toBe(false);
      expect(result.checks.memberListNonEmpty).toBe(false);
    });

    it("should fail for placeholder display name", () => {
      const entry = { ...validLedgerEntry, displayName: PLACEHOLDER_GROUP_NAME };
      const result = checkGroupIntegrity("test-group", entry, validPersistedGroup);
      expect(result.passed).toBe(false);
      expect(result.severity).toBe("warning");
      expect(result.checks.displayNameValid).toBe(false);
      expect(result.discrepancies.some(d => d.includes("placeholder"))).toBe(true);
    });

    it("should fail for missing display name", () => {
      const entry = { ...validLedgerEntry, displayName: "" };
      const result = checkGroupIntegrity("test-group", entry, validPersistedGroup);
      expect(result.passed).toBe(false);
      expect(result.checks.displayNameValid).toBe(false);
    });

    it("should fail for admin not in member list", () => {
      const entry = { ...validLedgerEntry, adminPubkeys: ["not-a-member"] };
      const result = checkGroupIntegrity("test-group", entry, validPersistedGroup);
      expect(result.passed).toBe(false);
      expect(result.checks.adminInMemberList).toBe(false);
      expect(result.discrepancies.some(d => d.includes("Admins not in member list"))).toBe(true);
    });

    it("should fail for missing ledgerVersion", () => {
      const entry = { ...validLedgerEntry, ledgerVersion: undefined as any };
      const result = checkGroupIntegrity("test-group", entry, validPersistedGroup);
      expect(result.passed).toBe(false);
      expect(result.severity).toBe("warning");
      expect(result.checks.schemaVersionValid).toBe(false);
    });

    it("should detect mismatched member lists when checkPersisted is true", () => {
      const persisted = { ...validPersistedGroup, memberPubkeys: ["member1", "member2", "member3"] };
      const result = checkGroupIntegrity("test-group", validLedgerEntry, persisted, {
        checkPersisted: true,
      });
      expect(result.discrepancies.some(d => d.includes("Members in persisted data but not ledger"))).toBe(true);
    });

    it("should fallback to persisted data when ledger has no member list", () => {
      const entry = { ...validLedgerEntry, memberPubkeys: undefined as any };
      const result = checkGroupIntegrity("test-group", entry, validPersistedGroup, {
        checkPersisted: true,
      });
      expect(result.checks.memberListNonEmpty).toBe(true); // Uses persisted data
    });

    it("should return correct groupId", () => {
      const result = checkGroupIntegrity("test-group", validLedgerEntry, validPersistedGroup);
      expect(result.groupId).toBe("test-group");
    });
  });

  describe("checkAllGroupsIntegrity", () => {
    it("should check all groups", () => {
      const groups = [
        validPersistedGroup,
        { ...validPersistedGroup, groupId: "group-2" },
        { ...validPersistedGroup, groupId: "group-3" },
      ];

      const entries = [
        validLedgerEntry,
        { ...validLedgerEntry, groupId: "group-2" },
        { ...validLedgerEntry, groupId: "group-3", memberPubkeys: [] },
      ];

      const result = checkAllGroupsIntegrity(groups, entries);
      expect(result.total).toBe(3);
      expect(result.passed).toBe(2);
      expect(result.failed).toBe(1);
    });

    it("should count critical issues", () => {
      const groups = [validPersistedGroup];
      const entries = [{ ...validLedgerEntry, memberPubkeys: [] }];

      const result = checkAllGroupsIntegrity(groups, entries);
      expect(result.critical).toBe(1);
      expect(result.warning).toBe(0);
    });

    it("should count warning issues", () => {
      const groups = [validPersistedGroup];
      const entries = [{ ...validLedgerEntry, ledgerVersion: undefined as any }];

      const result = checkAllGroupsIntegrity(groups, entries);
      expect(result.critical).toBe(0);
      expect(result.warning).toBe(1);
    });

    it("should include per-result details", () => {
      const groups = [validPersistedGroup];
      const entries = [validLedgerEntry];

      const result = checkAllGroupsIntegrity(groups, entries);
      expect(result.results).toHaveLength(1);
      expect(result.results[0].passed).toBe(true);
    });
  });

  describe("attemptGroupRepair", () => {
    it("should create ledger entry from persisted group", () => {
      const result = attemptGroupRepair("test-group", undefined, validPersistedGroup, publicKeyHex);
      expect(result.success).toBe(true);
      expect(result.newEntry).toBeDefined();
      expect(result.newEntry?.groupId).toBe("test-group");
      expect(result.newEntry?.memberPubkeys).toEqual(validPersistedGroup.memberPubkeys);
      expect(result.actions).toContain("Created ledger entry from persisted group");
    });

    it("should repair empty member list from persisted", () => {
      const entry = { ...validLedgerEntry, memberPubkeys: [] };
      const persisted = { ...validPersistedGroup, memberPubkeys: ["repaired1", "repaired2"] };

      const result = attemptGroupRepair("test-group", entry, persisted, publicKeyHex);
      expect(result.success).toBe(true);
      expect(result.newEntry?.memberPubkeys).toContain("repaired1");
      expect(result.actions).toContain("Repaired empty member list");
    });

    it("should repair placeholder display name from persisted", () => {
      const entry = { ...validLedgerEntry, displayName: PLACEHOLDER_GROUP_NAME };
      const persisted = { ...validPersistedGroup, displayName: "Repaired Name" };

      const result = attemptGroupRepair("test-group", entry, persisted, publicKeyHex);
      expect(result.success).toBe(true);
      expect(result.newEntry?.displayName).toBe("Repaired Name");
      expect(result.actions).toContain("Restored display name from persisted group");
    });

    it("should add missing ledgerVersion", () => {
      const entry = { ...validLedgerEntry, ledgerVersion: undefined as any };

      const result = attemptGroupRepair("test-group", entry, validPersistedGroup, publicKeyHex);
      expect(result.success).toBe(true);
      expect(result.newEntry?.ledgerVersion).toBe(2);
      expect(result.actions).toContain("Added ledgerVersion");
    });

    it("should fallback to publicKeyHex for member list when no persisted data", () => {
      const entry = { ...validLedgerEntry, memberPubkeys: [] };

      const result = attemptGroupRepair("test-group", entry, undefined, publicKeyHex);
      expect(result.success).toBe(true);
      expect(result.newEntry?.memberPubkeys).toContain(publicKeyHex);
    });

    it("should return failure when no repairable issues", () => {
      const result = attemptGroupRepair("test-group", validLedgerEntry, validPersistedGroup, publicKeyHex);
      expect(result.success).toBe(false);
      expect(result.actions).toContain("No repairable issues found");
    });

    it("should update updatedAt timestamp when repairing", () => {
      const originalUpdatedAt = 1000000;
      const entry = { ...validLedgerEntry, updatedAt: originalUpdatedAt, memberPubkeys: [] };

      const result = attemptGroupRepair("test-group", entry, validPersistedGroup, publicKeyHex);
      expect(result.newEntry?.updatedAt).toBeGreaterThan(originalUpdatedAt);
    });
  });
});
