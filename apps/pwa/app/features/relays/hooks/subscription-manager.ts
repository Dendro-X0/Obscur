import type { NostrFilter } from "../../messaging/controllers/enhanced-dm-controller";

type RelayPayload = string;
type MessageListener = (params: Readonly<{ url: string; message: string }>) => void;

interface SubscriptionRequest {
    id: string;
    filters: NostrFilter[];
    onEvent: (event: any) => void;
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
    }

    /**
     * Request a new subscription with coalescing
     */
    public subscribe(filters: NostrFilter[], onEvent: (event: any) => void): string {
        const id = crypto.randomUUID();
        const request: SubscriptionRequest = { id, filters, onEvent };

        this.pendingRequests.push(request);
        this.activeSubscriptions.set(id, request);

        this.scheduleBatch();

        return id;
    }

    /**
     * Unsubscribe from a previously created subscription
     */
    public unsubscribe(id: string): void {
        if (!this.activeSubscriptions.has(id)) return;

        this.activeSubscriptions.delete(id);
        // In a full implementation, we would also send a CLOSE message to relays
        // if this was the last consumer of a specific filter set.
        this.sendToRelays(JSON.stringify(["CLOSE", id]));
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

        // Coalesce filters by kind
        // For simplicity, we'll group filters that have the same 'kinds'
        const groupedByKinds: Map<string, NostrFilter[]> = new Map();

        requestsToProcess.forEach(req => {
            req.filters.forEach(filter => {
                const key = (filter.kinds || []).sort().join(",");
                if (!groupedByKinds.has(key)) groupedByKinds.set(key, []);
                groupedByKinds.get(key)!.push(filter);
            });
        });

        // Merge filters in each group
        groupedByKinds.forEach((filters, kindKey) => {
            if (filters.length === 0) return;

            // Create a merged filter
            const mergedFilter: NostrFilter = {
                kinds: filters[0].kinds,
            };

            // Merge authors
            const authors = new Set<string>();
            filters.forEach(f => (f.authors || []).forEach((a: string) => authors.add(a)));
            if (authors.size > 0) mergedFilter.authors = Array.from(authors);

            // Merge #p tags (recipients)
            const pTags = new Set<string>();
            filters.forEach(f => (f['#p'] || []).forEach((p: string) => pTags.add(p)));
            if (pTags.size > 0) mergedFilter['#p'] = Array.from(pTags);

            // Take the minimum 'since' to ensure all data is covered
            const sinceValues = filters.map(f => f.since).filter((s): s is number => s !== undefined);
            if (sinceValues.length > 0) mergedFilter.since = Math.min(...sinceValues);

            // We use a internal sub ID for the coalesced request
            const combinedSubId = `coalesced-${kindKey || 'all'}-${Date.now()}`;

            this.sendToRelays(JSON.stringify(["REQ", combinedSubId, mergedFilter]));
        });

        // Fallback: If no grouping was possible or for requests that need individual sub IDs
        // (In this basic version, we just sent the merged ones)
    }

    private handleIncomingMessage(params: { url: string; message: string }): void {
        try {
            const parsed = JSON.parse(params.message);
            if (!Array.isArray(parsed) || parsed[0] !== "EVENT") return;

            const subId = parsed[1];
            const event = parsed[2];

            // Route event to all applicable active subscriptions
            this.activeSubscriptions.forEach(sub => {
                if (this.matchesFilter(event, sub.filters)) {
                    sub.onEvent(event);
                }
            });
        } catch (e) { }
    }

    private matchesFilter(event: any, filters: NostrFilter[]): boolean {
        return filters.some(filter => {
            if (filter.kinds && !filter.kinds.includes(event.kind)) return false;
            if (filter.authors && !filter.authors.includes(event.pubkey)) return false;
            if (filter['#p']) {
                const pTags = event.tags.filter((t: any[]) => t[0] === 'p').map((t: any[]) => t[1]);
                if (!filter['#p'].some((p: string) => pTags.includes(p))) return false;
            }
            return true;
        });
    }
}
