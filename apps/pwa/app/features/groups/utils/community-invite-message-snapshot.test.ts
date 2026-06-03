import { beforeEach, describe, expect, it } from "vitest";
import {
    applyCommunityInviteMessageSnapshot,
    loadCommunityInviteMessageSnapshot,
    pinCommunityInviteMessageSnapshot,
} from "./community-invite-message-snapshot";
import type { InvitePayload } from "./community-invite-payload";
import { setProfileScopeOverride } from "@/app/features/profiles/services/profile-scope";

const invitePayload = (overrides?: Partial<InvitePayload>): InvitePayload => ({
    type: "community-invite",
    groupId: "d56bc22fd0164c54840c5ce3cbc7df1a",
    roomKey: "room-key-hex",
    metadata: {
        id: "d56bc22fd0164c54840c5ce3cbc7df1a",
        name: "NewTest 1",
        access: "invite-only",
    },
    ...overrides,
});

describe("community-invite-message-snapshot", () => {
    beforeEach(() => {
        if (typeof window !== "undefined") {
            window.localStorage.clear();
        }
        setProfileScopeOverride(null);
    });

    it("restores name and room key after a thin re-parse", () => {
        pinCommunityInviteMessageSnapshot("msg-1", invitePayload());
        const thin = invitePayload({
            roomKey: "",
            metadata: {
                id: "d56bc22fd0164c54840c5ce3cbc7df1a",
                name: "d56bc22fd0164c54840c5ce3cbc7df1a",
            },
        });
        const merged = applyCommunityInviteMessageSnapshot("msg-1", thin);
        expect(merged?.metadata.name).toBe("NewTest 1");
        expect(merged?.roomKey).toBe("room-key-hex");
        expect(loadCommunityInviteMessageSnapshot("msg-1")?.metadataName).toBe("NewTest 1");
    });

    it("REL-003: profile-A snapshot memory does not bleed into profile-B read", () => {
        setProfileScopeOverride("profile-a");
        pinCommunityInviteMessageSnapshot("msg-x", invitePayload({
            metadata: {
                id: "d56bc22fd0164c54840c5ce3cbc7df1a",
                name: "Profile A Group",
            },
        }));

        setProfileScopeOverride("profile-b");
        expect(loadCommunityInviteMessageSnapshot("msg-x")).toBeNull();

        setProfileScopeOverride("profile-a");
        expect(loadCommunityInviteMessageSnapshot("msg-x")?.metadataName).toBe("Profile A Group");
    });
});
