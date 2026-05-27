/**
 * DM Send with Retry
 *
 * Wraps the base send pipeline with resilience features:
 * - Retry on relay failure with exponential backoff
 * - Queue for offline resilience
 * - Integration with DM Ledger for consistency
 *
 * This maximizes delivery probability with limited/unreliable relays.
 */

import type { PrivateKeyHex } from "@dweb/crypto/private-key-hex";
import type { PublicKeyHex } from "@dweb/crypto/public-key-hex";
import type { RelayPoolContract, SendResult } from "./dm-controller-types";
import { sendDm, type SendConfirmation } from "./dm-send-pipeline";
import { queueMessage, initMessageQueue, triggerQueueProcessing, getQueueStats } from "../../services/dm-message-queue";
import { recordDmMessage } from "../../dm-ledger";
import type { Message } from "../../types";
import { isBrowserOffline } from "@/app/features/runtime/offline-runtime-policy";

export interface SendWithRetryParams {
  pool: RelayPoolContract;
  senderPublicKeyHex: PublicKeyHex;
  senderPrivateKeyHex: PrivateKeyHex;
  recipientPublicKeyHex: PublicKeyHex;
  plaintext: string;
  conversationId: string;
  customTags?: ReadonlyArray<ReadonlyArray<string>>;
  onConfirmed?: (confirmation: SendConfirmation) => void;
}

export interface SendWithRetryResult extends SendResult {
  /** Whether the message is queued for retry (not immediately sent) */
  queued: boolean;
  /** If true, user should retry later or wait for auto-retry */
  needsRetry: boolean;
}

// Track if queue is initialized
let queueInitialized = false;

const resolveWritableRelayCount = (pool: RelayPoolContract): number | undefined => {
  const snapshot = pool.getWritableRelaySnapshot?.();
  if (!snapshot) {
    return undefined;
  }
  if (typeof snapshot.writableRelayCount === "number") {
    return snapshot.writableRelayCount;
  }
  if (Array.isArray(snapshot.writableRelayUrls)) {
    return snapshot.writableRelayUrls.length;
  }
  return undefined;
};

const shouldQueueBeforeSend = (pool: RelayPoolContract): boolean => {
  if (isBrowserOffline()) {
    return true;
  }
  const writableRelayCount = resolveWritableRelayCount(pool);
  return typeof writableRelayCount === "number" && writableRelayCount === 0;
};

const isRetryableTransportError = (error?: string): boolean => {
  const normalized = (error || "").toLowerCase();
  return normalized.includes("rate")
    || normalized.includes("limit")
    || normalized.includes("pow")
    || normalized.includes("slow")
    || normalized.includes("timeout")
    || normalized.includes("disconnect")
    || normalized.includes("network")
    || normalized.includes("no writable relay")
    || normalized.includes("writable relay");
};

const queueOutgoingForRetry = (
  params: Readonly<{
    optimisticId: string;
    conversationId: string;
    recipientPublicKeyHex: PublicKeyHex;
    plaintext: string;
    senderPublicKeyHex: PublicKeyHex;
    senderPrivateKeyHex: PrivateKeyHex;
    customTags?: ReadonlyArray<ReadonlyArray<string>>;
  }>,
  baseResult?: SendResult,
): SendWithRetryResult => {
  queueMessage({
    id: params.optimisticId,
    conversationId: params.conversationId,
    recipientPubkey: params.recipientPublicKeyHex,
    plaintext: params.plaintext,
    senderPubkey: params.senderPublicKeyHex,
    senderPrivateKeyHex: params.senderPrivateKeyHex,
    customTags: params.customTags,
    createdAtMs: Date.now(),
  });

  if (baseResult) {
    return {
      ...baseResult,
      queued: true,
      needsRetry: true,
      messageId: params.optimisticId,
    };
  }

  return {
    success: true,
    deliveryStatus: "queued_retrying",
    messageId: params.optimisticId,
    eventId: "",
    relayResults: [],
    queued: true,
    needsRetry: true,
  };
};

