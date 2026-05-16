import { createProfileMessageBus } from "@dweb/core/profile-message-bus";
import { describe, expect, it, vi } from "vitest";

describe("createProfileMessageBus (@dweb/core)", () => {
    it("delivers publish to subscribers", () => {
        const bus = createProfileMessageBus({ profileId: "p1" });
        const handler = vi.fn();
        bus.subscribe(handler);
        bus.publish({ type: "relay-connected", relayUrl: "wss://relay.example/nostr" });

        expect(handler).toHaveBeenCalledTimes(1);
        expect(handler).toHaveBeenCalledWith({
            type: "relay-connected",
            relayUrl: "wss://relay.example/nostr",
        });
    });

    it("isolates publishes between profiles", () => {
        const busA = createProfileMessageBus({ profileId: "a" });
        const busB = createProfileMessageBus({ profileId: "b" });
        const handlerB = vi.fn();
        busB.subscribe(handlerB);

        busA.publish({ type: "relay-connected", relayUrl: "wss://a" });

        expect(handlerB).not.toHaveBeenCalled();
    });

    it("supports subscribeTo typed filter", () => {
        const bus = createProfileMessageBus({ profileId: "test" });
        const handler = vi.fn();
        bus.subscribeTo("new-message", handler);
        bus.publish({ type: "relay-connected", relayUrl: "wss://ignored" });
        bus.publish({
            type: "new-message",
            conversationId: "dm:x",
            message: { id: "1" },
        });

        expect(handler).toHaveBeenCalledTimes(1);
        expect(handler).toHaveBeenCalledWith({
            type: "new-message",
            conversationId: "dm:x",
            message: { id: "1" },
        });
    });

    it("drops chat-state-replaced when profileId mismatches owning bus", () => {
        const bus = createProfileMessageBus({ profileId: "owner" });
        const handler = vi.fn();
        bus.subscribe(handler);

        bus.publish({
            type: "chat-state-replaced",
            profileId: "other",
            publicKeyHex: "ab",
        });

        expect(handler).not.toHaveBeenCalled();
    });

    it("allows unsubscribe", () => {
        const bus = createProfileMessageBus({ profileId: "p" });
        const handler = vi.fn();
        const off = bus.subscribe(handler);
        off();
        bus.publish({ type: "relay-connected", relayUrl: "wss://x" });
        expect(handler).not.toHaveBeenCalled();
    });
});
