import { describe, it, expect } from "vitest";
import {
  parseLeaveProofSnapshot,
  buildLeaveProofKeySet,
  mergeLeaveProofEntries,
  addLeaveProofEntry,
  removeLeaveProofEntry,
  buildLeaveProofSnapshot,
  buildLeaveProofUnsignedEvent,
  COMMUNITY_LEAVE_PROOF_EVENT_KIND,
  COMMUNITY_LEAVE_PROOF_D_TAG,
  type CommunityLeaveProofEntry,
} from "./community-leave-proof-service";

describe("community-leave-proof-service", () => {
  const entry1: CommunityLeaveProofEntry = {
    groupId: "group-abc",
    relayUrl: "wss://nos.lol",
    leftAtUnixMs: 1700000000000,
  };

  const entry2: CommunityLeaveProofEntry = {
    groupId: "group-xyz",
    relayUrl: "wss://relay.damus.io",
    leftAtUnixMs: 1700001000000,
  };

  describe("parseLeaveProofSnapshot", () => {
    it("parses a valid snapshot", () => {
      const raw = {
        version: 1,
        entries: [entry1, entry2],
        updatedAtUnixMs: 1700002000000,
      };
      const result = parseLeaveProofSnapshot(raw);
      expect(result).not.toBeNull();
      expect(result!.version).toBe(1);
      expect(result!.entries).toHaveLength(2);
      expect(result!.entries[0].groupId).toBe("group-abc");
    });

    it("returns null for invalid input", () => {
      expect(parseLeaveProofSnapshot(null)).toBeNull();
      expect(parseLeaveProofSnapshot("string")).toBeNull();
      expect(parseLeaveProofSnapshot({ version: 2 })).toBeNull();
      expect(parseLeaveProofSnapshot({ version: 1, entries: "not-array", updatedAtUnixMs: 0 })).toBeNull();
    });

    it("filters out invalid entries", () => {
      const raw = {
        version: 1,
        entries: [entry1, { groupId: 123, relayUrl: "wss://x", leftAtUnixMs: 0 }, entry2],
        updatedAtUnixMs: 1700002000000,
      };
      const result = parseLeaveProofSnapshot(raw);
      expect(result!.entries).toHaveLength(2);
    });
  });

  describe("buildLeaveProofKeySet", () => {
    it("builds a set of keys from entries", () => {
      const keys = buildLeaveProofKeySet([entry1, entry2]);
      expect(keys.size).toBe(2);
      expect(keys.has("group-abc@@wss://nos.lol")).toBe(true);
      expect(keys.has("group-xyz@@wss://relay.damus.io")).toBe(true);
    });

    it("returns empty set for empty entries", () => {
      const keys = buildLeaveProofKeySet([]);
      expect(keys.size).toBe(0);
    });
  });

  describe("mergeLeaveProofEntries", () => {
    it("unions entries from two lists", () => {
      const merged = mergeLeaveProofEntries([entry1], [entry2]);
      expect(merged).toHaveLength(2);
    });

    it("keeps the newest entry when keys overlap", () => {
      const older = { ...entry1, leftAtUnixMs: 1700000000000 };
      const newer = { ...entry1, leftAtUnixMs: 1700001000000 };
      const merged = mergeLeaveProofEntries([older], [newer]);
      expect(merged).toHaveLength(1);
      expect(merged[0].leftAtUnixMs).toBe(1700001000000);
    });

    it("keeps local when local is newer", () => {
      const local = { ...entry1, leftAtUnixMs: 1700002000000 };
      const remote = { ...entry1, leftAtUnixMs: 1700000000000 };
      const merged = mergeLeaveProofEntries([local], [remote]);
      expect(merged).toHaveLength(1);
      expect(merged[0].leftAtUnixMs).toBe(1700002000000);
    });
  });

  describe("addLeaveProofEntry", () => {
    it("adds a new entry", () => {
      const result = addLeaveProofEntry([], { groupId: "g1", relayUrl: "wss://r1" });
      expect(result).toHaveLength(1);
      expect(result[0].groupId).toBe("g1");
      expect(result[0].leftAtUnixMs).toBeGreaterThan(0);
    });

    it("updates an existing entry with a newer timestamp", () => {
      const existing: CommunityLeaveProofEntry[] = [
        { groupId: "g1", relayUrl: "wss://r1", leftAtUnixMs: 1000 },
      ];
      const result = addLeaveProofEntry(existing, {
        groupId: "g1",
        relayUrl: "wss://r1",
        leftAtUnixMs: 2000,
      });
      expect(result).toHaveLength(1);
      expect(result[0].leftAtUnixMs).toBe(2000);
    });

    it("does not overwrite with an older timestamp", () => {
      const existing: CommunityLeaveProofEntry[] = [
        { groupId: "g1", relayUrl: "wss://r1", leftAtUnixMs: 2000 },
      ];
      const result = addLeaveProofEntry(existing, {
        groupId: "g1",
        relayUrl: "wss://r1",
        leftAtUnixMs: 1000,
      });
      expect(result).toHaveLength(1);
      expect(result[0].leftAtUnixMs).toBe(2000);
    });
  });

  describe("removeLeaveProofEntry", () => {
    it("removes an entry by key", () => {
      const result = removeLeaveProofEntry([entry1, entry2], {
        groupId: entry1.groupId,
        relayUrl: entry1.relayUrl,
      });
      expect(result).toHaveLength(1);
      expect(result[0].groupId).toBe("group-xyz");
    });

    it("returns unchanged array when key not found", () => {
      const result = removeLeaveProofEntry([entry1], {
        groupId: "nonexistent",
        relayUrl: "wss://x",
      });
      expect(result).toHaveLength(1);
    });
  });

  describe("buildLeaveProofSnapshot", () => {
    it("creates a snapshot with version 1", () => {
      const snapshot = buildLeaveProofSnapshot([entry1, entry2]);
      expect(snapshot.version).toBe(1);
      expect(snapshot.entries).toHaveLength(2);
      expect(snapshot.updatedAtUnixMs).toBeGreaterThan(0);
    });
  });

  describe("buildLeaveProofUnsignedEvent", () => {
    it("creates an event with correct kind and d-tag", () => {
      const event = buildLeaveProofUnsignedEvent({
        ciphertext: "encrypted-content",
        publicKeyHex: "abc123" as unknown as import("@dweb/crypto/public-key-hex").PublicKeyHex,
      });
      expect(event.kind).toBe(COMMUNITY_LEAVE_PROOF_EVENT_KIND);
      expect(event.tags).toEqual([["d", COMMUNITY_LEAVE_PROOF_D_TAG]]);
      expect(event.content).toBe("encrypted-content");
      expect(event.pubkey).toBe("abc123");
      expect(event.created_at).toBeGreaterThan(0);
    });

    it("uses Kind 30078 (NIP-78 replaceable)", () => {
      expect(COMMUNITY_LEAVE_PROOF_EVENT_KIND).toBe(30078);
    });

    it("uses a distinct d-tag from account backup", () => {
      expect(COMMUNITY_LEAVE_PROOF_D_TAG).toBe("obscur-community-leave-proofs");
      expect(COMMUNITY_LEAVE_PROOF_D_TAG).not.toBe("obscur-account-backup");
    });
  });
});
