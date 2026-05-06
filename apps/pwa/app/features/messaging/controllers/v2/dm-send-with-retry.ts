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

  // Analyze result
  const isRateLimitError = result.error?.toLowerCase().includes("rate") ||
                           result.error?.toLowerCase().includes("limit") ||
                           result.error?.toLowerCase().includes("pow") ||
                           result.error?.toLowerCase().includes("slow");

  const isNetworkError = result.error?.toLowerCase().includes("timeout") ||
                         result.error?.toLowerCase().includes("disconnect") ||
                         result.error?.toLowerCase().includes("network") ||
                         sendDuration > 10000; // > 10 seconds is effectively a timeout

  const isRetryable = isRateLimitError || isNetworkError;

  // If retryable failure, queue for later
  if (!result.success && isRetryable) {
    console.log("[dm-send-retry] queuing for retry", {
      error: result.error,
      isRateLimit: isRateLimitError,
      isNetwork: isNetworkError,
    });

    queueMessage({
      id: optimisticId,
      conversationId,
      recipientPubkey: recipientPublicKeyHex,
      plaintext,
      senderPubkey: senderPublicKeyHex,
      senderPrivateKeyHex,
      customTags,
      createdAtMs: Date.now(),
    });

    return {
      ...result,
      queued: true,
      needsRetry: true,
      messageId: optimisticId,
    };
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
