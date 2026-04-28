import type { NostrFilter, Subscription, EnhancedDMControllerState } from "./dm-controller-state";
import type { PublicKeyHex } from "@dweb/crypto/public-key-hex";
import { logRuntimeEvent } from "@/app/shared/runtime-log-classification";
import { deliveryDiagnosticsStore } from "../services/delivery-diagnostics-store";
import { logDmVisibilityEvent } from "../services/dm-visibility-diagnostics";
import { generateSubscriptionId, parseRelayEventMessage } from "./relay-utils";

const LIVE_SUBSCRIPTION_SINCE_SKEW_SECONDS = 0;

export interface SubscriptionManagerParams {
    myPublicKeyHex: PublicKeyHex | null;
    pool: {
        connections: ReadonlyArray<{ url: string; status: string }>;
        subscribe?: (filters: ReadonlyArray<NostrFilter>, onEvent: (event: any, url: string) => void) => string;
        unsubscribe?: (id: string) => void;
        sendToOpen?: (payload: string) => void;
        subscribeToMessages?: (handler: (params: Readonly<{ url: string; message: string }>) => void) => (() => void);
    };
    hasSubscribedRef: { current: boolean };
    activeSubscriptions: { current: Map<string, Subscription> };
    closedSubscriptionIdsRef: { current: Set<string> };
    setState: React.Dispatch<React.SetStateAction<EnhancedDMControllerState>>;
    onEvent: (event: any, url: string) => void;
}

const legacyUnsubscribeBySubscriptionId = new Map<string, () => void>();

/**
 * Logic for managing DM subscriptions
 */
export const subscribeToIncomingDMs = (params: SubscriptionManagerParams): void => {
    const { myPublicKeyHex, pool, hasSubscribedRef, activeSubscriptions, closedSubscriptionIdsRef, setState, onEvent } = params;

    if (!myPublicKeyHex) {
        logRuntimeEvent("dm_subscription.missing_pubkey", "actionable", ["Cannot subscribe: no public key available"]);
        return;
    }

    if (hasSubscribedRef.current) {
        logRuntimeEvent("dm_subscription.already_subscribed", "expected", ["Already subscribed to incoming DMs"]);
        return;
    }

    // History backfill is owned by sync orchestration. Live subscriptions must
    // start from "now" to avoid replaying relay backlog into request/unread state.
    const sinceUnixSeconds = Math.max(
        0,
        Math.floor(Date.now() / 1000) - LIVE_SUBSCRIPTION_SINCE_SKEW_SECONDS,
    );
    const filters: ReadonlyArray<NostrFilter> = [
        {
            kinds: [4, 1059],
            "#p": [myPublicKeyHex],
            limit: 50,
            since: sinceUnixSeconds,
        },
        {
            // Include self-authored kind-4 events so cross-device outgoing history
            // can converge without waiting for backup replay.
            kinds: [4],
            authors: [myPublicKeyHex],
            limit: 50,
            since: sinceUnixSeconds,
        },
    ];

    let subId: string;
    if (typeof pool.subscribe === "function") {
        subId = pool.subscribe(filters, onEvent);
    } else if (typeof pool.subscribeToMessages === "function" && typeof pool.sendToOpen === "function") {
        subId = generateSubscriptionId();
        const onEventWrapper = (rawEvent: string, relayUrl: string) => {
            const event = parseRelayEventMessage(rawEvent);
            if (!event || typeof event !== "object") {
                return;
            }

            // Log event receipt for B→A visibility diagnostics
            const ev = event as Record<string, unknown>;
            logDmVisibilityEvent({
                eventId: String(ev.id ?? "unknown"),
                authorPubkey: String(ev.pubkey ?? "unknown"),
                kind: Number(ev.kind ?? 0),
                relayUrl,
                processingStage: "received",
            });

            onEvent(event, relayUrl);
        };
        const legacyUnsubscribe = pool.subscribeToMessages(({ message, url }) => {
            if (!parseRelayEventMessage(message)) {
                return;
            }
            onEventWrapper(message, url);
        });
        legacyUnsubscribeBySubscriptionId.set(subId, legacyUnsubscribe);
        pool.sendToOpen(JSON.stringify(["REQ", subId, ...filters]));
        logRuntimeEvent(
            "dm_subscription.legacy_adapter_enabled",
            "expected",
            ["Falling back to subscribeToMessages adapter for incoming DM subscription.", { subId }],
        );
    } else {
        logRuntimeEvent(
            "dm_subscription.unsupported_pool_contract",
            "actionable",
            ["Cannot subscribe: relay pool does not expose subscribe or subscribeToMessages contract."],
        );
        return;
    }

    const subscription: Subscription = {
        id: subId,
        filter: filters[0],
        isActive: true,
        createdAt: new Date(),
        eventCount: 0
    };

    activeSubscriptions.current.set(subId, subscription);
    closedSubscriptionIdsRef.current.delete(subId);
    hasSubscribedRef.current = true;

    logRuntimeEvent(
        "dm_subscription.subscribe",
        "expected",
        [`[DMController] Subscribing via central manager for incoming DMs on ${pool.connections.length} relays:`, filters],
        { maxPerWindow: 1, windowMs: 5_000 }
    );

    deliveryDiagnosticsStore.markSubscription({
        subId,
        relayUrls: pool.connections.map((c) => c.url),
        myPublicKeyHex,
    });

    setState(prev => ({
        ...prev,
        subscriptions: Array.from(activeSubscriptions.current.values())
    }));
};

export const unsubscribeFromDMs = (params: Pick<SubscriptionManagerParams, 'pool' | 'activeSubscriptions' | 'closedSubscriptionIdsRef' | 'hasSubscribedRef' | 'setState'>): void => {
    const { pool, activeSubscriptions, closedSubscriptionIdsRef, hasSubscribedRef, setState } = params;

    if (activeSubscriptions.current.size === 0) {
        hasSubscribedRef.current = false;
        return;
    }

    activeSubscriptions.current.forEach((subscription) => {
        if (!subscription.isActive) {
            logRuntimeEvent("dm_subscription.close_skipped_inactive", "expected", ["Skipping close for inactive subscription:", subscription.id]);
            return;
        }
        if (closedSubscriptionIdsRef.current.has(subscription.id)) {
            logRuntimeEvent("dm_subscription.close_suppressed_duplicate", "expected", ["Skipping duplicate close for subscription:", subscription.id]);
            return;
        }
        if (typeof pool.unsubscribe === "function") {
            pool.unsubscribe(subscription.id);
        } else {
            if (typeof pool.sendToOpen === "function") {
                pool.sendToOpen(JSON.stringify(["CLOSE", subscription.id]));
            }
            const legacyUnsubscribe = legacyUnsubscribeBySubscriptionId.get(subscription.id);
            if (legacyUnsubscribe) {
                legacyUnsubscribe();
                legacyUnsubscribeBySubscriptionId.delete(subscription.id);
            }
        }
        closedSubscriptionIdsRef.current.add(subscription.id);
        logRuntimeEvent("dm_subscription.closed", "expected", ["Closed subscription:", subscription.id]);
    });

    activeSubscriptions.current.clear();
    hasSubscribedRef.current = false;

    setState(prev => ({
        ...prev,
        subscriptions: []
    }));
};
