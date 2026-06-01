import { createProfileMessageBus } from "@dweb/core/profile-message-bus";
import { afterEach, describe, expect, it } from "vitest";
import { setProfileScopeOverride } from "./profile-scope";
import { getResolvedProfileId, setProfileRuntimeScope } from "./profile-runtime-scope";

describe("profile-runtime-scope", () => {
    afterEach(() => {
        setProfileRuntimeScope(null);
        setProfileScopeOverride(null);
    });

    it("uses injected profile id over ambient safe default when runtime scope is set", () => {
        const bus = createProfileMessageBus({ profileId: "scoped-profile" });
        setProfileRuntimeScope({ profileId: "scoped-profile", bus });
        expect(getResolvedProfileId()).toBe("scoped-profile");

        let seen = 0;
        const off = bus.subscribeTo("relay-connected", () => {
            seen += 1;
        });
        bus.publish({ type: "relay-connected", relayUrl: "wss://t" });
        expect(seen).toBe(1);
        off();
    });

    it("prefers desktop window scope override over injected ProfileRuntime scope", () => {
        const bus = createProfileMessageBus({ profileId: "registry-profile" });
        setProfileRuntimeScope({ profileId: "registry-profile", bus });
        setProfileScopeOverride("window-bound-profile");
        expect(getResolvedProfileId()).toBe("window-bound-profile");
    });
});
