/**
 * Offline Message Queue Manager
 * 
 * Implements:
 * - Queue messages when all relays are offline
 * - Automatically send queued messages when connectivity returns
 * - Handle storage errors with recovery mechanisms
 * 
 * Requirements: 4.4, 7.1, 7.2
 */

import type { OutgoingMessage } from "./message-queue";
import type { NostrEvent } from "@dweb/nostr/nostr-event";
import { errorHandler } from "./error-handler";

/**
 * Queue processing result
 */
export interface QueueProcessingResult {
  processed: number;
  succeeded: number;
  failed: number;
  errors: Array<{ messageId: string; error: string }>;
}

/**
 * Queue status
 */
export interface QueueStatus {
  totalQueued: number;
  oldestMessage?: Date;
  newestMessage?: Date;
  isProcessing: boolean;
}

/**
 * Offline queue manager class
 */
export class OfflineQueueManager {
  private isProcessing = false;
  private processingInterval?: NodeJS.Timeout;
  private listeners: Set<(status: QueueStatus) => void> = new Set();

  /**
   * Start automatic queue processing
   * Monitors network state and processes queue when online
   */
  startAutoProcessing(
    getQueuedMessages: () => Promise<OutgoingMessage[]>,
    sendMessage: (message: OutgoingMessage) => Promise<boolean>,
    removeFromQueue: (messageId: string) => Promise<void>
  ): void {
    // Subscribe to network changes
    errorHandler.subscribeToNetworkChanges((networkState) => {
      if (networkState.isOnline && networkState.hasRelayConnection && !this.isProcessing) {
        console.log('Network available, processing offline queue');
        void this.processQueue(getQueuedMessages, sendMessage, removeFromQueue);
      }
    });

    // Also check periodically (every 30 seconds)
    this.processingInterval = setInterval(() => {
      const networkState = errorHandler.getNetworkState();
      if (networkState.isOnline && networkState.hasRelayConnection && !this.isProcessing) {
        void this.processQueue(getQueuedMessages, sendMessage, removeFromQueue);
      }
    }, 30000);
  }

  /**
   * Stop automatic queue processing
   */
  stopAutoProcessing(): void {
    if (this.processingInterval) {
      clearInterval(this.processingInterval);
      this.processingInterval = undefined;
    }
  }

  /**
   * Process queued messages
   * Requirement 7.2: Automatically send queued messages when connectivity returns
   */
  async processQueue(
    getQueuedMessages: () => Promise<OutgoingMessage[]>,
    sendMessage: (message: OutgoingMessage) => Promise<boolean>,
    removeFromQueue: (messageId: string) => Promise<void>
  ): Promise<QueueProcessingResult> {
    // Check if already processing
    if (this.isProcessing) {
      console.log('Queue processing already in progress');
      return {
        processed: 0,
        succeeded: 0,
        failed: 0,
        errors: []
      };
    }

    // Check network state
    const networkCheck = errorHandler.canAttemptOperation();
    if (!networkCheck.canAttempt) {
      console.log('Cannot process queue:', networkCheck.reason);
      return {
        processed: 0,
        succeeded: 0,
        failed: 0,
        errors: []
      };
    }

    this.isProcessing = true;
    this.notifyListeners();

    const result: QueueProcessingResult = {
      processed: 0,
      succeeded: 0,
      failed: 0,
      errors: []
    };

    try {
      // Get queued messages
      const queuedMessages = await getQueuedMessages();
      
      if (queuedMessages.length === 0) {
        console.log('No messages in queue');
        return result;
      }

      console.log(`Processing ${queuedMessages.length} queued messages`);

      // Process messages sequentially to avoid overwhelming relays
      for (const message of queuedMessages) {
        result.processed++;

        try {
          // Attempt to send message
          const success = await sendMessage(message);

          if (success) {
            result.succeeded++;
            
            // Remove from queue on success
            try {
              await removeFromQueue(message.id);
            } catch (removeError) {
              console.error('Failed to remove message from queue:', removeError);
              // Continue processing even if removal fails
            }
          } else {
            result.failed++;
            result.errors.push({
              messageId: message.id,
              error: 'Send failed'
            });
          }
        } catch (error) {
          result.failed++;
          result.errors.push({
            messageId: message.id,
            error: error instanceof Error ? error.message : 'Unknown error'
          });
          console.error('Failed to process queued message:', error);
        }

        // Small delay between messages to avoid rate limiting
        await new Promise(resolve => setTimeout(resolve, 100));
      }

      console.log(`Queue processing complete: ${result.succeeded} succeeded, ${result.failed} failed`);

    } catch (error) {
      console.error('Queue processing error:', error);
      errorHandler.handleStorageError(
        error instanceof Error ? error : new Error('Queue processing failed'),
        { operation: 'processQueue' }
      );
    } finally {
      this.isProcessing = false;
      this.notifyListeners();
    }

    return result;
  }

