import { createProfileMessageBus } from "@dweb/core/profile-message-bus";
import { afterEach, describe, expect, it, vi } from "vitest";
import { dispatchGroupInviteResponseAccepted } from "./profile-bus-dispatch";
import { setProfileRuntimeScope } from "./profile-runtime-scope";
import { subscribeGroupInviteAcceptedDual } from "./subscribe-group-invite-accepted-dual";

describe("subscribeGroupInviteAcceptedDual", () => {
    afterEach(() => {
        setProfileRuntimeScope(null);
        vi.restoreAllMocks();
    });

    it("coalesces window + bus to one callback in same turn", async () => {
        const bus = createProfileMessageBus({ profileId: "p1" });
        setProfileRuntimeScope({ profileId: "p1", bus });

        const fn = vi.fn();
        const off = subscribeGroupInviteAcceptedDual(fn, bus);

        dispatchGroupInviteResponseAccepted({
            groupId: "g1",
            memberPubkey: "m1",
            relayUrl: "wss://r.test",
        });

        await new Promise<void>((resolve) => {
            queueMicrotask(() => resolve());
        });

        expect(fn).toHaveBeenCalledTimes(1);
        expect(fn).toHaveBeenCalledWith(
            expect.objectContaining({
                groupId: "g1",
                memberPubkey: "m1",
                relayUrl: "wss://r.test",
            }),
        );

        off();
    });
});
