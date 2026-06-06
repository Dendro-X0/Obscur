import { beforeEach, describe, expect, it, vi } from "vitest";
import {
    isCoordinationGateSatisfied,
    isCoordinationOnlyWorkspaceDevMode,
    isPathBWorkspaceDevEscapeAllowed,
    readCoordinationOnlyWorkspaceDevModeOverride,
    writeAssumeLocalCoordinationReachable,
    writeCoordinationOnlyWorkspaceDevModeOverride,
} from "./community-dev-flags";

describe("community-dev-flags", () => {
    beforeEach(() => {
        localStorage.clear();
        vi.stubEnv("NEXT_PUBLIC_DEV_COORDINATION_ONLY_WORKSPACE", "");
    });

    it("reads runtime override without rebuild", () => {
        writeCoordinationOnlyWorkspaceDevModeOverride(true);
        expect(readCoordinationOnlyWorkspaceDevModeOverride()).toBe(true);
        expect(isCoordinationOnlyWorkspaceDevMode()).toBe(true);
    });

    it("isCoordinationGateSatisfied when probe failed but assume-local is set", () => {
        vi.stubEnv("NEXT_PUBLIC_COORDINATION_URL", "http://127.0.0.1:8787");
        writeCoordinationOnlyWorkspaceDevModeOverride(true);
        writeAssumeLocalCoordinationReachable(true);
        expect(isCoordinationGateSatisfied(false)).toBe(true);
    });

    it("isCoordinationGateSatisfied with assume-local only (no coordination-only dev mode)", () => {
        vi.stubEnv("NEXT_PUBLIC_COORDINATION_URL", "http://127.0.0.1:8787");
        writeAssumeLocalCoordinationReachable(true);
        expect(isCoordinationOnlyWorkspaceDevMode()).toBe(false);
        expect(isCoordinationGateSatisfied(false)).toBe(true);
    });

    it("isCoordinationGateSatisfied when coordination-only env and probe failed", () => {
        vi.stubEnv("NEXT_PUBLIC_COORDINATION_URL", "http://127.0.0.1:8787");
        vi.stubEnv("NEXT_PUBLIC_DEV_COORDINATION_ONLY_WORKSPACE", "true");
        expect(isCoordinationGateSatisfied(false)).toBe(true);
    });

    it("isCoordinationGateSatisfied false when probe failed and not dev", () => {
        vi.stubEnv("NEXT_PUBLIC_COORDINATION_URL", "http://127.0.0.1:8787");
        expect(isCoordinationGateSatisfied(false)).toBe(false);
    });

    it("isCoordinationGateSatisfied false when probe pending in production", () => {
        vi.stubEnv("NODE_ENV", "production");
        vi.stubEnv("NEXT_PUBLIC_COORDINATION_URL", "http://127.0.0.1:8787");
        expect(isCoordinationGateSatisfied(null)).toBe(false);
    });

    it("isPathBWorkspaceDevEscapeAllowed true in non-production", () => {
        vi.stubEnv("NODE_ENV", "test");
        expect(isPathBWorkspaceDevEscapeAllowed()).toBe(true);
    });
});
