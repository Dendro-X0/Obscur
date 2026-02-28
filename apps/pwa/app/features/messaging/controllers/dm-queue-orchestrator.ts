import { MessageQueue, type OutgoingMessage, type MessageStatus } from "../lib/message-queue";
import { offlineQueueManager, type QueueStatus } from "../lib/offline-queue-manager";
import { publishQueuedOutgoingMessage } from "./outgoing-dm-publisher";
import { createReadyState, type EnhancedDMControllerState } from "./dm-controller-state";
import type { RelayPool } from "./enhanced-dm-controller";

export interface QueueOrchestratorParams {
    messageQueue: MessageQueue | null;
    pool: RelayPool;
    setState: React.Dispatch<React.SetStateAction<EnhancedDMControllerState>>;
}

/**
 * Manually process the offline queue
 */
export const processOfflineQueue = async (params: QueueOrchestratorParams): Promise<void> => {
    const { messageQueue, pool, setState } = params;
    if (!messageQueue) return;

    const sendQueuedMessage = async (message: OutgoingMessage): Promise<boolean> => {
        const wasAccepted = await publishQueuedOutgoingMessage({
            pool,
            messageQueue,
            message
        });

        if (wasAccepted) {
            setState(prev => {
                const updatedMessages = prev.messages.map(m =>
                    m.id === message.id ? { ...m, status: 'accepted' as MessageStatus } : m
                );
                return createReadyState(updatedMessages);
            });
        }

        return wasAccepted;
    };

    await offlineQueueManager.manualProcessQueue(
        () => messageQueue.getQueuedMessages(),
        sendQueuedMessage,
        (messageId) => messageQueue.removeFromQueue(messageId)
    );
};

/**
 * Get the current status of the offline queue
 */
export const getOfflineQueueStatus = async (messageQueue: MessageQueue | null): Promise<QueueStatus | null> => {
    if (!messageQueue) return null;
    return offlineQueueManager.getQueueStatus(() => messageQueue.getQueuedMessages());
};

/**
 * Setup automatic queue processing
 */
export const setupAutoQueueProcessing = (params: QueueOrchestratorParams) => {
    const { messageQueue, pool, setState } = params;
    if (!messageQueue) return () => { };

    const sendQueuedMessage = async (message: OutgoingMessage): Promise<boolean> => {
        if (!message.signedEvent) {
            console.error('Queued message missing signed event');
            return false;
        }

        try {
            const eventPayload = JSON.stringify(['EVENT', message.signedEvent]);

            if (pool.publishToAll) {
                const result = await pool.publishToAll(eventPayload);

                if (result.success) {
                    await messageQueue.updateMessageStatus(message.id, 'accepted');

                    setState(prev => {
                        const updatedMessages = prev.messages.map(m =>
                            m.id === message.id ? { ...m, status: 'accepted' as MessageStatus } : m
                        );
                        return createReadyState(updatedMessages);
                    });

                    return true;
                } else {
                    await messageQueue.updateMessageStatus(message.id, 'rejected');
                    return false;
                }
            } else {
                pool.sendToOpen(eventPayload);
                await messageQueue.updateMessageStatus(message.id, 'accepted');
                return true;
            }
        } catch (error) {
            console.error('Failed to send queued message:', error);
            return false;
        }
    };

    offlineQueueManager.startAutoProcessing(
        () => messageQueue.getQueuedMessages(),
        sendQueuedMessage,
        (messageId) => messageQueue.removeFromQueue(messageId)
    );

    const unsubscribe = offlineQueueManager.subscribeToQueueStatus((queueStatus) => {
        setState(prev => ({
            ...prev,
            queueStatus
        }));
    });

    return () => {
        offlineQueueManager.stopAutoProcessing();
        unsubscribe();
    };
};
