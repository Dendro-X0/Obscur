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

    it("does not infer attachments for community invite control payloads", () => {
        const out = normalizeDmConversationMessageRow({
            id: "m1",
            kind: "user",
            content: JSON.stringify({
                type: "community-invite",
                groupId: "g1",
                roomKey: "rk",
                metadata: {
                    name: "Private Group",
                    picture: "https://example.com/preview.png",
                },
            }),
            isOutgoing: true,
            status: "delivered",
            timestamp: new Date(1),
        });
        expect(out.attachments).toBeUndefined();
    });

    it("normalizes scheme-less nostr.build markdown attachments from content", () => {
        const out = normalizeDmConversationMessageRow({
            id: "m1",
            kind: "user",
            content: "[photo.jpg](image.nostr.build/abc123.jpg)",
            isOutgoing: true,
            status: "delivered",
            timestamp: new Date(1),
        });
        expect(out.attachments).toEqual([
            expect.objectContaining({
                kind: "image",
                url: "https://image.nostr.build/abc123.jpg",
                fileName: "photo.jpg",
            }),
        ]);
    });

    it("repairs stored attachment urls that look like mistaken local host paths", () => {
        const out = normalizeDmConversationMessageRow({
            id: "m1",
            kind: "user",
            content: "[photo.jpg](/image.nostr.build/abc123.jpg)",
            attachments: [{
                kind: "image",
                url: "/image.nostr.build/abc123.jpg)",
                contentType: "image/jpeg",
                fileName: "photo.jpg",
            }],
            isOutgoing: true,
            status: "delivered",
            timestamp: new Date(1),
        });
        expect(out.attachments?.[0]?.url).toBe("https://image.nostr.build/abc123.jpg");
    });

    it("recomputes isOutgoing from wire sender when sqlite flag is stale (IRA-2)", () => {
        const legacyId = `${myHex}:${peerHex}`;
        const inviteContent = JSON.stringify({
            type: "community-invite",
            inviteId: "inv-1",
            groupId: "g1",
            roomKey: "rk",
            metadata: { id: "g1", name: "NewTest 2", access: "invite-only" },
            creatorPubkey: peerHex,
        });
        const out = normalizeDmConversationMessageRow(
            {
                id: "evt-invite",
                kind: "user",
                content: inviteContent,
                conversationId: legacyId,
                senderPubkey: peerHex,
                recipientPubkey: myHex,
                isOutgoing: true,
                status: "delivered",
                timestamp: new Date(1),
            },
            { myPublicKeyHex: myHex, conversationId: legacyId },
        );
        expect(out.isOutgoing).toBe(false);
        expect(out.senderPubkey).toBe(peerHex);
        expect(out.recipientPubkey).toBe(myHex);
    });

    it("uses invite creatorPubkey when sqlite sender is missing", () => {
        const legacyId = `${myHex}:${peerHex}`;
        const inviteContent = JSON.stringify({
            type: "community-invite",
            inviteId: "inv-2",
            groupId: "g1",
            roomKey: "rk",
            metadata: { id: "g1", name: "NewTest 2", access: "invite-only" },
            creatorPubkey: peerHex,
        });
        const out = normalizeDmConversationMessageRow(
            {
                id: "evt-invite-legacy",
                kind: "user",
                content: inviteContent,
                conversationId: legacyId,
                recipientPubkey: myHex,
                isOutgoing: true,
                status: "delivered",
                timestamp: new Date(1),
            },
            { myPublicKeyHex: myHex, conversationId: legacyId },
        );
        expect(out.senderPubkey).toBe(peerHex);
        expect(out.isOutgoing).toBe(false);
    });
});
