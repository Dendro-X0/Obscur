import { describe, expect, it } from "vitest";
import {
    removeConversationIdFromHidden,
    removeGroupConversationIdsFromHidden,
} from "./conversation-visibility";

describe("conversation visibility helpers", () => {
    it("keeps direct-message hidden ids but removes group-style ids", () => {
        const next = removeGroupConversationIdsFromHidden([
            "community:alpha:wss://relay.example",
            "group:legacy:wss://relay.example",
            "alpha@relay.example",
            "d34db33f:d00df00d",
        ]);

        expect(next).toEqual(["d34db33f:d00df00d"]);
    });

    it("removes a selected DM conversation id from hidden ids", () => {
        const next = removeConversationIdFromHidden([
            "aaaaaaaa:bbbbbbbb",
            "cccccccc:dddddddd",
        ], "cccccccc:dddddddd");

        expect(next).toEqual(["aaaaaaaa:bbbbbbbb"]);
    });

    it("keeps hidden ids unchanged when selected id is not hidden", () => {
        const hidden = ["aaaaaaaa:bbbbbbbb"];
        const next = removeConversationIdFromHidden(hidden, "eeeeeeee:ffffffff");

        expect(next).toBe(hidden);
    });
});
