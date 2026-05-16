import { createProfileMessageBus } from "@dweb/core/profile-message-bus";
import { afterEach, describe, expect, it, vi } from "vitest";
import { dispatchGroupRemove } from "./profile-bus-dispatch";
import { setProfileRuntimeScope } from "./profile-runtime-scope";
import { subscribeGroupRemoveDual } from "./subscribe-group-remove-dual";

describe("subscribeGroupRemoveDual", () => {
    afterEach(() => {
        setProfileRuntimeScope(null);
        vi.restoreAllMocks();
    });

    it("coalesces window + bus to one callback in same turn", async () => {
        const bus = createProfileMessageBus({ profileId: "p1" });
        setProfileRuntimeScope({ profileId: "p1", bus });

        const fn = vi.fn();
        const off = subscribeGroupRemoveDual(fn, bus);

        dispatchGroupRemove("group:abc:relay");

        await new Promise<void>((resolve) => {
            queueMicrotask(() => resolve());
        });

        expect(fn).toHaveBeenCalledTimes(1);
        expect(fn).toHaveBeenCalledWith("group:abc:relay");

        off();
    });
});
