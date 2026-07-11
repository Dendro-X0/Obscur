import { describe, expect, it, vi } from "vitest";
import { publishDmNostrEvent, resolveCommunityInviteDmPublishRelayUrls } from "./publish-dm-nostr-event";

describe("publishDmNostrEvent", () => {
    it("prefers DM-scoped publishToUrls over publishToAll", async () => {
        const publishToUrls = vi.fn(async () => ({
            success: true,
            successCount: 1,
            totalRelays: 1,
        }));
        const publishToAll = vi.fn();
        const event = { id: "evt-1" } as never;
        await publishDmNostrEvent(
            { publishToUrls, publishToAll },
            ["wss://relay.example"],
            event,
        );
        expect(publishToUrls).toHaveBeenCalledWith(
            ["wss://relay.example"],
            JSON.stringify(["EVENT", event]),
        );
        expect(publishToAll).not.toHaveBeenCalled();
    });

    it("falls back to publishToAll when no DM relays are configured", async () => {
        const publishToAll = vi.fn(async () => ({
            success: true,
            successCount: 2,
            totalRelays: 2,
        }));
        const event = { id: "evt-2" } as never;
        await publishDmNostrEvent({ publishToAll }, [], event);
        expect(publishToAll).toHaveBeenCalledTimes(1);
    });

    it("resolveCommunityInviteDmPublishRelayUrls prepends workspace relay when missing from DM scope", () => {
        expect(resolveCommunityInviteDmPublishRelayUrls(
            ["wss://relay.example"],
            "ws://localhost:7000",
        )).toEqual(["ws://localhost:7000", "wss://relay.example"]);
    });

    it("resolveCommunityInviteDmPublishRelayUrls dedupes workspace relay already in DM scope", () => {
        expect(resolveCommunityInviteDmPublishRelayUrls(
            ["ws://localhost:7000", "wss://relay.example"],
            "ws://127.0.0.1:7000",
        )).toEqual(["ws://localhost:7000", "wss://relay.example"]);
    });
});
