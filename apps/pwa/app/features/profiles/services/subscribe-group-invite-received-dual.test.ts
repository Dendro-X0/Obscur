import { createProfileMessageBus } from "@dweb/core/profile-message-bus";
import { afterEach, describe, expect, it, vi } from "vitest";
import { dispatchGroupInviteReceived } from "./profile-bus-dispatch";
import { setProfileRuntimeScope } from "./profile-runtime-scope";
import { subscribeGroupInviteReceivedDual } from "./subscribe-group-invite-received-dual";

describe("subscribeGroupInviteReceivedDual", () => {
    afterEach(() => {
        setProfileRuntimeScope(null);
        vi.restoreAllMocks();
    });

    it("coalesces window + bus to one callback in same turn", async () => {
        const bus = createProfileMessageBus({ profileId: "p1" });
        setProfileRuntimeScope({ profileId: "p1", bus });

        const fn = vi.fn();
        const off = subscribeGroupInviteReceivedDual(fn, bus);

        const invite = { kind: "group", id: "conv-1", groupId: "gid" };
        dispatchGroupInviteReceived(invite);

        await new Promise<void>((resolve) => {
            queueMicrotask(() => resolve());
        });

        expect(fn).toHaveBeenCalledTimes(1);
        expect(fn).toHaveBeenCalledWith(invite);

        off();
    });
});
