import { describe, expect, it } from "vitest";
import { deriveCommunityId, toCommunityConversationId } from "./community-identity";

describe("community-identity", () => {
    it("keeps existing community id when present", () => {
        const communityId = deriveCommunityId({
            existingCommunityId: "existing-id",
            groupId: "alpha",
            relayUrl: "wss://relay.one",
            genesisEventId: "genesis",
            creatorPubkey: "creator"
        });
        expect(communityId).toBe("existing-id");
    });

    it("derives deterministic hashed v2 id from genesis and creator", () => {
        const left = deriveCommunityId({
            groupId: "alpha",
            relayUrl: "wss://relay.one",
            genesisEventId: "genesis-123",
            creatorPubkey: "creator-456"
        });
        const right = deriveCommunityId({
            groupId: "beta",
            relayUrl: "wss://relay.two",
            genesisEventId: "genesis-123",
            creatorPubkey: "creator-456"
        });
        expect(left).toBe(right);
        expect(left).toMatch(/^v2_[0-9a-f]{64}$/);
    });

    it("falls back to legacy relay-scoped identity", () => {
        expect(deriveCommunityId({ groupId: "alpha", relayUrl: "wss://relay.one" })).toBe("alpha:wss://relay.one");
        expect(deriveCommunityId({ groupId: "alpha", relayUrl: "" })).toBe("alpha:unknown");
    });

    it("builds canonical conversation id from community id", () => {
        expect(toCommunityConversationId("abc123")).toBe("community:abc123");
    });
});

