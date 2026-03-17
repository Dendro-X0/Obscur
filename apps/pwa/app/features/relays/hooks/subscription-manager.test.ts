import { beforeEach, describe, it, expect, vi } from "vitest";
import { SubscriptionManager } from "./subscription-manager";
import type { NostrFilter } from "../types/nostr-filter";
import type { NostrEvent } from "@dweb/nostr/nostr-event";
import { relayTransportJournal } from "../services/relay-transport-journal";

const buildEvent = (overrides?: Partial<NostrEvent>): NostrEvent => ({
    id: "event-id",
    sig: "sig",
    pubkey: "f".repeat(64),
    kind: 0,
    created_at: 1,
    tags: [],
    content: "{}",
    ...overrides,
});

describe("SubscriptionManager", () => {
    beforeEach(() => {
        relayTransportJournal.resetForTests();
    });

    if (typeof crypto.randomUUID !== "function") {
        Object.defineProperty(crypto, "randomUUID", {
            value: () => "test-sub-id",
            configurable: true,
        });
    } else {
        vi.spyOn(crypto, "randomUUID").mockImplementation(() => "test-sub-id");
    }

    it("preserves search and tag filters when sending REQ", () => {
        vi.useFakeTimers();
        const sentPayloads: string[] = [];
        const manager = new SubscriptionManager(
            (payload) => sentPayloads.push(payload),
            () => () => { }
        );

        const filters: ReadonlyArray<NostrFilter> = [
            { kinds: [0], search: "OBSCUR-RW8NXD", "#code": ["OBSCUR-RW8NXD"], limit: 10 },
        ];
        manager.subscribe(filters, () => { });

        vi.advanceTimersByTime(120);

        expect(sentPayloads).toHaveLength(1);
        const parsed = JSON.parse(sentPayloads[0] ?? "[]");
        expect(parsed[0]).toBe("REQ");
        expect(parsed[2]).toMatchObject({
            kinds: [0],
            search: "OBSCUR-RW8NXD",
            "#code": ["OBSCUR-RW8NXD"],
            limit: 10,
        });
        const snapshot = relayTransportJournal.getSnapshot();
        expect(snapshot.desiredSubscriptionCount).toBe(1);
        expect(snapshot.pendingSubscriptionBatchCount).toBe(0);
        vi.useRealTimers();
    });

    it("routes incoming EVENT by exact subscription id", () => {
        vi.useFakeTimers();
        const sentPayloads: string[] = [];
        let messageHandler: ((params: Readonly<{ url: string; message: string }>) => void) | null = null;
        const manager = new SubscriptionManager(
            (payload) => sentPayloads.push(payload),
            (handler) => {
                messageHandler = handler;
                return () => {
                    messageHandler = null;
                };
            }
        );

        const onEvent = vi.fn();
        const subId = manager.subscribe([{ kinds: [0] }], onEvent);
        vi.advanceTimersByTime(120);

        expect(messageHandler).toBeTruthy();
        const handler = messageHandler as ((params: Readonly<{ url: string; message: string }>) => void) | null;
        if (!handler) {
            throw new Error("Expected message handler to be set");
        }
        handler({
            url: "wss://relay.damus.io",
            message: JSON.stringify(["EVENT", subId, buildEvent({ pubkey: "a".repeat(64) })]),
        });
        expect(onEvent).toHaveBeenCalledTimes(1);

        handler({
            url: "wss://relay.damus.io",
            message: JSON.stringify(["EVENT", "unknown-sub-id", buildEvent({ pubkey: "b".repeat(64) })]),
        });
        expect(onEvent).toHaveBeenCalledTimes(1);
        vi.useRealTimers();
    });

    it("records manual replay diagnostics", () => {
        const sentPayloads: string[] = [];
        const manager = new SubscriptionManager(
            (payload) => sentPayloads.push(payload),
            () => () => { }
        );
        manager.subscribe([{ kinds: [4], authors: ["a".repeat(64)] }], () => { });

        manager.resubscribeAll("manual");

        expect(sentPayloads.length).toBeGreaterThan(0);
        const snapshot = relayTransportJournal.getSnapshot();
        expect(snapshot.lastSubscriptionReplayReasonCode).toBe("manual");
        expect(snapshot.lastSubscriptionReplayResult).toBe("ok");
    });
});
