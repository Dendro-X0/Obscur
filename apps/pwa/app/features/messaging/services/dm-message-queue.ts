/**
 * DM Message Queue
 *
 * Provides offline resilience and retry logic for unreliable relay conditions.
 * Works alongside the DM Ledger to ensure no messages are lost.
 *
 * Strategy:
 * 1. Messages are queued if all relays fail
 * 2. Retry with exponential backoff (respecting relay rate limits)
 * 3. Queue persists to localStorage for page reloads
 * 4. Ledger records intent immediately, queue handles delivery
 */

import type { PublicKeyHex } from "@dweb/crypto/public-key-hex";
import type { PrivateKeyHex } from "@dweb/crypto/private-key-hex";

export interface QueuedMessage {
  id: string;
  conversationId: string;
  recipientPubkey: PublicKeyHex;
  plaintext: string;
  senderPubkey: PublicKeyHex;
  senderPrivateKeyHex: PrivateKeyHex;
  customTags?: ReadonlyArray<ReadonlyArray<string>>;
  createdAtMs: number;
  attempts: number;
  lastAttemptMs: number;
  nextAttemptMs: number;
  error?: string;
}

const QUEUE_KEY = "dm_message_queue_v1";
const MAX_ATTEMPTS = 5;
const BASE_DELAY_MS = 2000; // 2 seconds
const MAX_DELAY_MS = 60000; // 1 minute

// In-memory queue (synced to localStorage)
let messageQueue: QueuedMessage[] = [];
let isProcessing = false;
let retryTimeout: ReturnType<typeof setTimeout> | null = null;

// Callback for actual send implementation
let sendImpl: ((msg: QueuedMessage) => Promise<{ success: boolean; error?: string }>) | null = null;

/**
 * Initialize the queue from localStorage
 */
export const initMessageQueue = (
  sendImplementation: (msg: QueuedMessage) => Promise<{ success: boolean; error?: string }>,
): void => {
  sendImpl = sendImplementation;

  try {
    const stored = localStorage.getItem(QUEUE_KEY);
    if (stored) {
      const parsed = JSON.parse(stored) as QueuedMessage[];
      // Only keep messages that haven't exceeded max attempts
      messageQueue = parsed.filter(m => m.attempts < MAX_ATTEMPTS);
      if (messageQueue.length > 0) {
        console.log("[dm-queue] loaded", messageQueue.length, "pending messages");
        scheduleRetry();
      }
    }
  } catch {
    // localStorage might be unavailable
  }
};

/**
 * Add a message to the queue
 */
export const queueMessage = (message: Omit<QueuedMessage, "attempts" | "lastAttemptMs" | "nextAttemptMs">): void => {
  const queued: QueuedMessage = {
    ...message,
    attempts: 0,
    lastAttemptMs: 0,
    nextAttemptMs: Date.now(),
  };

  messageQueue.push(queued);
  persistQueue();

  console.log("[dm-queue] message queued", { id: queued.id.slice(0, 16), queueLength: messageQueue.length });

  // Try to send immediately
  void processQueue();
};

/**
 * Check if a message is currently queued (pending send)
 */
export const isMessageQueued = (messageId: string): boolean => {
  return messageQueue.some(m => m.id === messageId);
};

/**
 * Get queue statistics (for diagnostics)
 */
export const getQueueStats = (): { pending: number; maxAttempts: number } => ({
  pending: messageQueue.length,
  maxAttempts: MAX_ATTEMPTS,
});

/**
 * Manually trigger queue processing (e.g., when relay comes online)
 */
export const triggerQueueProcessing = (): void => {
  void processQueue();
};

/**
 * Calculate next retry delay with exponential backoff
 */
const getRetryDelay = (attempt: number): number => {
  const delay = Math.min(BASE_DELAY_MS * Math.pow(2, attempt), MAX_DELAY_MS);
  // Add jitter to prevent thundering herd
  return delay + Math.random() * 1000;
};

/**
 * Process the message queue
 */
const processQueue = async (): Promise<void> => {
  if (isProcessing || !sendImpl) return;

  isProcessing = true;
  const now = Date.now();

  // Find messages ready to retry
  const readyMessages = messageQueue.filter(m => m.nextAttemptMs <= now);

  if (readyMessages.length === 0) {
    isProcessing = false;
    // Schedule next check if there are pending messages
    if (messageQueue.length > 0) {
      scheduleRetry();
    }
    return;
  }

  console.log("[dm-queue] processing", readyMessages.length, "messages");

  // Process each ready message
  const results = await Promise.allSettled(
    readyMessages.map(async (msg) => {
      const result = await sendImpl!(msg);
      return { msg, result };
    }),
  );

  // Update queue based on results
  results.forEach((res) => {
    if (res.status === "fulfilled") {
      const { msg, result } = res.value;
      const idx = messageQueue.findIndex(m => m.id === msg.id);

      if (idx === -1) return;

      if (result.success) {
        // Remove from queue on success
        console.log("[dm-queue] message sent successfully", { id: msg.id.slice(0, 16) });
        messageQueue.splice(idx, 1);
      } else {
        // Increment attempts and schedule retry
        const updated = messageQueue[idx];
        updated.attempts++;
        updated.lastAttemptMs = now;
        updated.error = result.error;

        if (updated.attempts >= MAX_ATTEMPTS) {
          console.warn("[dm-queue] max attempts reached, dropping message", {
            id: msg.id.slice(0, 16),
            error: result.error,
          });
          messageQueue.splice(idx, 1);
        } else {
          updated.nextAttemptMs = now + getRetryDelay(updated.attempts);
          console.log("[dm-queue] retry scheduled", {
            id: msg.id.slice(0, 16),
            attempt: updated.attempts,
            nextRetryMs: updated.nextAttemptMs - now,
          });
        }
      }
    }
  });

  persistQueue();
  isProcessing = false;

  // Schedule next retry if queue not empty
  if (messageQueue.length > 0) {
    scheduleRetry();
  }
};

/**
 * Schedule the next queue processing attempt
 */
const scheduleRetry = (): void => {
  if (retryTimeout) {
    clearTimeout(retryTimeout);
  }

  if (messageQueue.length === 0) return;

  // Find the soonest retry time
  const now = Date.now();
  const nextRetry = Math.min(...messageQueue.map(m => m.nextAttemptMs));
  const delay = Math.max(0, nextRetry - now);

  retryTimeout = setTimeout(() => {
    void processQueue();
  }, Math.min(delay, 30000)); // Cap at 30 seconds
};

/**
 * Persist queue to localStorage
 */
const persistQueue = (): void => {
  try {
    localStorage.setItem(QUEUE_KEY, JSON.stringify(messageQueue));
  } catch {
    // localStorage might be full or unavailable
  }
};

/**
 * Clear the entire queue (for testing or recovery)
 */
export const clearQueue = (): void => {
  messageQueue = [];
  if (retryTimeout) {
    clearTimeout(retryTimeout);
    retryTimeout = null;
  }
  persistQueue();
};
