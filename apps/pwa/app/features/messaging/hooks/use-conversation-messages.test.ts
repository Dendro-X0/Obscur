import { describe, expect, it } from "vitest";
import type { Message } from "../types";
import type { MessageBusEvent } from "../services/message-bus";
import { applyBufferedEvents, filterMessagesByLocalRetention } from "./use-conversation-messages";

const createMessage = (params: Readonly<{ id: string; timestampMs: number; content?: string }>): Message => ({
    id: params.id,
    kind: "user",
    content: params.content ?? params.id,
    timestamp: new Date(params.timestampMs),
    isOutgoing: false,
    status: "delivered",
});

describe("applyBufferedEvents", () => {
    it("deduplicates by message id and applies updates/deletes atomically", () => {
        const previous = [createMessage({ id: "m1", timestampMs: 1000, content: "old" })];
        const events: MessageBusEvent[] = [
            { type: "new_message", conversationId: "c1", message: createMessage({ id: "m2", timestampMs: 2000 }) },
            { type: "message_updated", conversationId: "c1", message: createMessage({ id: "m1", timestampMs: 1000, content: "new" }) },
            { type: "message_deleted", conversationId: "c1", messageId: "m2" }
        ];

        const next = applyBufferedEvents(previous, events, true, false);
        expect(next).toHaveLength(1);
        expect(next[0].id).toBe("m1");
        expect(next[0].content).toBe("new");
    });

    it("keeps chronological order after out-of-order event arrival", () => {
        const previous: Message[] = [];
        const events: MessageBusEvent[] = [
            { type: "new_message", conversationId: "c1", message: createMessage({ id: "m3", timestampMs: 3000 }) },
            { type: "new_message", conversationId: "c1", message: createMessage({ id: "m1", timestampMs: 1000 }) },
            { type: "new_message", conversationId: "c1", message: createMessage({ id: "m2", timestampMs: 2000 }) }
        ];

        const next = applyBufferedEvents(previous, events, true, false);
        expect(next.map((m) => m.id)).toEqual(["m1", "m2", "m3"]);
    });

    it("applies soft live-window limit only when performance mode is enabled and history is not expanded", () => {
        const previous = Array.from({ length: 230 }, (_, index) =>
            createMessage({
                id: `m-${index + 1}`,
                timestampMs: 1000 + index
            })
        );

        const trimmed = applyBufferedEvents(previous, [], true, false);
        expect(trimmed).toHaveLength(200);
        expect(trimmed[0].id).toBe("m-31");

        const expanded = applyBufferedEvents(previous, [], true, true);
        expect(expanded).toHaveLength(230);

        const legacy = applyBufferedEvents(previous, [], false, false);
        expect(legacy).toHaveLength(230);
    });

    it("prevents stale upsert from resurrecting a recently deleted message id", () => {
        const tombstones = new Map<string, number>();
        const nowMs = 50_000;
        const events: MessageBusEvent[] = [
            { type: "message_deleted", conversationId: "c1", messageId: "z1" },
            { type: "new_message", conversationId: "c1", message: createMessage({ id: "z1", timestampMs: nowMs - 1000, content: "stale" }) },
            { type: "new_message", conversationId: "c1", message: createMessage({ id: "z2", timestampMs: nowMs, content: "ok" }) }
        ];

        const next = applyBufferedEvents([], events, true, false, tombstones, nowMs);
        expect(next.map((m) => m.id)).toEqual(["z2"]);
        expect(tombstones.has("z1")).toBe(true);
    });
});

describe("filterMessagesByLocalRetention", () => {
    it("keeps all messages when retention is disabled", () => {
        const messages = [
            createMessage({ id: "m1", timestampMs: 1_000 }),
            createMessage({ id: "m2", timestampMs: 2_000 }),
        ];
        expect(filterMessagesByLocalRetention(messages, 0, 10_000)).toHaveLength(2);
    });

    it("drops messages older than the configured retention window", () => {
        const nowMs = 100 * 24 * 60 * 60 * 1000;
        const dayMs = 24 * 60 * 60 * 1000;
        const messages = [
            createMessage({ id: "old", timestampMs: nowMs - (31 * dayMs) }),
            createMessage({ id: "edge", timestampMs: nowMs - (30 * dayMs) }),
            createMessage({ id: "new", timestampMs: nowMs - (2 * dayMs) }),
        ];
        const filtered = filterMessagesByLocalRetention(messages, 30, nowMs);
        expect(filtered.map((message) => message.id)).toEqual(["edge", "new"]);
    });
});
