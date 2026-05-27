import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/app/features/profiles/services/profile-runtime-scope", () => ({
    getResolvedProfileId: vi.fn(() => "profile-test"),
}));

import { RoomKeyStore, roomKeyStore } from "./room-key-store";

describe("roomKeyStore", () => {
    beforeEach(async () => {
        localStorage.clear();
        await roomKeyStore.clearAll();
    });

    afterEach(async () => {
        localStorage.clear();
        await roomKeyStore.clearAll();
    });

    it("persists room keys in localStorage across store instances", async () => {
        await roomKeyStore.saveRoomKey("group-abc", "deadbeef");
        expect(await roomKeyStore.getRoomKey("group-abc")).toBe("deadbeef");

        const reloaded = new RoomKeyStore();
        expect(await reloaded.getRoomKey("group-abc")).toBe("deadbeef");
    });
});
