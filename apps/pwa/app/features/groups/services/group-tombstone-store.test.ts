import { beforeEach, describe, expect, it } from "vitest";
import {
    addGroupTombstone,
    addGroupTombstoneFromConversationId,
    isGroupTombstoned,
    loadGroupTombstones,
    removeGroupTombstone,
    toGroupTombstoneKey
} from "./group-tombstone-store";

const PK = "pk_test_tombstones";

describe("group-tombstone-store", () => {
    beforeEach(() => {
        localStorage.clear();
    });

    it("stores and removes tombstones by group identity key", () => {
        expect(isGroupTombstoned(PK, { groupId: "g1", relayUrl: "wss://relay.one" })).toBe(false);

        addGroupTombstone(PK, { groupId: "g1", relayUrl: "wss://relay.one" });
        expect(isGroupTombstoned(PK, { groupId: "g1", relayUrl: "wss://relay.one" })).toBe(true);

        removeGroupTombstone(PK, { groupId: "g1", relayUrl: "wss://relay.one" });
        expect(isGroupTombstoned(PK, { groupId: "g1", relayUrl: "wss://relay.one" })).toBe(false);
    });

    it("parses canonical conversation ids when tombstoning", () => {
        addGroupTombstoneFromConversationId(PK, "community:alpha:wss://relay.alpha");
        expect(isGroupTombstoned(PK, { groupId: "alpha", relayUrl: "wss://relay.alpha" })).toBe(true);
    });

    it("parses legacy conversation ids when tombstoning", () => {
        addGroupTombstoneFromConversationId(PK, "beta@relay.beta");
        expect(isGroupTombstoned(PK, { groupId: "beta", relayUrl: "wss://relay.beta" })).toBe(true);
    });

    it("normalizes empty relay to unknown key", () => {
        expect(toGroupTombstoneKey({ groupId: "x", relayUrl: "" })).toBe("x@@unknown");
    });

    it("loads all stored tombstones", () => {
        addGroupTombstone(PK, { groupId: "g1", relayUrl: "wss://relay.one" });
        addGroupTombstone(PK, { groupId: "g2", relayUrl: "wss://relay.two" });
        const all = loadGroupTombstones(PK);
        expect(all.size).toBe(2);
    });
});
