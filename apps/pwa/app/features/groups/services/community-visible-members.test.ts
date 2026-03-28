import { describe, expect, it } from "vitest";
import type { PublicKeyHex } from "@dweb/crypto/public-key-hex";
import { filterVisibleGroupMembers } from "./community-visible-members";

describe("community-visible-members", () => {
    it("filters deleted-account members", () => {
        const members = [
            "member-a",
            "member-b",
            "member-c",
        ] as unknown as ReadonlyArray<PublicKeyHex>;

        const visible = filterVisibleGroupMembers(members, (pubkey) => {
            if (pubkey === "member-b") {
                return {
                    displayName: "Deleted Account",
                    about: "This account has been deleted.",
                };
            }
            return { displayName: "Active member" };
        });

        expect(visible).toEqual([
            "member-a",
            "member-c",
        ]);
    });

    it("keeps members without cached profile metadata", () => {
        const members = [
            "member-a",
            "member-b",
        ] as unknown as ReadonlyArray<PublicKeyHex>;

        const visible = filterVisibleGroupMembers(members, (pubkey) => {
            if (pubkey === "member-a") {
                return null;
            }
            return { displayName: "Known member" };
        });

        expect(visible).toEqual(members);
    });
});
