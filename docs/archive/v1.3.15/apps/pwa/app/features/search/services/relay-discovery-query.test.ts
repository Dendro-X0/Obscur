import { describe, it, expect } from "vitest";
import { relayDiscoveryQueryInternals } from "./relay-discovery-query";

describe("relayDiscoveryQueryInternals", () => {
    it("builds invite filters with indexable #i and fallback scan", () => {
        const filters = relayDiscoveryQueryInternals.buildFilters("invite", "OBSCUR-RW8NXD");
        expect(filters.length).toBeGreaterThanOrEqual(3);
        expect(filters[0]).toMatchObject({ kinds: [0], "#i": ["OBSCUR-RW8NXD"] });
        expect(filters.some((f) => typeof f.search === "string")).toBe(true);
        expect(filters.some((f) => typeof f.since === "number")).toBe(true);
    });

    it("builds direct author filters for pubkey lookups", () => {
        const pubkey = "a".repeat(64);
        const filters = relayDiscoveryQueryInternals.buildFilters("author", pubkey);
        expect(filters).toEqual([
            { kinds: [0], authors: [pubkey], limit: 1 },
        ]);
    });

    it("extracts profile record from kind-0 event content", () => {
        const record = relayDiscoveryQueryInternals.profileFromEvent({
            pubkey: "a".repeat(64),
            content: JSON.stringify({
                name: "Alice",
                display_name: "Alice Doe",
                about: "Find me on Obscur with this code: OBSCUR-RW8NXD",
                picture: "https://example.com/a.png",
                nip05: "alice@example.com",
            }),
            tags: [["i", "OBSCUR-RW8NXD"]],
        });
        expect(record?.pubkey).toBe("a".repeat(64));
        expect(record?.inviteCode).toBe("OBSCUR-RW8NXD");
    });

    it("extracts invite code from explicit JSON inviteCode fields", () => {
        const record = relayDiscoveryQueryInternals.profileFromEvent({
            pubkey: "b".repeat(64),
            content: JSON.stringify({
                name: "Bob",
                inviteCode: "obscur-azaj5l",
            }),
            tags: [],
        });
        expect(record?.pubkey).toBe("b".repeat(64));
        expect(record?.inviteCode).toBe("OBSCUR-AZAJ5L");
    });
});
