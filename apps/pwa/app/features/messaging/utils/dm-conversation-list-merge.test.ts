import { describe, expect, it } from "vitest";
import type { DmConversation } from "@/app/features/messaging/types";
import {
    buildDmConnectionsFromPersistedCreatedConnections,
    derivePeerPubkeyFromDmConversationId,
    mergeDmConversationLists,
    touchDmConversationFromMessage,
    upsertDmConversationInList,
} from "./dm-conversation-list-merge";

const peerA = "a".repeat(64);
const peerB = "b".repeat(64);
const conversationId = [peerA, peerB].sort().join(":");

const buildConnection = (params: Readonly<{
    pubkey: string;
    displayName: string;
    lastMessage: string;
    lastMessageTimeMs: number;
}>): DmConversation => ({
    kind: "dm",
    id: conversationId,
    pubkey: params.pubkey as DmConversation["pubkey"],
    displayName: params.displayName,
    lastMessage: params.lastMessage,
    unreadCount: 0,
    lastMessageTime: new Date(params.lastMessageTimeMs),
});

describe("buildDmConnectionsFromPersistedCreatedConnections", () => {
    it("uses createdConnections only and ignores message-history threads", () => {
        const connections = buildDmConnectionsFromPersistedCreatedConnections({
            version: 2,
            createdConnections: [{
                id: conversationId,
                displayName: "Metadata Contact",
                pubkey: peerB,
                lastMessage: "",
                unreadCount: 0,
                lastMessageTimeMs: 1,
            }],
            createdGroups: [],
            unreadByConversationId: {},
            connectionOverridesByConnectionId: {},
            messagesByConversationId: {
                [conversationId]: [{
                    id: "msg-1",
                    content: "ghost thread",
                    timestampMs: 9_000,
                    isOutgoing: false,
                    senderPubkey: peerB,
                }],
            },
            groupMessages: {},
            connectionRequests: [],
            pinnedChatIds: [],
            hiddenChatIds: [],
        });
        expect(connections).toHaveLength(1);
        expect(connections[0]?.displayName).toBe("Metadata Contact");
        expect(connections[0]?.lastMessage).toBe("");
    });
});

describe("mergeDmConversationLists", () => {
    it("keeps persisted-only threads when projection authority is active", () => {
        const projection = [buildConnection({
            pubkey: peerB,
            displayName: "bbbbbbbb",
            lastMessage: "projection",
            lastMessageTimeMs: 3_000,
        })];
        const persisted = [buildConnection({
            pubkey: peerA,
            displayName: "Legacy Contact",
            lastMessage: "persisted",
            lastMessageTimeMs: 2_000,
        })];
        const merged = mergeDmConversationLists(projection, persisted);
        expect(merged.map((entry) => entry.displayName).sort()).toEqual([
            "Legacy Contact",
            "bbbbbbbb",
        ]);
    });

    it("prefers the newer preview when the same peer exists in both lists", () => {
        const older = buildConnection({
            pubkey: peerB,
            displayName: "Projection Contact",
            lastMessage: "old",
            lastMessageTimeMs: 1_000,
        });
        const newer = buildConnection({
            pubkey: peerB,
            displayName: "Persisted Contact",
            lastMessage: "fresh",
            lastMessageTimeMs: 5_000,
        });
        const merged = mergeDmConversationLists([older], [newer]);
        expect(merged).toHaveLength(1);
        expect(merged[0]?.lastMessage).toBe("fresh");
        expect(merged[0]?.displayName).toBe("Persisted Contact");
    });
});

describe("touchDmConversationFromMessage", () => {
    it("creates a sidebar row for a DM thread that only exists in message history", () => {
        const next = touchDmConversationFromMessage({
            connections: [],
            conversationId,
            myPublicKeyHex: peerA,
            messagePreview: "hello",
            messageTime: new Date(4_000),
            displayName: "Tester2",
        });
        expect(next).toHaveLength(1);
        expect(next[0]?.pubkey).toBe(peerB);
        expect(next[0]?.lastMessage).toBe("hello");
    });
});

describe("derivePeerPubkeyFromDmConversationId", () => {
    it("returns the counterparty pubkey for a canonical dm id", () => {
        expect(derivePeerPubkeyFromDmConversationId(conversationId, peerA)).toBe(peerB);
        expect(derivePeerPubkeyFromDmConversationId(conversationId, peerB)).toBe(peerA);
    });
});

describe("upsertDmConversationInList", () => {
    it("adds a new conversation without dropping existing rows", () => {
        const existing = buildConnection({
            pubkey: peerA,
            displayName: "Alpha",
            lastMessage: "a",
            lastMessageTimeMs: 1_000,
        });
        const incoming = buildConnection({
            pubkey: peerB,
            displayName: "Bravo",
            lastMessage: "b",
            lastMessageTimeMs: 2_000,
        });
        const merged = upsertDmConversationInList([existing], incoming);
        expect(merged).toHaveLength(2);
    });
});