  /**
   * Get current queue status
   */
  async getQueueStatus(
    getQueuedMessages: () => Promise<OutgoingMessage[]>
  ): Promise<QueueStatus> {
    try {
      const messages = await getQueuedMessages();
      
      if (messages.length === 0) {
        return {
          totalQueued: 0,
          isProcessing: this.isProcessing
        };
      }

      // Find oldest and newest messages
      let oldestMessage: Date | undefined;
      let newestMessage: Date | undefined;

      messages.forEach(msg => {
        if (!oldestMessage || msg.createdAt < oldestMessage) {
          oldestMessage = msg.createdAt;
        }
        if (!newestMessage || msg.createdAt > newestMessage) {
          newestMessage = msg.createdAt;
        }
      });

      return {
        totalQueued: messages.length,
        oldestMessage,
        newestMessage,
        isProcessing: this.isProcessing
      };
    } catch (error) {
      console.error('Failed to get queue status:', error);
      return {
        totalQueued: 0,
        isProcessing: this.isProcessing
      };
    }
  }

  /**
   * Subscribe to queue status changes
   */
  subscribeToQueueStatus(listener: (status: QueueStatus) => void): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  /**
   * Notify status listeners
   */
  private notifyListeners(): void {
    // We don't have the full status here, so listeners should call getQueueStatus
    // This just notifies that something changed
    this.listeners.forEach(listener => {
      try {
        listener({
          totalQueued: 0, // Placeholder
          isProcessing: this.isProcessing
        });
      } catch (error) {
        console.error('Error in queue status listener:', error);
      }
    });
  }

  /**
   * Manually trigger queue processing
   * Useful for user-initiated retry
   */
  async manualProcessQueue(
    getQueuedMessages: () => Promise<OutgoingMessage[]>,
    sendMessage: (message: OutgoingMessage) => Promise<boolean>,
    removeFromQueue: (messageId: string) => Promise<void>
  ): Promise<QueueProcessingResult> {
    return this.processQueue(getQueuedMessages, sendMessage, removeFromQueue);
  }

  /**
   * Clear all queued messages
   * Use with caution - this will delete all pending messages
   */
  async clearQueue(
    getQueuedMessages: () => Promise<OutgoingMessage[]>,
    removeFromQueue: (messageId: string) => Promise<void>
  ): Promise<number> {
    try {
      const messages = await getQueuedMessages();
      let cleared = 0;

      for (const message of messages) {
        try {
          await removeFromQueue(message.id);
          cleared++;
        } catch (error) {
          console.error('Failed to remove message from queue:', error);
        }
      }

      console.log(`Cleared ${cleared} messages from queue`);
      this.notifyListeners();
      
      return cleared;
    } catch (error) {
      console.error('Failed to clear queue:', error);
      return 0;
    }
  }

  /**
   * Cleanup
   */
  destroy(): void {
    this.stopAutoProcessing();
    this.listeners.clear();
  }
}

/**
 * Global offline queue manager instance
 */
export const offlineQueueManager = new OfflineQueueManager();
