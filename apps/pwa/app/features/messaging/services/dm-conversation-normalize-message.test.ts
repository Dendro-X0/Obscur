import { describe, expect, it } from "vitest";
import type { PublicKeyHex } from "@dweb/crypto/public-key-hex";

import { createDeleteCommandMessage, encodeCommandMessage } from "../utils/commands";
import { normalizeDmConversationMessageRow } from "./dm-conversation-normalize-message";

const myHex = "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa" as PublicKeyHex;
const peerHex = "bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb" as PublicKeyHex;

describe("normalizeDmConversationMessageRow", () => {
    it("parses timestamp from timestampMs when not a Date", () => {
        const out = normalizeDmConversationMessageRow({
            id: "m1",
            kind: "user",
            content: "",
            timestampMs: 1_700_000_000_000,
            isOutgoing: false,
            status: "delivered",
        });
        expect(out.timestamp.getTime()).toBe(1_700_000_000_000);
    });

    it("canonicalizes conversation id for legacy a:b ordering", () => {
        const legacyId = `${peerHex}:${myHex}`;
        const out = normalizeDmConversationMessageRow(
            {
                id: "m1",
                kind: "user",
                content: "hi",
                conversationId: legacyId,
                isOutgoing: false,
                status: "delivered",
                timestamp: new Date(1),
            },
            { myPublicKeyHex: myHex, conversationId: legacyId },
        );
        expect(out.conversationId).toBe(`${myHex}:${peerHex}`);
    });

    it("infers sender from isOutgoing false + peer when pubkeys missing", () => {
        const legacyId = `${myHex}:${peerHex}`;
        const out = normalizeDmConversationMessageRow(
            {
                id: "m1",
                kind: "user",
                content: "hi",
                conversationId: legacyId,
                isOutgoing: false,
                status: "delivered",
                timestamp: new Date(1),
            },
            { myPublicKeyHex: myHex },
        );
        expect(out.senderPubkey).toBe(peerHex);
        expect(out.recipientPubkey).toBe(myHex);
    });

    it("marks kind command when parseCommandMessage matches", () => {
        const out = normalizeDmConversationMessageRow({
            id: "m1",
            kind: "user",
            content: encodeCommandMessage(createDeleteCommandMessage("target-1")),
            isOutgoing: true,
            status: "delivered",
            timestamp: new Date(1),
        });
        expect(out.kind).toBe("command");
    });

    it("infers attachments from URLs in content when none stored", () => {
        const out = normalizeDmConversationMessageRow({
            id: "m1",
            kind: "user",
            content: "see https://example.com/a.png",
            isOutgoing: true,
            status: "delivered",
            timestamp: new Date(1),
        });
        expect(out.attachments).toBeDefined();
        expect(out.attachments?.length).toBeGreaterThan(0);
    });
});
