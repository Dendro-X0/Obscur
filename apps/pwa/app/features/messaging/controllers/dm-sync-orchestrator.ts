import { loadingStateManager } from "../lib/ui-performance";
import { generateSubscriptionId } from "./relay-utils";
import type { NostrFilter, EnhancedDMControllerState } from "./dm-controller-state";
import type { PublicKeyHex } from "@dweb/crypto/public-key-hex";
import type { MessageQueue } from "../lib/message-queue";

const GLOBAL_SYNC_LOCK_KEY = "__obscur_dm_sync_lock__";
const getGlobalSyncLock = (): { inProgress: boolean } => {
    const target = globalThis as Record<string, unknown>;
    const existing = target[GLOBAL_SYNC_LOCK_KEY];
    if (existing && typeof existing === "object" && "inProgress" in (existing as Record<string, unknown>)) {
        return existing as { inProgress: boolean };
    }
    const lock = { inProgress: false };
    target[GLOBAL_SYNC_LOCK_KEY] = lock;
    return lock;
};

export interface SyncOrchestratorParams {
    myPublicKeyHex: PublicKeyHex | null;
    messageQueue: MessageQueue | null;
    pool: {
        connections: ReadonlyArray<{ url: string; status: string }>;
        sendToOpen: (payload: string) => void;
    };
    syncStateRef: {
        current: {
            isSyncing: boolean;
            lastSyncAt?: Date;
            conversationTimestamps: Map<string, Date>;
        };
    };
    setState: React.Dispatch<React.SetStateAction<EnhancedDMControllerState>>;
}

/**
 * Orchestrates the synchronization of missed messages
 */
export const syncMissedMessages = async (
    params: SyncOrchestratorParams,
    since?: Date
): Promise<void> => {
    const { myPublicKeyHex, messageQueue, pool, syncStateRef, setState } = params;
    const globalSyncLock = getGlobalSyncLock();

    if (!myPublicKeyHex || !messageQueue) {
        console.warn('Cannot sync: identity or message queue not available');
        return;
    }

    if (syncStateRef.current.isSyncing) {
        console.log('Sync already in progress, skipping');
        return;
    }
    if (globalSyncLock.inProgress) {
        console.debug('Global sync already in progress, skipping');
        return;
    }

    const hasOpenRelay = pool.connections.some(c => c.status === 'open');
    if (!hasOpenRelay) {
        console.warn('Cannot sync: no open relay connections');
        return;
    }

    try {
        syncStateRef.current.isSyncing = true;
        globalSyncLock.inProgress = true;

        loadingStateManager.setLoading('messageSync', {
            isLoading: true,
            progress: 0,
            message: 'Syncing messages...'
        });

        setState(prev => ({
            ...prev,
            syncProgress: {
                total: 0,
                completed: 0,
                errors: 0
            }
        }));

        let syncTimestamp: number;
        if (since) {
            syncTimestamp = Math.floor(since.getTime() / 1000);
        } else {
            let mostRecentTimestamp: Date | null = null;
            for (const [_, lastTimestamp] of syncStateRef.current.conversationTimestamps.entries()) {
                if (!mostRecentTimestamp || lastTimestamp > mostRecentTimestamp) {
                    mostRecentTimestamp = lastTimestamp;
                }
            }

            if (mostRecentTimestamp) {
                syncTimestamp = Math.floor(mostRecentTimestamp.getTime() / 1000);
            } else {
                const oneDayAgo = Date.now() - (24 * 60 * 60 * 1000);
                syncTimestamp = Math.floor(oneDayAgo / 1000);
            }
        }

        console.log('Starting message sync from timestamp:', new Date(syncTimestamp * 1000));

        const syncSubId = generateSubscriptionId();
        const syncFilter: NostrFilter = {
            kinds: [4, 1059],
            '#p': [myPublicKeyHex],
            since: syncTimestamp,
            limit: 100
        };

        const syncedCount = 0;
        const errorCount = 0;

        const syncReqMessage = JSON.stringify(['REQ', syncSubId, syncFilter]);
        pool.sendToOpen(syncReqMessage);

        const syncTimeout = setTimeout(() => {
            const closeMessage = JSON.stringify(['CLOSE', syncSubId]);
            pool.sendToOpen(closeMessage);

            syncStateRef.current.isSyncing = false;
            globalSyncLock.inProgress = false;
            syncStateRef.current.lastSyncAt = new Date();

            loadingStateManager.complete('messageSync');

            setState(prev => ({
                ...prev,
                syncProgress: undefined
            }));

            console.log(`Sync completed: ${syncedCount} messages synced, ${errorCount} errors`);
        }, 10000);

        const progressInterval = setInterval(() => {
            const progress = syncedCount + errorCount > 0
                ? (syncedCount / (syncedCount + errorCount)) * 100
                : 0;

            loadingStateManager.updateProgress('messageSync', progress,
                `Synced ${syncedCount} messages...`);

            setState(prev => {
                if (!prev.syncProgress) return prev;
                return {
                    ...prev,
                    syncProgress: {
                        total: syncedCount + errorCount,
                        completed: syncedCount,
                        errors: errorCount
                    }
                };
            });
        }, 500);

        setTimeout(() => {
            clearInterval(progressInterval);
            clearTimeout(syncTimeout);
        }, 10000);

    } catch (error) {
        console.error('Failed to sync missed messages:', error);
        syncStateRef.current.isSyncing = false;
        globalSyncLock.inProgress = false;
        loadingStateManager.complete('messageSync');

        setState(prev => ({
            ...prev,
            syncProgress: undefined
        }));
    }
};
