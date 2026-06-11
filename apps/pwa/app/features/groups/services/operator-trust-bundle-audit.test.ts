import { beforeEach, describe, expect, it, vi } from "vitest";
import {
    auditOperatorTrustBundle,
    isValidCoordinationBundleUrl,
    isValidWorkspaceRelayBundleUrl,
    OPERATOR_TRUST_ALLOWED_WORKSPACE_RELAY_TIERS,
    readOperatorTrustBundleSnapshot,
    resolveWorkspaceActionRelayUrl,
} from "./operator-trust-bundle-audit";
import {
    clearOperatorTrustConfig,
    writeOperatorCoordinationUrlOverride,
    writeOperatorWorkspaceRelayUrl,
} from "./operator-trust-config";

vi.mock("./community-membership-sync-mode", () => ({
    isCoordinationConfigured: () => true,
}));

describe("operator-trust-bundle-audit (SEC-R1)", () => {
    beforeEach(() => {
        localStorage.clear();
        clearOperatorTrustConfig();
        vi.stubEnv("NEXT_PUBLIC_COORDINATION_URL", "http://127.0.0.1:8787");
        vi.stubEnv("NEXT_PUBLIC_DEV_COORDINATION_ONLY_WORKSPACE", "");
    });

    it("documents allowed workspace relay tiers", () => {
        expect(OPERATOR_TRUST_ALLOWED_WORKSPACE_RELAY_TIERS).toEqual([
            "trusted_private",
            "managed_intranet",
        ]);
    });

    it("validates coordination and relay URL schemes", () => {
        expect(isValidCoordinationBundleUrl("http://127.0.0.1:8787")).toBe(true);
        expect(isValidCoordinationBundleUrl("ftp://127.0.0.1:8787")).toBe(false);
        expect(isValidWorkspaceRelayBundleUrl("ws://localhost:7000")).toBe(true);
        expect(isValidWorkspaceRelayBundleUrl("http://localhost:7000")).toBe(false);
    });

    it("reads operator bundle snapshot from runtime storage", () => {
        writeOperatorCoordinationUrlOverride("http://127.0.0.1:8787/");
        writeOperatorWorkspaceRelayUrl("ws://localhost:7000");
        const snapshot = readOperatorTrustBundleSnapshot();
        expect(snapshot.coordinationUrl).toBe("http://127.0.0.1:8787");
        expect(snapshot.workspaceRelayUrl).toBe("ws://localhost:7000");
        expect(snapshot.coordinationUrlValid).toBe(true);
        expect(snapshot.workspaceRelayUrlValid).toBe(true);
    });

    it("blocks audit when coordination URL scheme is invalid", () => {
        writeOperatorCoordinationUrlOverride("nostr://bad");
        const audit = auditOperatorTrustBundle({ coordinationHealthy: true });
        expect(audit.allowed).toBe(false);
        expect(audit.reasonCode).toBe("bundle_invalid_coordination_url");
    });

    it("blocks public-default relay tier at create/join audit", () => {
        writeOperatorWorkspaceRelayUrl("wss://nos.lol");
        const audit = auditOperatorTrustBundle({
            coordinationHealthy: true,
            enabledRelayUrls: ["wss://nos.lol"],
        });
        expect(audit.allowed).toBe(false);
        expect(audit.reasonCode).toBe("public_relay_blocked");
    });

    it("allows private intranet operator bundle when coordination is healthy", () => {
        writeOperatorWorkspaceRelayUrl("wss://relay.team.internal");
        const audit = auditOperatorTrustBundle({
            coordinationHealthy: true,
            enabledRelayUrls: ["wss://relay.team.internal"],
        });
        expect(audit.allowed).toBe(true);
        expect(audit.reasonCode).toBe("allowed");
    });

    it("prefers explicit relay URL over operator bundle default", () => {
        writeOperatorWorkspaceRelayUrl("ws://localhost:7000");
        expect(resolveWorkspaceActionRelayUrl({
            explicitRelayUrl: "wss://relay.team.internal",
        })).toBe("wss://relay.team.internal");
        expect(resolveWorkspaceActionRelayUrl({})).toBe("ws://localhost:7000");
    });
});
