import type { NostrEvent } from "@dweb/nostr/nostr-event";
import type { NostrFilter } from "../relays/types/nostr-filter";
import type { PublishResult, MultiRelayPublishResult } from "../relays/hooks/enhanced-relay-pool";
import type { PublicKeyHex } from "@dweb/crypto/public-key-hex";

import type { RelayConnection } from "../relays/utils/relay-connection";
import type { RelayHealthMetrics } from "../relays/hooks/relay-health-monitor";

export type MockMessageListener = (params: Readonly<{ url: string; message: string }>) => void;

/**
 * In-memory Mock Nostr Pool for Ghost Protocol
 */
export class MockPool {
    private events: NostrEvent[] = [];
    private subscriptions: Map<string, { filters: ReadonlyArray<NostrFilter>; onEvent: (event: NostrEvent) => void }> = new Map();
    private messageListeners: Set<MockMessageListener> = new Set();
    private latencyMs: number = 0;

    constructor(initialEvents: NostrEvent[] = []) {
        this.events = [...initialEvents];
    }

    setLatency(ms: number) {
        this.latencyMs = ms;
    }

    private async simulateLatency() {
        if (this.latencyMs > 0) {
            await new Promise(resolve => setTimeout(resolve, this.latencyMs));
        }
    }

    /**
     * Internal: Push an event to the mock pool (from bots or system)
     */
    async emitEvent(event: NostrEvent) {
        this.events.push(event);

        // Notify subscriptions
        for (const [_, sub] of this.subscriptions) {
            if (this.matchesFilters(event, sub.filters)) {
                sub.onEvent(event);
            }
        }

        // Notify raw message listeners (simulating WebSocket message)
        const messagePayload = JSON.stringify(["EVENT", "sub_id_placeholder", event]);
        this.messageListeners.forEach(listener => {
            listener({ url: "mock://ghost-protocol", message: messagePayload });
        });
    }

    private matchesFilters(event: NostrEvent, filters: ReadonlyArray<NostrFilter>): boolean {
        return filters.some(filter => {
            if (filter.kinds && !filter.kinds.includes(event.kind)) return false;
            if (filter.authors && !filter.authors.includes(event.pubkey)) return false;

            // Check tags (p, h, d)
            if (filter["#p"] && !event.tags.some(t => t[0] === "p" && filter["#p"]?.includes(t[1]))) return false;
            if (filter["#h"] && !event.tags.some(t => t[0] === "h" && filter["#h"]?.includes(t[1]))) return false;
            if (filter["#d"] && !event.tags.some(t => t[0] === "d" && filter["#d"]?.includes(t[1]))) return false;

            return true;
        });
    }

    // --- NostrPool Interface Implementation ---

    async publishToRelay(url: string, payload: string): Promise<PublishResult> {
        await this.simulateLatency();
        try {
            const [type, event] = JSON.parse(payload);
            if (type === "EVENT") {
                await this.emitEvent(event);
                return { success: true, relayUrl: url, latency: this.latencyMs };
            }
        } catch (e) {
            return { success: false, relayUrl: url, error: "Malformed payload" };
        }
        return { success: false, relayUrl: url };
    }

    async publishToAll(payload: string): Promise<MultiRelayPublishResult> {
        await this.simulateLatency();
        try {
            const [type, event] = JSON.parse(payload);
            if (type === "EVENT") {
                await this.emitEvent(event);
                return {
                    success: true,
                    successCount: 1,
                    totalRelays: 1,
                    results: [{ success: true, relayUrl: "mock://ghost-protocol", latency: this.latencyMs }]
                };
            }
        } catch (e) {
            return { success: false, successCount: 1, totalRelays: 1, results: [], overallError: "Malformed payload" };
        }
        return { success: false, successCount: 0, totalRelays: 1, results: [] };
    }

    sendToOpen(payload: string): void {
        const parsed = JSON.parse(payload);
        const type = parsed[0];
        const rest = parsed.slice(1);

        if (type === "REQ") {
            const [subId, ...filters] = rest;
            // Immediate response for REQ if we have historical events
            this.events.forEach(event => {
                if (this.matchesFilters(event, filters)) {
                    const messagePayload = JSON.stringify(["EVENT", subId, event]);
                    this.messageListeners.forEach(listener => listener({ url: "mock://ghost-protocol", message: messagePayload }));
                }
            });
            // Also send EOSE
            const eosePayload = JSON.stringify(["EOSE", subId]);
            this.messageListeners.forEach(listener => listener({ url: "mock://ghost-protocol", message: eosePayload }));
        }
        if (type === "EVENT") {
            this.emitEvent(rest[0]);
        }
    }

    subscribe(filters: ReadonlyArray<NostrFilter>, onEvent: (event: NostrEvent) => void): string {
        const id = Math.random().toString(36).substring(7);
        this.subscriptions.set(id, { filters, onEvent });

        // Push existing events (simulating stored events)
        setTimeout(() => {
            this.events.forEach(event => {
                if (this.matchesFilters(event, filters)) {
                    onEvent(event);
                }
            });
        }, 0);

        return id;
    }

    unsubscribe(id: string): void {
        this.subscriptions.delete(id);
    }

    subscribeToMessages(handler: MockMessageListener): () => void {
        this.messageListeners.add(handler);
        return () => this.messageListeners.delete(handler);
    }

    // Minimum stubs for interface parity
    get connections(): ReadonlyArray<RelayConnection> { return []; }
    get healthMetrics(): ReadonlyArray<RelayHealthMetrics> { return []; }
    getRelayHealth(_url: string) { return undefined; }
    canConnectToRelay(_url: string) { return true; }
    addTransientRelay(_url: string) { }
    removeTransientRelay(_url: string) { }
}
