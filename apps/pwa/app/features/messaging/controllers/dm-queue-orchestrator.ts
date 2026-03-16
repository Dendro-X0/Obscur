import { MessageQueue, type OutgoingMessage, type MessageStatus } from "../lib/message-queue";
import { offlineQueueManager, type QueueSendAttemptResult, type QueueStatus } from "../lib/offline-queue-manager";
import { publishQueuedOutgoingMessage } from "./outgoing-dm-publisher";
import { createReadyState, type EnhancedDMControllerState } from "./dm-controller-state";
import type { RelayPool } from "./enhanced-dm-controller";
import { logAppEvent } from "@/app/shared/log-app-event";
import type { PublicKeyHex } from "@dweb/crypto/public-key-hex";
import type { MessageActionFailureReason } from "../types";
import { deliveryDiagnosticsStore } from "../services/delivery-diagnostics-store";
import { reportSenderDeliveryIssue } from "../services/delivery-troubleshooting-reporter";

export interface QueueOrchestratorParams {
    messageQueue: MessageQueue | null;
    pool: RelayPool;
    getPool?: () => RelayPool;
    setState: React.Dispatch<React.SetStateAction<EnhancedDMControllerState>>;
    diagnostics?: Readonly<{
        transportOwnerId: string | null;
        controllerInstanceId: string;
    }>;
}

const getWritableRelays = (pool: RelayPool): ReadonlyArray<Readonly<{ url: string }>> => {
    if (typeof pool.getWritableRelaySnapshot === "function") {
        return pool.getWritableRelaySnapshot().writableRelayUrls.map((url) => ({ url }));
    }
    return pool.connections
        .filter((connection) => connection.status === "open")
        .map((connection) => ({ url: connection.url }));
};

const getSenderPublicKeyHex = (message: OutgoingMessage): PublicKeyHex | undefined => {
    const fromSignedEvent = message.signedEvent?.pubkey;
    if (typeof fromSignedEvent === "string" && fromSignedEvent.length === 64) {
        return fromSignedEvent as PublicKeyHex;
    }
    const fromOwner = message.ownerPubkey;
    if (typeof fromOwner === "string" && fromOwner.length === 64) {
        return fromOwner as PublicKeyHex;
    }
    return undefined;
};

const mapQueueReasonToFailureReason = (
    reasonCode?: QueueSendAttemptResult["reasonCode"]
): MessageActionFailureReason | "unknown" => {
    if (reasonCode === "no_writable_relays") return "no_active_relays";
    if (reasonCode === "quorum_not_met" || reasonCode === "relay_degraded") return "quorum_not_met";
    if (reasonCode === "storage_unavailable") return "storage_unavailable";
    if (!reasonCode || reasonCode === "missing_signed_event" || reasonCode === "max_retries_exceeded" || reasonCode === "unknown") {
        return "unknown";
    }
    return "publish_rejected";
};

const reportQueuedDeliveryOutcome = (
    message: OutgoingMessage,
    outcome: QueueSendAttemptResult
): void => {
    if (outcome.status === "accepted") {
        return;
    }

    const deliveryStatus = outcome.status === "retry_scheduled" ? "queued_retrying" : "failed";
    const reasonCode = outcome.reasonCode;
    const issueMessageId = message.signedEvent?.id ?? message.id;
    const error = outcome.error || (
        deliveryStatus === "failed"
            ? "Queued send failed and retry budget was exhausted."
            : "Queued send failed and was scheduled for retry."
    );

    deliveryDiagnosticsStore.markPublish({
        peerPublicKeyHex: message.recipientPubkey,
        eventId: issueMessageId,
        relayUrls: message.targetRelayUrls ?? [],
        deliveryStatus,
        success: false,
        successCount: outcome.relayOutcome?.successCount,
        totalRelays: outcome.relayOutcome?.totalRelays,
        reasonCode,
        error,
    });

    const senderPublicKeyHex = getSenderPublicKeyHex(message);
    if (!senderPublicKeyHex) {
        logAppEvent({
            name: "messaging.delivery.queue_issue_missing_sender",
            level: "warn",
            scope: { feature: "messaging", action: "queue_processing" },
            context: {
                messageId: issueMessageId.slice(0, 16),
                recipientPubkey: message.recipientPubkey.slice(0, 16),
                reasonCode: reasonCode ?? "unknown",
            },
        });
        return;
    }

    reportSenderDeliveryIssue({
        attemptPhase: "queue_retry",
        senderPublicKeyHex,
        recipientPublicKeyHex: message.recipientPubkey,
        messageId: issueMessageId,
        deliveryStatus,
        failureReason: mapQueueReasonToFailureReason(reasonCode),
        reasonCode,
        error,
        targetRelayUrls: message.targetRelayUrls ?? [],
        queueRetryCount: message.retryCount,
        nextRetryAtUnixMs: outcome.nextRetryAtUnixMs,
    });
};

const createSendQueuedMessage = (params: Readonly<{
    getPool: () => RelayPool;
    messageQueue: MessageQueue;
    setState: React.Dispatch<React.SetStateAction<EnhancedDMControllerState>>;
}>) => async (message: OutgoingMessage): Promise<QueueSendAttemptResult> => {
    const pool = params.getPool();
    const outcome = await publishQueuedOutgoingMessage({
        pool,
        messageQueue: params.messageQueue,
        message,
        openRelays: getWritableRelays(pool)
    });

    if (outcome.status === "accepted") {
        params.setState(prev => {
            const updatedMessages = prev.messages.map(m =>
                m.id === message.id ? { ...m, status: "accepted" as MessageStatus } : m
            );
            return createReadyState(updatedMessages);
        });
    } else {
        reportQueuedDeliveryOutcome(message, outcome);
    }

    return outcome;
};

/**
 * Manually process the offline queue
 */
export const processOfflineQueue = async (params: QueueOrchestratorParams): Promise<void> => {
    const { messageQueue, pool, setState } = params;
    if (!messageQueue) return;
    const sendQueuedMessage = createSendQueuedMessage({
        getPool: () => pool,
        messageQueue,
        setState,
    });

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
    const { messageQueue, pool, getPool, setState, diagnostics } = params;
    if (!messageQueue) return () => { };

    const resolvePool = getPool ?? (() => pool);
    const sendQueuedMessage = createSendQueuedMessage({
        getPool: resolvePool,
        messageQueue,
        setState,
    });

    offlineQueueManager.startAutoProcessing(
        () => messageQueue.getQueuedMessages(),
        sendQueuedMessage,
        (messageId) => messageQueue.removeFromQueue(messageId)
    );

    logAppEvent({
        name: "messaging.transport.queue_auto_processing_started",
        level: "info",
        scope: { feature: "messaging", action: "queue_processing" },
        context: {
            transportOwnerId: diagnostics?.transportOwnerId ?? "none",
            controllerInstanceId: diagnostics?.controllerInstanceId ?? "none",
        },
    });

    const unsubscribe = offlineQueueManager.subscribeToQueueStatus((queueStatus) => {
        setState(prev => ({
            ...prev,
            queueStatus
        }));
    });

    return () => {
        offlineQueueManager.stopAutoProcessing();
        unsubscribe();
        logAppEvent({
            name: "messaging.transport.queue_auto_processing_stopped",
            level: "info",
            scope: { feature: "messaging", action: "queue_processing" },
            context: {
                transportOwnerId: diagnostics?.transportOwnerId ?? "none",
                controllerInstanceId: diagnostics?.controllerInstanceId ?? "none",
            },
        });
    };
};