/**
 * Send a DM with automatic retry and queuing.
 *
 * Strategy:
 * 1. Try to send immediately
 * 2. If relay fails with "rate limit" or "timeout", queue for retry
 * 3. If relay fails with "invalid" or "rejected", fail immediately
 * 4. Record to ledger in all cases (intent is preserved)
 */
export const sendDmWithRetry = async (params: SendWithRetryParams): Promise<SendWithRetryResult> => {
  const {
    pool,
    senderPublicKeyHex,
    senderPrivateKeyHex,
    recipientPublicKeyHex,
    plaintext,
    conversationId,
    customTags,
    onConfirmed,
  } = params;

  // Initialize queue on first use
  if (!queueInitialized) {
    initMessageQueue(async (queued) => {
      const result = await sendDm({
        pool,
        senderPublicKeyHex: queued.senderPubkey,
        senderPrivateKeyHex: queued.senderPrivateKeyHex,
        recipientPublicKeyHex: queued.recipientPubkey,
        plaintext: queued.plaintext,
        customTags: queued.customTags,
      });
      return { success: result.success, error: result.error };
    });
    queueInitialized = true;
  }

  // Generate optimistic ID for ledger tracking
  const optimisticId = crypto.randomUUID();

  if (shouldQueueBeforeSend(pool)) {
    return queueOutgoingForRetry({
      optimisticId,
      conversationId,
      recipientPublicKeyHex,
      plaintext,
      senderPublicKeyHex,
      senderPrivateKeyHex,
      customTags,
    });
  }

  // Try immediate send first
  const sendStartTime = performance.now();
  const result = await sendDm({
    pool,
    senderPublicKeyHex,
    senderPrivateKeyHex,
    recipientPublicKeyHex,
    plaintext,
    customTags,
    onConfirmed: (confirmation) => {
      // Trigger queue processing on any successful confirmation
      // (relays might be recovering)
      if (confirmation.success) {
        triggerQueueProcessing();
      }
      onConfirmed?.(confirmation);
    },
  });

  const sendDuration = performance.now() - sendStartTime;

  // Record to ledger immediately (intent is canonical)
  // Even if send fails, we want the ledger to know we tried
  if (result.eventId || result.messageId) {
    void (async () => {
      try {
        await recordDmMessage({
          conversationId,
          message: {
            id: optimisticId,
            eventId: result.eventId || undefined,
            content: plaintext,
            timestamp: new Date(),
            isOutgoing: true,
            senderPubkey: senderPublicKeyHex,
            recipientPubkey: recipientPublicKeyHex,
            status: result.success ? "sending" : "failed",
            kind: "user",
            conversationId,
          } as unknown as Message, // Type compatible with ledger
          identityIds: [optimisticId, result.eventId, result.messageId].filter(Boolean) as string[],
          senderPubkey: senderPublicKeyHex,
          isOutgoing: true,
          source: "local_send",
        });
      } catch (err) {
        console.error("[dm-send-retry] ledger record error", err);
      }
    })();
  }

  const isRetryable = isRetryableTransportError(result.error) || sendDuration > 10_000;

  if (!result.success && isRetryable) {
    console.log("[dm-send-retry] queuing for retry", { error: result.error });
    return queueOutgoingForRetry({
      optimisticId,
      conversationId,
      recipientPublicKeyHex,
      plaintext,
      senderPublicKeyHex,
      senderPrivateKeyHex,
      customTags,
    }, result);
  }

  // Immediate result (success or non-retryable failure)
  return {
    ...result,
    queued: false,
    needsRetry: false,
  };
};

/**
 * Get retry queue statistics (for UI feedback)
 */
export const getRetryStats = (): { pending: number; hasQueued: boolean } => {
  const queueStats = getQueueStats();
  return {
    pending: queueStats.pending,
    hasQueued: queueStats.pending > 0,
  };
};

/**
 * Manually trigger retry of queued messages
 * Call this when user indicates "retry now" or when network recovers
 */
export const retryQueuedMessages = (): void => {
  triggerQueueProcessing();
};
