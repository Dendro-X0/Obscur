/**
 * DM Message Queue
 *
 * Browser-degraded offline retry for Nostr send paths.
 * Cut 1.3 (K-OUTBOX-LS): native must NOT persist plaintext + private keys to
 * `dm_message_queue_v1` — kernel SQLite outbox / T3 prepare→ACK owns retries.
 */

import type { PublicKeyHex } from "@dweb/crypto/public-key-hex";
import type { PrivateKeyHex } from "@dweb/crypto/private-key-hex";
import { requiresSqlitePersistence } from "@/app/features/runtime/native-persistence-policy";

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

/** Product localStorage key — banned on native (Cut 1.3). */
export const DM_MESSAGE_QUEUE_STORAGE_KEY = "dm_message_queue_v1";

const QUEUE_KEY = DM_MESSAGE_QUEUE_STORAGE_KEY;
const MAX_ATTEMPTS = 5;
const BASE_DELAY_MS = 2000; // 2 seconds
const MAX_DELAY_MS = 60000; // 1 minute

/** True when kernel outbox owns durable retries — LS queue must not run. */
export const usesKernelOutboxAuthority = (): boolean => requiresSqlitePersistence();

// In-memory queue (synced to localStorage on browser only)
let messageQueue: QueuedMessage[] = [];
let isProcessing = false;
let retryTimeout: ReturnType<typeof setTimeout> | null = null;

// Callback for actual send implementation
let sendImpl: ((msg: QueuedMessage) => Promise<{ success: boolean; error?: string }>) | null = null;

const scrubLegacyQueueKey = (): void => {
  if (typeof localStorage === "undefined") {
    return;
  }
  try {
    localStorage.removeItem(QUEUE_KEY);
  } catch {
    // ignore
  }
};

/**
 * Initialize the queue from localStorage (browser only).
 * Native: scrub residual secrets; never hydrate from LS.
 */
export const initMessageQueue = (
  sendImplementation: (msg: QueuedMessage) => Promise<{ success: boolean; error?: string }>,
): void => {
  sendImpl = sendImplementation;

  if (usesKernelOutboxAuthority()) {
    messageQueue = [];
    scrubLegacyQueueKey();
    return;
  }

  try {
    const stored = localStorage.getItem(QUEUE_KEY);
    if (stored) {
      const parsed = JSON.parse(stored) as QueuedMessage[];
      // Only keep messages that haven't exceeded max attempts
      messageQueue = parsed.filter((m) => m.attempts < MAX_ATTEMPTS);
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
 * Add a message to the queue (browser degraded only).
 * Native: refuse — would retain plaintext + private key (Cut 1.3).
 */
export const queueMessage = (
  message: Omit<QueuedMessage, "attempts" | "lastAttemptMs" | "nextAttemptMs">,
): void => {
  if (usesKernelOutboxAuthority()) {
    scrubLegacyQueueKey();
    console.warn("[dm-queue] queueMessage refused on native — kernel outbox owns retries (Cut 1.3)");
    return;
  }

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
  return messageQueue.some((m) => m.id === messageId);
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
  if (usesKernelOutboxAuthority()) {
    return;
  }
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
  if (usesKernelOutboxAuthority() || isProcessing || !sendImpl) return;

  isProcessing = true;
  const now = Date.now();

  // Find messages ready to retry
  const readyMessages = messageQueue.filter((m) => m.nextAttemptMs <= now);

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
      const idx = messageQueue.findIndex((m) => m.id === msg.id);

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
  if (usesKernelOutboxAuthority()) {
    return;
  }
  if (retryTimeout) {
    clearTimeout(retryTimeout);
  }

  if (messageQueue.length === 0) return;

  // Find the soonest retry time
  const now = Date.now();
  const nextRetry = Math.min(...messageQueue.map((m) => m.nextAttemptMs));
  const delay = Math.max(0, nextRetry - now);

  retryTimeout = setTimeout(() => {
    void processQueue();
  }, Math.min(delay, 30000)); // Cap at 30 seconds
};

/**
 * Persist queue to localStorage (browser only — never on native).
 */
const persistQueue = (): void => {
  if (usesKernelOutboxAuthority()) {
    scrubLegacyQueueKey();
    return;
  }
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
  if (usesKernelOutboxAuthority()) {
    scrubLegacyQueueKey();
    return;
  }
  persistQueue();
};

/** Test seam — inspect whether LS persist would be attempted. */
export const dmMessageQueueInternals = {
  QUEUE_KEY,
  persistQueue,
  scrubLegacyQueueKey,
  getMessageQueueLength: (): number => messageQueue.length,
};
