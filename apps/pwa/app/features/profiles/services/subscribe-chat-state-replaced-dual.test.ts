import { createProfileMessageBus } from "@dweb/core/profile-message-bus";
import { afterEach, describe, expect, it, vi } from "vitest";
import { setProfileRuntimeScope } from "./profile-runtime-scope";
import { subscribeChatStateReplacedDual } from "./subscribe-chat-state-replaced-dual";

describe("subscribeChatStateReplacedDual", () => {
    afterEach(() => {
        setProfileRuntimeScope(null);
        vi.restoreAllMocks();
    });

    it("delivers chat-state-replaced from profile bus", async () => {
        const bus = createProfileMessageBus({ profileId: "p1" });
        setProfileRuntimeScope({ profileId: "p1", bus });

        const fn = vi.fn();
        const off = subscribeChatStateReplacedDual(fn, bus);

        bus.publish({
            type: "chat-state-replaced",
            profileId: "p1",
            publicKeyHex: "a".repeat(64),
        });

        await new Promise<void>((resolve) => {
            queueMicrotask(() => resolve());
        });

        expect(fn).toHaveBeenCalledTimes(1);
        expect(fn).toHaveBeenCalledWith(
            expect.objectContaining({
                publicKeyHex: "a".repeat(64),
                profileId: "p1",
            }),
        );

        off();
    });
});
