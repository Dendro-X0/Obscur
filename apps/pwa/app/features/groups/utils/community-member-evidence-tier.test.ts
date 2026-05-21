import { describe, expect, it } from "vitest";
import { resolveCommunityMemberEvidenceTier } from "./community-member-evidence-tier";

describe("resolveCommunityMemberEvidenceTier", () => {
    it("prefers relay_confirmed when pubkey appears in active list", () => {
        expect(
            resolveCommunityMemberEvidenceTier("AbCdEf", {
                activeMemberPubkeys: ["abcdef"],
                provisionalMemberPubkeys: ["abcdef"],
            }),
        ).toBe("relay_confirmed");
    });

    it("returns provisional when only in provisional list", () => {
        expect(
            resolveCommunityMemberEvidenceTier("AAbbCC", {
                activeMemberPubkeys: [],
                provisionalMemberPubkeys: ["aabbcc"],
            }),
        ).toBe("provisional");
    });

    it("defaults to relay_confirmed when pubkey is in neither list", () => {
        expect(
            resolveCommunityMemberEvidenceTier("zzz", {
                activeMemberPubkeys: [],
                provisionalMemberPubkeys: [],
            }),
        ).toBe("relay_confirmed");
    });
});
