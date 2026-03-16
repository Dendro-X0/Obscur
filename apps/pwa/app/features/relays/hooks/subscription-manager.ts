import type { NostrEvent } from "@dweb/nostr/nostr-event";
import type { NostrFilter } from "../types/nostr-filter";
import { relayTransportJournal } from "../services/relay-transport-journal";
import type { RelaySubscriptionReplayReasonCode } from "../services/relay-runtime-contracts";

type MessageListener = (params: Readonly<{ url: string; message: string }>) => void;

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === "object" && value !== null;

const isNostrEvent = (value: unknown): value is NostrEvent => {
    if (!isRecord(value)) {
        return false;
    }
    const kind: unknown = value.kind;
    const pubkey: unknown = value.pubkey;
    const tags: unknown = value.tags;
    if (typeof kind !== "number" || typeof pubkey !== "string" || !Array.isArray(tags)) {
        return false;
    }
    return true;
};

interface SubscriptionRequest {
    id: string;
    filters: ReadonlyArray<NostrFilter>;
    onEvent: (event: NostrEvent, url: string) => void;
}

/**
 * Manages Nostr relay subscriptions with request coalescing and batching.
 * Requirement 8.9: Reduce simultaneous active subscriptions to relays.
 */
export class SubscriptionManager {
    private activeSubscriptions: Map<string, SubscriptionRequest> = new Map();
    private batchTimeout: NodeJS.Timeout | null = null;
    private pendingRequests: SubscriptionRequest[] = [];
    private readonly BATCH_WINDOW_MS = 100;

    constructor(
        private sendToRelays: (payload: string) => void,
        private subscribeToMessages: (handler: MessageListener) => () => void
    ) {
        this.subscribeToMessages(this.handleIncomingMessage.bind(this));
        this.syncJournalState();
    }

    /**
     * Request a new subscription with coalescing
     */
    public subscribe(filters: ReadonlyArray<NostrFilter>, onEvent: (event: NostrEvent, url: string) => void): string {
        const id = crypto.randomUUID();
        const request: SubscriptionRequest = { id, filters, onEvent };

        this.pendingRequests.push(request);
        this.activeSubscriptions.set(id, request);
        this.syncJournalState();

        this.scheduleBatch();

        return id;
    }

    /**
     * Unsubscribe from a previously created subscription
     */
    public unsubscribe(id: string): void {
        if (!this.activeSubscriptions.has(id)) return;

        this.activeSubscriptions.delete(id);
        this.pendingRequests = this.pendingRequests.filter((request) => request.id !== id);
        this.syncJournalState();
        // In a full implementation, we would also send a CLOSE message to relays
        // if this was the last consumer of a specific filter set.
        this.sendToRelays(JSON.stringify(["CLOSE", id]));
    }

    public getActiveSubscriptions(): ReadonlyArray<Readonly<{
        id: string;
        filters: ReadonlyArray<NostrFilter>;
    }>> {
        return Array.from(this.activeSubscriptions.values()).map((request) => ({
            id: request.id,
            filters: request.filters,
        }));
    }

    public resubscribeAll(reasonCode: RelaySubscriptionReplayReasonCode = "manual"): void {
        const activeSubscriptions = this.getActiveSubscriptions();
        relayTransportJournal.markSubscriptionReplayAttempt({
            reasonCode,
            detail: `active=${activeSubscriptions.length}`,
        });

        if (activeSubscriptions.length === 0) {
            relayTransportJournal.markSubscriptionReplayResult({
                reasonCode,
                result: "skipped",
                detail: "no_active_subscriptions",
            });
            return;
        }

        let sentCount = 0;
        let skippedEmptyFilterCount = 0;
        try {
            activeSubscriptions.forEach((request) => {
                if (request.filters.length === 0) {
                    skippedEmptyFilterCount += 1;
                    return;
                }
                this.sendToRelays(JSON.stringify(["REQ", request.id, ...request.filters]));
                sentCount += 1;
            });
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            relayTransportJournal.markSubscriptionReplayResult({
                reasonCode,
                result: "failed",
                detail: `sent=${sentCount};error=${errorMessage}`,
            });
            return;
        }

        if (sentCount === 0) {
            relayTransportJournal.markSubscriptionReplayResult({
                reasonCode,
                result: "skipped",
                detail: "no_non_empty_filters",
            });
            return;
        }

        relayTransportJournal.markSubscriptionReplayResult({
            reasonCode,
            result: skippedEmptyFilterCount > 0 ? "partial" : "ok",
            detail: `sent=${sentCount};skipped_empty=${skippedEmptyFilterCount}`,
        });
    }

    public dispose(): void {
        if (this.batchTimeout) {
            clearTimeout(this.batchTimeout);
            this.batchTimeout = null;
        }
        this.pendingRequests = [];
        this.activeSubscriptions.clear();
        this.syncJournalState();
    }

    private scheduleBatch(): void {
        if (this.batchTimeout) return;

        this.batchTimeout = setTimeout(() => {
            this.processBatch();
            this.batchTimeout = null;
        }, this.BATCH_WINDOW_MS);
    }

    private processBatch(): void {
        if (this.pendingRequests.length === 0) return;

        const requestsToProcess = [...this.pendingRequests];
        this.pendingRequests = [];
        this.syncJournalState();

        // Preserve caller-provided filter semantics exactly.
        // Coalescing by kind caused search/tag filters to be dropped and broke invite discovery.
        requestsToProcess.forEach((request: SubscriptionRequest) => {
            if (request.filters.length === 0) {
                return;
            }
            this.sendToRelays(JSON.stringify(["REQ", request.id, ...request.filters]));
        });
    }

    private syncJournalState(): void {
        relayTransportJournal.setSubscriptionState({
            desiredSubscriptionCount: this.activeSubscriptions.size,
            pendingSubscriptionBatchCount: this.pendingRequests.length,
        });
    }

    private handleIncomingMessage(params: { url: string; message: string }): void {
        try {
            const parsed: unknown = JSON.parse(params.message);
            if (!Array.isArray(parsed) || parsed[0] !== "EVENT") {
                return;
            }
            const subscriptionId = typeof parsed[1] === "string" ? parsed[1] : null;
            const eventCandidate: unknown = parsed[2];
            if (!isNostrEvent(eventCandidate)) {
                return;
            }
            const event: NostrEvent = eventCandidate;

            if (subscriptionId) {
                const directSubscription = this.activeSubscriptions.get(subscriptionId);
                if (!directSubscription) {
                    return;
                }
                directSubscription.onEvent(event, params.url);
                return;
            }

            // Route event to all applicable active subscriptions
            this.activeSubscriptions.forEach((sub: SubscriptionRequest) => {
                if (!this.matchesFilter(event, sub.filters)) {
                    return;
                }
                sub.onEvent(event, params.url);
            });
        } catch {
            return;
        }
    }

    private matchesFilter(event: NostrEvent, filters: ReadonlyArray<NostrFilter>): boolean {
        return filters.some((filter: NostrFilter) => {
            if (filter.kinds && !filter.kinds.includes(event.kind)) {
                return false;
            }
            if (filter.authors && !filter.authors.includes(event.pubkey)) {
                return false;
            }
            if (filter["#p"]) {
                const pTags: string[] = event.tags.filter((t: ReadonlyArray<string>) => t[0] === "p").map((t: ReadonlyArray<string>) => t[1] ?? "");
                if (!filter["#p"].some((p: string) => pTags.includes(p))) {
                    return false;
                }
            }
            return true;
        });
    }
}
