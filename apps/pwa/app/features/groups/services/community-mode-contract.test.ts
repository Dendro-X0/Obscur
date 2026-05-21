import { describe, expect, it } from "vitest";
import {
    assessRelayCapability,
    getCommunityModeDefinition,
    isManagedWorkspaceRelayGateBlocking,
    resolveManagedWorkspaceRelayGate,
} from "./community-mode-contract";

describe("community-mode-contract", () => {
    it("keeps public default relays on sovereign-room guidance", () => {
        const assessment = assessRelayCapability({
            enabledRelayUrls: ["wss://relay.damus.io", "wss://nos.lol", "wss://relay.primal.net"],
            selectedRelayHost: "nos.lol",
        });

        expect(assessment.tier).toBe("public_default");
        expect(assessment.recommendedMode).toBe("sovereign_room");
        expect(assessment.supportsManagedWorkspace).toBe(false);
    });

    it("treats private relay hosts as managed-workspace candidates", () => {
        const assessment = assessRelayCapability({
            enabledRelayUrls: ["wss://relay.internal", "wss://chat.local"],
            selectedRelayHost: "relay.internal",
        });

        expect(assessment.tier).toBe("managed_intranet");
        expect(assessment.recommendedMode).toBe("managed_workspace");
        expect(assessment.supportsManagedWorkspace).toBe(true);
    });

    it("treats custom non-default relays as trusted-private candidates", () => {
        const assessment = assessRelayCapability({
            enabledRelayUrls: ["wss://relay.team.example", "wss://relay.damus.io"],
            selectedRelayHost: "relay.team.example",
        });

        expect(assessment.tier).toBe("trusted_private");
        expect(assessment.recommendedMode).toBe("sovereign_room");
        expect(assessment.supportsManagedWorkspace).toBe(true);
    });

    it("exposes the managed workspace guarantee copy", () => {
        const definition = getCommunityModeDefinition("managed_workspace");

        expect(definition.label).toBe("Managed Workspace");
        expect(definition.guarantees).toContain("Relay-backed directory candidate");
    });

    it("allows sovereign room communities regardless of relay tier", () => {
        const gate = resolveManagedWorkspaceRelayGate({
            communityMode: "sovereign_room",
            enabledRelayUrls: ["wss://nos.lol"],
            communityRelayUrl: "wss://nos.lol",
        });

        expect(gate.allowed).toBe(true);
        expect(gate.reasonCode).toBe("not_managed");
    });

    it("blocks managed workspace management on public-default relays", () => {
        const gate = resolveManagedWorkspaceRelayGate({
            communityMode: "managed_workspace",
            enabledRelayUrls: ["wss://nos.lol", "wss://relay.damus.io"],
            communityRelayUrl: "wss://nos.lol",
        });

        expect(gate.allowed).toBe(false);
        expect(gate.reasonCode).toBe("relay_tier_insufficient");
        expect(gate.userMessage).toContain("Managed Workspace");
    });

    it("allows managed workspace management on intranet relays", () => {
        const gate = resolveManagedWorkspaceRelayGate({
            communityMode: "managed_workspace",
            enabledRelayUrls: ["wss://relay.internal"],
            communityRelayUrl: "wss://relay.internal",
        });

        expect(gate.allowed).toBe(true);
        expect(gate.reasonCode).toBe("allowed");
    });

    it("isManagedWorkspaceRelayGateBlocking is false for sovereign communities", () => {
        const gate = resolveManagedWorkspaceRelayGate({
            communityMode: "sovereign_room",
            enabledRelayUrls: ["wss://nos.lol"],
        });
        expect(isManagedWorkspaceRelayGateBlocking(gate)).toBe(false);
    });

    it("isManagedWorkspaceRelayGateBlocking is true when managed tier is insufficient", () => {
        const gate = resolveManagedWorkspaceRelayGate({
            communityMode: "managed_workspace",
            enabledRelayUrls: ["wss://nos.lol"],
        });
        expect(isManagedWorkspaceRelayGateBlocking(gate)).toBe(true);
    });
});
