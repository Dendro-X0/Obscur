import { describe, expect, it } from "vitest";
import { removeGroupConversationIdsFromHidden } from "./conversation-visibility";

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
});
