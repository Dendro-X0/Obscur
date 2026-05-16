import { createProfileMessageBus } from "@dweb/core/profile-message-bus";
import { afterEach, describe, expect, it, vi } from "vitest";
import { dispatchGroupMembershipConfirmed } from "./profile-bus-dispatch";
import { setProfileRuntimeScope } from "./profile-runtime-scope";
import { subscribeGroupMembershipConfirmedDual } from "./subscribe-group-membership-confirmed-dual";

describe("subscribeGroupMembershipConfirmedDual", () => {
    afterEach(() => {
        setProfileRuntimeScope(null);
        vi.restoreAllMocks();
    });

    it("coalesces window + bus to one callback in same turn", async () => {
        const bus = createProfileMessageBus({ profileId: "p1" });
        setProfileRuntimeScope({ profileId: "p1", bus });

        const fn = vi.fn();
        const off = subscribeGroupMembershipConfirmedDual(fn, bus);

        dispatchGroupMembershipConfirmed({
            groupId: "g1",
            relayUrl: "wss://relay",
        });

        await new Promise<void>((resolve) => {
            queueMicrotask(() => resolve());
        });

        expect(fn).toHaveBeenCalledTimes(1);
        expect(fn).toHaveBeenCalledWith(expect.objectContaining({
            groupId: "g1",
            relayUrl: "wss://relay",
        }));

        off();
    });
});
