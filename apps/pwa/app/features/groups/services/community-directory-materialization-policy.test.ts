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

    it("mentions coordination directory when coordination_preferred on public relays", () => {
        const honesty = resolveCommunityDirectoryMaterializationHonesty({
            communityMode: "sovereign_room",
            relayCapabilityTier: "public_default",
            membershipSyncMode: "coordination_preferred",
        });
        expect(honesty.claimsAuthoritativeDirectory).toBe(false);
        expect(honesty.summary).toContain("Coordination");
        expect(honesty.detail).toContain("coordination");
    });

    it("claims coordination directory for managed workspace on intranet when coordination_preferred", () => {
        const honesty = resolveCommunityDirectoryMaterializationHonesty({
            communityMode: "managed_workspace",
            relayCapabilityTier: "managed_intranet",
            membershipSyncMode: "coordination_preferred",
        });
        expect(honesty.claimsAuthoritativeDirectory).toBe(true);
        expect(honesty.summary).toContain("Coordination");
        expect(honesty.detail).toContain("coordination directory");
    });
});
