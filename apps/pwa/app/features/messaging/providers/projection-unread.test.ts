import { describe, expect, it } from "vitest";
import type { DmConversation } from "../types";
import {
    buildProjectionUnreadByConversationId,
    mergeProjectionUnreadByConversationId,
    replaceProjectionUnreadByConversationId,
    unreadByConversationIdEqual
} from "./projection-unread";

const conversation = (id: string, unreadCount: number): DmConversation => ({
    kind: "dm",
    id,
    displayName: id,
    pubkey: `${id}-pubkey` as DmConversation["pubkey"],
    lastMessage: "",
    unreadCount,
    lastMessageTime: new Date(0),
});

describe("projection unread helpers", () => {
    it("forces selected conversation unread to zero", () => {
        const unread = buildProjectionUnreadByConversationId([
            conversation("group:alpha", 5),
            conversation("dm:beta", 2),
        ], "group:alpha");

        expect(unread["group:alpha"]).toBe(0);
        expect(unread["dm:beta"]).toBe(2);
    });

    it("normalizes invalid unread counts to zero", () => {
        const unread = buildProjectionUnreadByConversationId([
            conversation("dm:a", -1),
            conversation("dm:b", Number.NaN),
            conversation("dm:c", 1.8),
        ], null);

        expect(unread["dm:a"]).toBe(0);
        expect(unread["dm:b"]).toBe(0);
        expect(unread["dm:c"]).toBe(1);
    });

    it("compares unread maps by keys and values", () => {
        expect(unreadByConversationIdEqual({ a: 1, b: 0 }, { b: 0, a: 1 })).toBe(true);
        expect(unreadByConversationIdEqual({ a: 1 }, { a: 2 })).toBe(false);
        expect(unreadByConversationIdEqual({ a: 1 }, { a: 1, b: 0 })).toBe(false);
    });

    it("merges projection unread values without dropping non-projection conversations", () => {
        const merged = mergeProjectionUnreadByConversationId({
            currentUnreadByConversationId: {
                "community:alpha:wss://relay.one": 0,
                "dm:legacy": 4,
            },
            projectionConnections: [
                conversation("dm:legacy", 2),
                conversation("dm:new", 7),
            ],
            selectedConversationId: "community:alpha:wss://relay.one",
        });

        expect(merged["community:alpha:wss://relay.one"]).toBe(0);
        expect(merged["dm:legacy"]).toBe(2);
        expect(merged["dm:new"]).toBe(7);
    });

    it("suppresses stale projection unread when last-seen is newer than last message", () => {
        const lastMessageTime = new Date(10_000);
        const merged = mergeProjectionUnreadByConversationId({
            currentUnreadByConversationId: {
                "dm:stale": 3,
            },
            projectionConnections: [
                { ...conversation("dm:stale", 9), lastMessageTime },
            ],
            selectedConversationId: null,
            lastSeenByConversationId: {
                "dm:stale": 10_001,
            },
        });

        expect(merged["dm:stale"]).toBe(0);
    });

    it("does not reassert DM unread from projection while a group conversation is selected", () => {
        const merged = mergeProjectionUnreadByConversationId({
            currentUnreadByConversationId: {
                "dm:peer": 0,
                "community:alpha:wss://relay.one": 2,
            },
            projectionConnections: [
                { ...conversation("dm:peer", 6), lastMessageTime: new Date(12_000) },
            ],
            selectedConversationId: "community:alpha:wss://relay.one",
            selectedConversationKind: "group",
        });

        expect(merged["dm:peer"]).toBe(0);
        expect(merged["community:alpha:wss://relay.one"]).toBe(2);
    });

    it("resumes projection DM unread merge when selected conversation is DM", () => {
        const merged = mergeProjectionUnreadByConversationId({
            currentUnreadByConversationId: {
                "dm:peer": 0,
            },
            projectionConnections: [
                { ...conversation("dm:peer", 3), lastMessageTime: new Date(12_000) },
            ],
            selectedConversationId: null,
            selectedConversationKind: "dm",
        });

        expect(merged["dm:peer"]).toBe(3);
    });

    it("replaces stale DM unread keys while preserving group unread keys", () => {
        const replaced = replaceProjectionUnreadByConversationId({
            currentUnreadByConversationId: {
                "community:alpha:wss://relay.one": 4,
                "dm:stale": 8,
                "dm:fresh": 1,
            },
            projectionConnections: [
                { ...conversation("dm:fresh", 2), lastMessageTime: new Date(12_000) },
            ],
            selectedConversationId: null,
            selectedConversationKind: "dm",
        });

        expect(replaced["community:alpha:wss://relay.one"]).toBe(4);
        expect(replaced["dm:fresh"]).toBe(2);
        expect(replaced["dm:stale"]).toBeUndefined();
    });
});
