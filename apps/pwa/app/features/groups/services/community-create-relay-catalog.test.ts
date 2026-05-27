import { describe, expect, it } from "vitest";
import {
    pickDefaultCommunityCreateRelayHost,
    resolveCommunityCreateRelayOptions,
} from "./community-create-relay-catalog";

describe("resolveCommunityCreateRelayOptions", () => {
    it("omits public default relays from workspace create catalog", () => {
        const options = resolveCommunityCreateRelayOptions({
            relays: [{ url: "wss://nos.lol", enabled: true }],
            connections: [{ url: "wss://nos.lol", status: "open", updatedAtUnixMs: Date.now() }],
            forManagedWorkspace: true,
        });
        expect(options).toHaveLength(0);
    });

    it("prefers a healthy private relay as default", () => {
        const options = resolveCommunityCreateRelayOptions({
            relays: [
                { url: "ws://localhost:7000", enabled: true },
                { url: "wss://nos.lol", enabled: true },
            ],
            connections: [
                { url: "ws://localhost:7000", status: "open", updatedAtUnixMs: Date.now() },
            ],
            activePoolRelayUrls: ["ws://localhost:7000"],
            forManagedWorkspace: true,
        });
        expect(options).toHaveLength(1);
        expect(pickDefaultCommunityCreateRelayHost(options)).toBe("localhost:7000");
    });

    it("disables relays that fail transport validation", () => {
        const options = resolveCommunityCreateRelayOptions({
            relays: [{ url: "wss://relay.internal", enabled: true }],
            connections: [],
            forManagedWorkspace: true,
        });
        expect(options[0]?.selectable).toBe(false);
    });
});
