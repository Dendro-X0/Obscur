import { beforeEach, describe, expect, it, vi } from "vitest";
import { partitionInviteRelayHints } from "./community-invite-redemption-policy";

describe("partitionInviteRelayHints", () => {
    beforeEach(() => {
        vi.stubEnv("NEXT_PUBLIC_COORDINATION_URL", "http://127.0.0.1:8787");
    });

    it("accepts private workspace relay when coordination is healthy", () => {
        const result = partitionInviteRelayHints({
            relayUrls: ["ws://localhost:7000"],
            coordinationHealthy: true,
        });
        expect(result.workspaceRelayUrls).toEqual(["ws://localhost:7000"]);
        expect(result.rejected).toHaveLength(0);
    });

    it("routes public default relays to DM hints only", () => {
        const result = partitionInviteRelayHints({
            relayUrls: ["wss://nos.lol"],
            coordinationHealthy: true,
        });
        expect(result.dmRelayUrls).toEqual(["wss://nos.lol"]);
        expect(result.workspaceRelayUrls).toHaveLength(0);
        expect(result.rejected).toHaveLength(0);
    });

    it("rejects workspace candidate when coordination is down", () => {
        const result = partitionInviteRelayHints({
            relayUrls: ["ws://localhost:7000"],
            coordinationHealthy: false,
        });
        expect(result.workspaceRelayUrls).toHaveLength(0);
        expect(result.rejected.length).toBeGreaterThan(0);
    });
});
