import { describe, expect, it } from "vitest";
import { normalizeCommunityInvitePayload } from "./community-invite-payload";

describe("normalizeCommunityInvitePayload", () => {
    it("reads nested metadata and room key from strict invite JSON", () => {
        const normalized = normalizeCommunityInvitePayload({
            type: "community-invite",
            groupId: "group-1",
            roomKey: "room-key-hex",
            relayUrl: "wss://nos.lol",
            metadata: {
                id: "group-1",
                name: "NewTest 1",
                about: "Private group",
                access: "invite-only",
            },
        });
        expect(normalized).toMatchObject({
            groupId: "group-1",
            roomKey: "room-key-hex",
            relayUrl: "wss://nos.lol",
            metadata: {
                name: "NewTest 1",
                access: "invite-only",
            },
        });
    });

    it("returns null when group id is missing", () => {
        expect(normalizeCommunityInvitePayload({ type: "community-invite", roomKey: "rk" })).toBeNull();
    });

    it("reads roomKeyHex alias", () => {
        const normalized = normalizeCommunityInvitePayload({
            type: "community-invite",
            groupId: "g1",
            roomKeyHex: "hex-key",
            metadata: { id: "g1", name: "Test" },
        });
        expect(normalized?.roomKey).toBe("hex-key");
    });
});
