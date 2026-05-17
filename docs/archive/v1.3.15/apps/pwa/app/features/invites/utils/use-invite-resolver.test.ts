import { describe, it, expect } from "vitest";
import { inviteResolverInternals } from "./use-invite-resolver";

describe("inviteResolverInternals", () => {
    it("matches invite codes from tags regardless of tag key", () => {
        const matched = inviteResolverInternals.hasInviteCodeTag(
            { tags: [["code", "OBSCUR-RW8NXD"], ["x", "foo"]] },
            "OBSCUR-RW8NXD"
        );
        expect(matched).toBe(true);
    });

    it("matches invite code found in about text", () => {
        const content = inviteResolverInternals.parseProfileContent(
            JSON.stringify({
                about: "Find me on Obscur with this code: obscur-rw8nxd",
            })
        );
        const matched = inviteResolverInternals.contentContainsInviteCode(content, "OBSCUR-RW8NXD");
        expect(matched).toBe(true);
    });

    it("returns false when code does not appear in tags or content", () => {
        const hasTag = inviteResolverInternals.hasInviteCodeTag(
            { tags: [["code", "OBSCUR-ABCDE"]] },
            "OBSCUR-RW8NXD"
        );
        const matched = inviteResolverInternals.contentContainsInviteCode(
            { about: "hello world" },
            "OBSCUR-RW8NXD"
        );
        expect(hasTag).toBe(false);
        expect(matched).toBe(false);
    });

    it("builds lookup filters with deterministic fallback scan", () => {
        const filters = inviteResolverInternals.buildInviteLookupFilters("OBSCUR-RW8NXD");
        expect(filters).toHaveLength(3);
        expect(filters[0]).toMatchObject({ kinds: [0], "#code": ["OBSCUR-RW8NXD"] });
        expect(filters[1]).toMatchObject({ kinds: [0], search: "OBSCUR-RW8NXD" });
        expect(filters[2]).toMatchObject({ kinds: [0], limit: 300 });
        expect(typeof filters[2]?.since).toBe("number");
    });
});
