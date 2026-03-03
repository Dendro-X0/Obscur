import { describe, expect, it } from "vitest";
import type { NostrEvent } from "@dweb/nostr/nostr-event";
import { hasCommunityBindingTag, isScopedRelayEvent, normalizeRelayUrl } from "./use-sealed-community";

const baseEvent = (tags: string[][]): NostrEvent => ({
    id: "event-id",
    pubkey: "pubkey",
    created_at: 1,
    kind: 10105,
    sig: "sig",
    content: "{}",
    tags
});

describe("use-sealed-community security helpers", () => {
    it("normalizes relay URLs for strict scope comparison", () => {
        expect(normalizeRelayUrl("WSS://Relay.Example/")).toBe("wss://relay.example");
    });

    it("accepts event only when relay URL is in scope", () => {
        expect(isScopedRelayEvent({
            scopedRelayUrl: "wss://relay.example",
            eventRelayUrl: "WSS://relay.example/"
        })).toBe(true);
        expect(isScopedRelayEvent({
            scopedRelayUrl: "wss://relay.example",
            eventRelayUrl: "wss://other.example"
        })).toBe(false);
    });

    it("accepts community binding via h-tag", () => {
        const event = baseEvent([["h", "group-alpha"]]);
        expect(hasCommunityBindingTag({ event, groupId: "group-alpha" })).toBe(true);
    });

    it("accepts community binding via d-tag", () => {
        const event = baseEvent([["d", "group-alpha"]]);
        expect(hasCommunityBindingTag({ event, groupId: "group-alpha" })).toBe(true);
    });

    it("rejects events without matching community binding tag", () => {
        const missing = baseEvent([["e", "other"]]);
        const wrong = baseEvent([["h", "group-beta"], ["d", "group-beta"]]);
        expect(hasCommunityBindingTag({ event: missing, groupId: "group-alpha" })).toBe(false);
        expect(hasCommunityBindingTag({ event: wrong, groupId: "group-alpha" })).toBe(false);
    });
});
