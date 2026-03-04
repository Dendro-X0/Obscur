import { generateSubscriptionId } from "./relay-utils";
import type { NostrFilter, Subscription, EnhancedDMControllerState } from "./dm-controller-state";
import type { PublicKeyHex } from "@dweb/crypto/public-key-hex";
import type { RelayPool } from "./enhanced-dm-controller"; // Assuming we might need to export RelayPool or use it
import { logWithRateLimit } from "@/app/shared/log-hygiene";

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
        console.warn('Cannot subscribe: no public key available');
        return;
    }

    if (hasSubscribedRef.current) {
        logWithRateLimit("debug", "dm_subscription.already_subscribed", ['Already subscribed to incoming DMs'], {
            windowMs: 15_000,
            maxPerWindow: 1
        });
        return;
    }

    const hasOpenRelay = pool.connections.some(c => c.status === 'open');
    if (!hasOpenRelay) {
        console.warn('Cannot subscribe: no open relay connections');
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

    logWithRateLimit("info", "dm_subscription.subscribe", [`[DMController] Subscribing to incoming DMs on ${pool.connections.filter(c => c.status === 'open').length} open relays:`, filter], {
        windowMs: 5_000,
        maxPerWindow: 1
    });

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
        return;
    }

    activeSubscriptions.current.forEach((subscription) => {
        const closeMessage = JSON.stringify(['CLOSE', subscription.id]);
        pool.sendToOpen(closeMessage);
        console.log('Closed subscription:', subscription.id);
    });

    activeSubscriptions.current.clear();
    hasSubscribedRef.current = false;

    setState(prev => ({
        ...prev,
        subscriptions: []
    }));
};
