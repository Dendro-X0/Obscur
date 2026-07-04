import { describe, expect, it } from "vitest";

import type { Message } from "../types";
import { areMessageListsEquivalentById } from "./dm-conversation-message-list-equiv";
import { mergeLegacyProjectionFirstWithLiveOverlayForDisplay } from "@/app/features/messaging/services/thread-history/dm-thread-history-legacy-port";

const baseTime = new Date("2026-01-01T00:00:00.000Z");

const makeMessage = (overrides: Partial<Message> & Pick<Message, "id">): Message => ({
    kind: "user",
    content: "hi",
    timestamp: baseTime,
    isOutgoing: false,
    status: "delivered",
    ...overrides,
});

describe("areMessageListsEquivalentById", () => {
    it("returns true for same ids in order", () => {
        const left = [makeMessage({ id: "1", conversationId: "c1" }), makeMessage({ id: "2", conversationId: "c1" })];
        const right = [makeMessage({ id: "1", conversationId: "c1" }), makeMessage({ id: "2", conversationId: "c1" })];
        expect(areMessageListsEquivalentById(left, right)).toBe(true);
    });

    it("returns false when order differs", () => {
        const left = [makeMessage({ id: "1", conversationId: "c1" }), makeMessage({ id: "2", conversationId: "c1" })];
        const right = [makeMessage({ id: "2", conversationId: "c1" }), makeMessage({ id: "1", conversationId: "c1" })];
        expect(areMessageListsEquivalentById(left, right)).toBe(false);
    });
});

describe("mergeLegacyProjectionFirstWithLiveOverlayForDisplay", () => {
    const aliasSet = new Set(["dm-a", "dm-b"]);
    const isDisplayable = (m: Message) => m.kind !== "command";

    it("merges projection with overlay and sorts by timestamp", () => {
        const projection = [
            makeMessage({ id: "p1", conversationId: "dm-a", timestamp: new Date(baseTime.getTime() + 1000) }),
        ];
        const overlay = [
            makeMessage({ id: "o1", conversationId: "dm-a", timestamp: new Date(baseTime.getTime() + 2000) }),
        ];
        const result = mergeLegacyProjectionFirstWithLiveOverlayForDisplay({
            projectionMessages: projection,
            previousMessages: overlay,
            conversationAliasIdSet: aliasSet,
            persistentSuppressedMessageIds: new Set(),
            localMessageRetentionDays: undefined,
            expandedHistory: true,
            liveWindowSoftLimit: 2,
            isDisplayable,
        });
        expect(result.retentionFilteredNextMessages.map((m: Message) => m.id)).toEqual(["p1", "o1"]);
        expect(result.shouldCapToLiveWindow).toBe(false);
    });

    it("drops overlay rows whose conversationId is not in alias set", () => {
        const projection = [
            makeMessage({ id: "p1", conversationId: "dm-a", timestamp: baseTime }),
        ];
        const overlay = [
            makeMessage({ id: "o1", conversationId: "other", timestamp: new Date(baseTime.getTime() + 1000) }),
        ];
        const result = mergeLegacyProjectionFirstWithLiveOverlayForDisplay({
            projectionMessages: projection,
            previousMessages: overlay,
            conversationAliasIdSet: aliasSet,
            persistentSuppressedMessageIds: new Set(),
            localMessageRetentionDays: undefined,
            expandedHistory: true,
            liveWindowSoftLimit: 10,
            isDisplayable,
        });
        expect(result.retentionFilteredNextMessages.map((m: Message) => m.id)).toEqual(["p1"]);
    });

    it("applies live window cap when not expanded", () => {
        const projection = Array.from({ length: 5 }, (_, i) => makeMessage({
            id: `p${i}`,
            conversationId: "dm-a",
            timestamp: new Date(baseTime.getTime() + i * 1000),
        }));
        const result = mergeLegacyProjectionFirstWithLiveOverlayForDisplay({
            projectionMessages: projection,
            previousMessages: [],
            conversationAliasIdSet: aliasSet,
            persistentSuppressedMessageIds: new Set(),
            localMessageRetentionDays: undefined,
            expandedHistory: false,
            liveWindowSoftLimit: 3,
            isDisplayable,
        });
        expect(result.shouldCapToLiveWindow).toBe(true);
        expect(result.mergedMessageCount).toBe(5);
        expect(result.cappedMessageCount).toBe(3);
        expect(result.retentionFilteredNextMessages.map((m: Message) => m.id)).toEqual(["p2", "p3", "p4"]);
    });

    it("filters suppressed ids after merge", () => {
        const projection = [makeMessage({ id: "p1", conversationId: "dm-a", timestamp: baseTime })];
        const overlay = [makeMessage({ id: "o1", conversationId: "dm-a", timestamp: new Date(baseTime.getTime() + 1000) })];
        const result = mergeLegacyProjectionFirstWithLiveOverlayForDisplay({
            projectionMessages: projection,
            previousMessages: overlay,
            conversationAliasIdSet: aliasSet,
            persistentSuppressedMessageIds: new Set(["o1"]),
            localMessageRetentionDays: undefined,
            expandedHistory: true,
            liveWindowSoftLimit: 10,
            isDisplayable,
        });
        expect(result.retentionFilteredNextMessages.map((m: Message) => m.id)).toEqual(["p1"]);
    });
});
