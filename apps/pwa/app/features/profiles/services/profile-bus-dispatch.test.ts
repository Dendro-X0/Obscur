import { createProfileMessageBus } from "@dweb/core/profile-message-bus";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
    dispatchGroupInviteReceived,
    dispatchGroupInviteResponseAccepted,
    dispatchGroupMembershipConfirmed,
    dispatchGroupRemove,
} from "./profile-bus-dispatch";
import { setProfileRuntimeScope } from "./profile-runtime-scope";

describe("dispatchGroupInviteResponseAccepted", () => {
    afterEach(() => {
        setProfileRuntimeScope(null);
        vi.restoreAllMocks();
    });

    it("publishes to profile bus", () => {
        const bus = createProfileMessageBus({ profileId: "p1" });
        setProfileRuntimeScope({ profileId: "p1", bus });

        const busHandler = vi.fn();
        const off = bus.subscribeTo("group-invite-accepted", busHandler);

        dispatchGroupInviteResponseAccepted({
            groupId: "g1",
            memberPubkey: "m".repeat(64),
            relayUrl: "wss://r",
            communityId: "c1",
            recipientPublicKeyHex: "me",
        });

        expect(busHandler).toHaveBeenCalledTimes(1);
        expect(busHandler).toHaveBeenCalledWith(expect.objectContaining({
            type: "group-invite-accepted",
            groupId: "g1",
            memberPubkey: "m".repeat(64),
            relayUrl: "wss://r",
            communityId: "c1",
            recipientPublicKeyHex: "me",
        }));

        off();
    });
});

describe("dispatchGroupInviteReceived", () => {
    afterEach(() => {
        setProfileRuntimeScope(null);
        vi.restoreAllMocks();
    });

    it("publishes object invite to profile bus", () => {
        const bus = createProfileMessageBus({ profileId: "p1" });
        setProfileRuntimeScope({ profileId: "p1", bus });

        const busHandler = vi.fn();
        const off = bus.subscribeTo("group-invite-received", busHandler);

        const invite = { kind: "group", id: "g1", groupId: "x" };
        dispatchGroupInviteReceived(invite);

        expect(busHandler).toHaveBeenCalledTimes(1);
        expect(busHandler).toHaveBeenCalledWith(expect.objectContaining({
            type: "group-invite-received",
            invite,
        }));

        off();
    });

    it("ignores non-object invite", () => {
        const bus = createProfileMessageBus({ profileId: "p1" });
        setProfileRuntimeScope({ profileId: "p1", bus });
        const busHandler = vi.fn();
        const off = bus.subscribeTo("group-invite-received", busHandler);

        dispatchGroupInviteReceived(null);
        dispatchGroupInviteReceived("x");

        expect(busHandler).not.toHaveBeenCalled();
        off();
    });
});

describe("dispatchGroupMembershipConfirmed", () => {
    afterEach(() => {
        setProfileRuntimeScope(null);
        vi.restoreAllMocks();
    });

    it("publishes to profile bus", () => {
        const bus = createProfileMessageBus({ profileId: "p1" });
        setProfileRuntimeScope({ profileId: "p1", bus });

        const busHandler = vi.fn();
        const off = bus.subscribeTo("group-membership-confirmed", busHandler);

        dispatchGroupMembershipConfirmed({
            groupId: "g1",
            relayUrl: "wss://r",
            publicKeyHex: "pk",
        });

        expect(busHandler).toHaveBeenCalledTimes(1);
        expect(busHandler).toHaveBeenCalledWith(expect.objectContaining({
            type: "group-membership-confirmed",
            detail: expect.objectContaining({ groupId: "g1", relayUrl: "wss://r" }),
        }));

        off();
    });
});

describe("dispatchGroupRemove", () => {
    afterEach(() => {
        setProfileRuntimeScope(null);
        vi.restoreAllMocks();
    });

    it("publishes to profile bus", () => {
        const bus = createProfileMessageBus({ profileId: "p1" });
        setProfileRuntimeScope({ profileId: "p1", bus });

        const busHandler = vi.fn();
        const off = bus.subscribeTo("group-removed", busHandler);

        dispatchGroupRemove("group:x:y");

        expect(busHandler).toHaveBeenCalledTimes(1);
        expect(busHandler).toHaveBeenCalledWith(expect.objectContaining({
            type: "group-removed",
            conversationId: "group:x:y",
        }));

        off();
    });

    it("ignores empty conversation id", () => {
        const bus = createProfileMessageBus({ profileId: "p1" });
        setProfileRuntimeScope({ profileId: "p1", bus });
        const busHandler = vi.fn();
        const off = bus.subscribeTo("group-removed", busHandler);

        dispatchGroupRemove("   ");

        expect(busHandler).not.toHaveBeenCalled();
        off();
    });
});
