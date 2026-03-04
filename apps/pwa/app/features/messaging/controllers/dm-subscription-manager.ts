import { generateSubscriptionId } from "./relay-utils";
import type { NostrFilter, Subscription, EnhancedDMControllerState } from "./dm-controller-state";
import type { PublicKeyHex } from "@dweb/crypto/public-key-hex";
import type { RelayPool } from "./enhanced-dm-controller"; // Assuming we might need to export RelayPool or use it
import { logRuntimeEvent } from "@/app/shared/runtime-log-classification";

const GLOBAL_CLOSED_SUBSCRIPTION_IDS = "__obscur_closed_dm_subscription_ids__";

const getClosedSubscriptionIds = (): Set<string> => {
    const root = globalThis as Record<string, unknown>;
    const existing = root[GLOBAL_CLOSED_SUBSCRIPTION_IDS];
    if (existing instanceof Set) {
        return existing as Set<string>;
    }
    const created = new Set<string>();
    root[GLOBAL_CLOSED_SUBSCRIPTION_IDS] = created;
    return created;
};

export interface SubscriptionManagerParams {
    myPublicKeyHex: PublicKeyHex | null;
    pool: {
        connections: ReadonlyArray<{ url: string; status: string }>;
        sendToOpen: (payload: string) => void;
    };
    hasSubscribedRef: { current: boolean };
    activeSubscriptions: { current: Map<string, Subscription> };
    setState: React.Dispatch<React.SetStateAction<EnhancedDMControllerState>>;
}

/**
 * Logic for managing DM subscriptions
 */
export const subscribeToIncomingDMs = (params: SubscriptionManagerParams): void => {
    const { myPublicKeyHex, pool, hasSubscribedRef, activeSubscriptions, setState } = params;

    if (!myPublicKeyHex) {
        logRuntimeEvent("dm_subscription.missing_pubkey", "actionable", ["Cannot subscribe: no public key available"]);
        return;
    }

    if (hasSubscribedRef.current) {
        logRuntimeEvent("dm_subscription.already_subscribed", "expected", ["Already subscribed to incoming DMs"]);
        return;
    }

    const hasOpenRelay = pool.connections.some(c => c.status === 'open');
    if (!hasOpenRelay) {
        logRuntimeEvent("dm_subscription.no_open_relays", "degraded", ["Cannot subscribe: no open relay connections"]);
        return;
    }

    const subId = generateSubscriptionId();
    const filter: NostrFilter = {
        kinds: [4, 1059],
        '#p': [myPublicKeyHex],
        limit: 50
    };

    const subscription: Subscription = {
        id: subId,
        filter,
        isActive: true,
        createdAt: new Date(),
        eventCount: 0
    };

    activeSubscriptions.current.set(subId, subscription);
    hasSubscribedRef.current = true;

    logRuntimeEvent(
        "dm_subscription.subscribe",
        "degraded",
        [`[DMController] Subscribing to incoming DMs on ${pool.connections.filter(c => c.status === 'open').length} open relays:`, filter],
        { maxPerWindow: 1, windowMs: 5_000 }
    );

    const reqMessage = JSON.stringify(['REQ', subId, filter]);
    pool.sendToOpen(reqMessage);

    setState(prev => ({
        ...prev,
        subscriptions: Array.from(activeSubscriptions.current.values())
    }));
};

export const unsubscribeFromDMs = (params: Pick<SubscriptionManagerParams, 'pool' | 'activeSubscriptions' | 'hasSubscribedRef' | 'setState'>): void => {
    const { pool, activeSubscriptions, hasSubscribedRef, setState } = params;

    if (activeSubscriptions.current.size === 0) {
        hasSubscribedRef.current = false;
        return;
    }

    const closedSubscriptionIds = getClosedSubscriptionIds();
    activeSubscriptions.current.forEach((subscription) => {
        if (!subscription.isActive) {
            logRuntimeEvent("dm_subscription.close_skipped_inactive", "expected", ["Skipping close for inactive subscription:", subscription.id]);
            return;
        }
        if (closedSubscriptionIds.has(subscription.id)) {
            logRuntimeEvent("dm_subscription.close_suppressed_duplicate", "expected", ["Skipping duplicate close for subscription:", subscription.id]);
            return;
        }
        const closeMessage = JSON.stringify(['CLOSE', subscription.id]);
        pool.sendToOpen(closeMessage);
        closedSubscriptionIds.add(subscription.id);
        logRuntimeEvent("dm_subscription.closed", "expected", ["Closed subscription:", subscription.id]);
    });

    activeSubscriptions.current.clear();
    hasSubscribedRef.current = false;

    setState(prev => ({
        ...prev,
        subscriptions: []
    }));
};
