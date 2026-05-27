import { beforeEach, describe, expect, it, vi } from "vitest";
import { assessWorkspaceCommunityTrust } from "./community-trust-policy";

vi.mock("./community-membership-sync-mode", () => ({
    isCoordinationConfigured: () => true,
}));

describe("assessWorkspaceCommunityTrust", () => {
    beforeEach(() => {
        vi.stubEnv("NEXT_PUBLIC_COORDINATION_URL", "http://127.0.0.1:8787");
        vi.stubEnv("NEXT_PUBLIC_DEV_COORDINATION_ONLY_WORKSPACE", "");
    });

    it("blocks public default relay hosts", () => {
        const result = assessWorkspaceCommunityTrust({
            communityRelayUrl: "wss://nos.lol",
            coordinationHealthy: true,
        });
        expect(result.allowed).toBe(false);
        expect(result.reasonCode).toBe("public_relay_blocked");
    });

    it("allows private intranet relay when coordination is healthy", () => {
        const result = assessWorkspaceCommunityTrust({
            communityRelayUrl: "wss://127.0.0.1:7777",
            coordinationHealthy: true,
        });
        expect(result.allowed).toBe(true);
        expect(result.reasonCode).toBe("allowed");
    });

    it("allows placeholder relay when coordination-only dev mode is enabled", () => {
        vi.stubEnv("NEXT_PUBLIC_DEV_COORDINATION_ONLY_WORKSPACE", "true");
        const result = assessWorkspaceCommunityTrust({
            communityRelayUrl: "wss://relay.internal",
            coordinationHealthy: true,
        });
        expect(result.allowed).toBe(true);
    });

    it("blocks placeholder relay hosts", () => {
        const result = assessWorkspaceCommunityTrust({
            communityRelayUrl: "wss://relay.internal",
            enabledRelayUrls: ["wss://relay.internal"],
            coordinationHealthy: true,
        });
        expect(result.allowed).toBe(false);
        expect(result.reasonCode).toBe("relay_unconfigured");
    });

    it("blocks when coordination is unreachable", () => {
        const result = assessWorkspaceCommunityTrust({
            communityRelayUrl: "wss://relay.team.internal",
            enabledRelayUrls: ["wss://relay.team.internal"],
            coordinationHealthy: false,
        });
        expect(result.allowed).toBe(false);
        expect(result.reasonCode).toBe("coordination_unreachable");
    });

    it("allows when maintainer assumes local coordination is reachable", async () => {
        const devFlags = await import("./community-dev-flags");
        devFlags.writeAssumeLocalCoordinationReachable(true);
        const result = assessWorkspaceCommunityTrust({
            communityRelayUrl: "wss://relay.team.internal",
            enabledRelayUrls: ["wss://relay.team.internal"],
            coordinationHealthy: false,
        });
        devFlags.writeAssumeLocalCoordinationReachable(false);
        expect(result.allowed).toBe(true);
        expect(result.reasonCode).toBe("allowed");
    });

    it("allows when coordination-only dev env and probe failed", () => {
        vi.stubEnv("NEXT_PUBLIC_DEV_COORDINATION_ONLY_WORKSPACE", "true");
        const result = assessWorkspaceCommunityTrust({
            communityRelayUrl: "wss://relay.internal",
            coordinationHealthy: false,
        });
        expect(result.allowed).toBe(true);
        expect(result.reasonCode).toBe("allowed");
    });
});
