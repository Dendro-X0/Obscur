import { describe, expect, it } from "vitest";
import { resolveCommunityDirectoryMaterializationHonesty } from "./community-directory-materialization-policy";

describe("community-directory-materialization-policy", () => {
    it("does not claim authoritative directory on public default relays", () => {
        const honesty = resolveCommunityDirectoryMaterializationHonesty({
            communityMode: "managed_workspace",
            relayCapabilityTier: "public_default",
        });
        expect(honesty.claimsAuthoritativeDirectory).toBe(false);
        expect(honesty.summary).toContain("not available");
    });

    it("allows authoritative directory claims on managed intranet tier", () => {
        const honesty = resolveCommunityDirectoryMaterializationHonesty({
            communityMode: "managed_workspace",
            relayCapabilityTier: "managed_intranet",
        });
        expect(honesty.claimsAuthoritativeDirectory).toBe(true);
    });

    it("keeps sovereign public tier honest about best-effort discovery", () => {
        const honesty = resolveCommunityDirectoryMaterializationHonesty({
            communityMode: "sovereign_room",
            relayCapabilityTier: "public_default",
        });
        expect(honesty.claimsAuthoritativeDirectory).toBe(false);
        expect(honesty.summary).toContain("Best-effort");
    });
});
