import { beforeEach, describe, expect, it, vi } from "vitest";
import {
    isCoordinationGateSatisfied,
    isCoordinationOnlyWorkspaceDevMode,
    isPathBWorkspaceDevEscapeAllowed,
    writeAssumeLocalCoordinationReachable,
    writeCoordinationOnlyWorkspaceDevModeOverride,
} from "./community-dev-flags";
import { assessWorkspaceCommunityTrust } from "./community-trust-policy";

vi.mock("./community-membership-sync-mode", () => ({
    isCoordinationConfigured: () => true,
}));

describe("Path B Band B0 workspace gates", () => {
    beforeEach(() => {
        localStorage.clear();
        vi.stubEnv("NEXT_PUBLIC_COORDINATION_URL", "http://127.0.0.1:8787");
        vi.stubEnv("NEXT_PUBLIC_DEV_COORDINATION_ONLY_WORKSPACE", "");
        vi.stubEnv("NEXT_PUBLIC_OBSCUR_ALLOW_WORKSPACE_DEV_ESCAPES", "");
        vi.stubEnv("NODE_ENV", "test");
    });

    describe("production-strict (no dev escapes)", () => {
        beforeEach(() => {
            vi.stubEnv("NODE_ENV", "production");
        });

        it("isPathBWorkspaceDevEscapeAllowed is false in production without explicit opt-in", () => {
            expect(isPathBWorkspaceDevEscapeAllowed()).toBe(false);
        });

        it("isCoordinationGateSatisfied requires probedHealthy === true", () => {
            expect(isCoordinationGateSatisfied(true)).toBe(true);
            expect(isCoordinationGateSatisfied(false)).toBe(false);
            expect(isCoordinationGateSatisfied(null)).toBe(false);
        });

        it("ignores assume-local localStorage in production", () => {
            writeAssumeLocalCoordinationReachable(true);
            expect(isCoordinationGateSatisfied(false)).toBe(false);
        });

        it("ignores coordination-only env in production", () => {
            vi.stubEnv("NEXT_PUBLIC_DEV_COORDINATION_ONLY_WORKSPACE", "true");
            expect(isCoordinationOnlyWorkspaceDevMode()).toBe(false);
            expect(isCoordinationGateSatisfied(false)).toBe(false);
        });

        it("blocks workspace create when coordination probe failed", () => {
            const result = assessWorkspaceCommunityTrust({
                communityRelayUrl: "wss://relay.team.internal",
                enabledRelayUrls: ["wss://relay.team.internal"],
                coordinationHealthy: false,
            });
            expect(result.allowed).toBe(false);
            expect(result.reasonCode).toBe("coordination_unreachable");
        });

        it("blocks workspace create while coordination probe is pending", () => {
            const result = assessWorkspaceCommunityTrust({
                communityRelayUrl: "wss://relay.team.internal",
                enabledRelayUrls: ["wss://relay.team.internal"],
            });
            expect(result.allowed).toBe(false);
            expect(result.reasonCode).toBe("coordination_unreachable");
        });

        it("blocks public_default relay tier for managed_workspace", () => {
            const result = assessWorkspaceCommunityTrust({
                communityRelayUrl: "wss://nos.lol",
                coordinationHealthy: true,
            });
            expect(result.allowed).toBe(false);
            expect(result.reasonCode).toBe("public_relay_blocked");
        });
    });

    describe("development escapes (K-M1/K-M2 local matrix)", () => {
        it("allows assume-local when probe failed in non-production", () => {
            writeAssumeLocalCoordinationReachable(true);
            expect(isCoordinationGateSatisfied(false)).toBe(true);
        });

        it("allows coordination-only dev mode without writable relay", () => {
            vi.stubEnv("NEXT_PUBLIC_DEV_COORDINATION_ONLY_WORKSPACE", "true");
            const result = assessWorkspaceCommunityTrust({
                communityRelayUrl: "wss://relay.internal",
                coordinationHealthy: true,
            });
            expect(result.allowed).toBe(true);
        });
    });
});
