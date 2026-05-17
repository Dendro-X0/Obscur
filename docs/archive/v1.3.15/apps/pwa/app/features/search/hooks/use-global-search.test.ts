import { describe, it, expect } from "vitest";
import { globalSearchInternals } from "./use-global-search";

describe("globalSearchInternals", () => {
    it("matches query against core profile fields", () => {
        const content = {
            name: "Alice",
            display_name: "Alice Doe",
            about: "Find me with code OBSCUR-RW8NXD",
            nip05: "alice@example.com",
        };
        expect(globalSearchInternals.profileMatchesQuery("alice", content, "f".repeat(64))).toBe(true);
        expect(globalSearchInternals.profileMatchesQuery("RW8NXD", content, "f".repeat(64))).toBe(true);
        expect(globalSearchInternals.profileMatchesQuery("example.com", content, "f".repeat(64))).toBe(true);
        expect(globalSearchInternals.profileMatchesQuery("nomatch", content, "f".repeat(64))).toBe(false);
    });

    it("builds search filters with NIP-50 and fallback recent scan", () => {
        const filters = globalSearchInternals.buildGlobalSearchFilters("OBSCUR-RW8NXD");
        expect(filters).toHaveLength(2);
        expect(filters[0]).toMatchObject({ kinds: [0], search: "OBSCUR-RW8NXD" });
        expect(filters[1]).toMatchObject({ kinds: [0], limit: 400 });
        expect(typeof filters[1]?.since).toBe("number");
    });
});
