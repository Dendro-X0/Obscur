/**
 * Performance Optimizer for Messaging System
 * 
 * Implements:
 * - Message batching for multiple operations (Requirement 8.3)
 * - Efficient memory management for large conversations (Requirement 8.5)
 * - WebSocket usage optimization for battery efficiency (Requirement 8.6)
 */

import type { Message } from "./message-queue";

/**
 * Batch operation types
 */
type BatchOperation = 
  | { type: 'persist'; message: Message }
  | { type: 'updateStatus'; messageId: string; status: string }
  | { type: 'markSynced'; messageIds: string[] };

/**
 * Batch configuration
 */
interface BatchConfig {
  maxBatchSize: number;
  maxWaitTimeMs: number;
}

/**
 * Memory management configuration
 */
interface MemoryConfig {
  maxMessagesInMemory: number;
  unloadThreshold: number;
  conversationCacheSize: number;
}

/**
 * WebSocket optimization configuration
 */
interface WebSocketConfig {
  heartbeatIntervalMs: number;
  idleTimeoutMs: number;
  batchPublishDelayMs: number;
}

/**
 * Message Batch Processor
 * Batches multiple message operations to reduce storage I/O
 * Requirement 8.3: Batch multiple message operations to improve performance
 */
export class MessageBatchProcessor {
  private pendingOperations: BatchOperation[] = [];
  private batchTimer: NodeJS.Timeout | null = null;
  private config: BatchConfig;
  private isProcessing = false;

  constructor(config: Partial<BatchConfig> = {}) {
    this.config = {
      maxBatchSize: config.maxBatchSize || 10,
      maxWaitTimeMs: config.maxWaitTimeMs || 100
    };
  }

  /**
   * Add operation to batch
   */
  addOperation(operation: BatchOperation): Promise<void> {
    return new Promise((resolve, reject) => {
      this.pendingOperations.push(operation);

      // If batch is full, process immediately
      if (this.pendingOperations.length >= this.config.maxBatchSize) {
        this.processBatch().then(resolve).catch(reject);
        return;
      }

      // Otherwise, schedule batch processing
      if (!this.batchTimer) {
        this.batchTimer = setTimeout(() => {
          this.processBatch().then(resolve).catch(reject);
        }, this.config.maxWaitTimeMs);
      }
    });
  }

  /**
   * Process pending batch
   */
  private async processBatch(): Promise<void> {
    if (this.isProcessing || this.pendingOperations.length === 0) {
      return;
    }

    this.isProcessing = true;

    // Clear timer
    if (this.batchTimer) {
      clearTimeout(this.batchTimer);
      this.batchTimer = null;
    }

    // Get operations to process
    const operations = [...this.pendingOperations];
    this.pendingOperations = [];

    try {
      // Group operations by type for efficient processing
      const persistOps = operations.filter(op => op.type === 'persist') as Array<{ type: 'persist'; message: Message }>;
      const statusOps = operations.filter(op => op.type === 'updateStatus') as Array<{ type: 'updateStatus'; messageId: string; status: string }>;
      const syncOps = operations.filter(op => op.type === 'markSynced') as Array<{ type: 'markSynced'; messageIds: string[] }>;

      // Process each type in batch
      if (persistOps.length > 0) {
        await this.batchPersist(persistOps.map(op => op.message));
      }

      if (statusOps.length > 0) {
        await this.batchUpdateStatus(statusOps);
      }

      if (syncOps.length > 0) {
        await this.batchMarkSynced(syncOps);
      }

      console.log(`Processed batch: ${operations.length} operations`);
    } catch (error) {
      console.error('Batch processing failed:', error);
      throw error;
    } finally {
      this.isProcessing = false;
    }
  }

  /**
   * Batch persist messages
   */
  private async batchPersist(messages: Message[]): Promise<void> {
    // In a real implementation, this would use a transaction or bulk insert
    // For now, we'll just log the batch size
    console.log(`Batch persisting ${messages.length} messages`);
    
    // Actual persistence would happen here
    // This is a placeholder for the batching logic
  }

  /**
   * Batch update message statuses
   */
  private async batchUpdateStatus(updates: Array<{ messageId: string; status: string }>): Promise<void> {
    console.log(`Batch updating ${updates.length} message statuses`);
    
    // Actual status updates would happen here
    // This is a placeholder for the batching logic
  }

  /**
   * Batch mark messages as synced
   */
  private async batchMarkSynced(operations: Array<{ messageIds: string[] }>): Promise<void> {
    const allMessageIds = operations.flatMap(op => op.messageIds);
    console.log(`Batch marking ${allMessageIds.length} messages as synced`);
    
    // Actual sync marking would happen here
    // This is a placeholder for the batching logic
  }

  /**
   * Force process any pending operations
   */
  async flush(): Promise<void> {
    if (this.batchTimer) {
      clearTimeout(this.batchTimer);
      this.batchTimer = null;
    }
    await this.processBatch();
  }
}

/**
 * Memory Manager for Large Conversations
 * Manages message memory usage by unloading old messages
 * Requirement 8.5: Limit memory usage by unloading old messages from active memory
 */
export class MessageMemoryManager {
  private config: MemoryConfig;
  private conversationCache: Map<string, Message[]> = new Map();
  private accessTimestamps: Map<string, number> = new Map();

  constructor(config: Partial<MemoryConfig> = {}) {
    this.config = {
      maxMessagesInMemory: config.maxMessagesInMemory || 200,
      unloadThreshold: config.unloadThreshold || 150,
      conversationCacheSize: config.conversationCacheSize || 5
    };
  }

  /**
   * Add messages to memory cache
   */
  addMessages(conversationId: string, messages: Message[]): void {
    // Update access timestamp
    this.accessTimestamps.set(conversationId, Date.now());

    // Get existing messages or create new array
    const existing = this.conversationCache.get(conversationId) || [];
    
    // Merge and deduplicate
    const merged = this.mergeMessages(existing, messages);
    
    // Store in cache
    this.conversationCache.set(conversationId, merged);

    // Check if we need to unload
    this.checkMemoryUsage();
  }

  /**
   * Get messages from memory cache
   */
  getMessages(conversationId: string): Message[] | null {
    // Update access timestamp
    this.accessTimestamps.set(conversationId, Date.now());
    
    return this.conversationCache.get(conversationId) || null;
  }

  /**
   * Remove conversation from memory
   */
  unloadConversation(conversationId: string): void {
    this.conversationCache.delete(conversationId);
    this.accessTimestamps.delete(conversationId);
    console.log(`Unloaded conversation ${conversationId} from memory`);
  }

  /**
   * Check memory usage and unload if needed
   */
  private checkMemoryUsage(): void {
    // Count total messages in memory
    let totalMessages = 0;
    for (const messages of this.conversationCache.values()) {
      totalMessages += messages.length;
    }

    // If over threshold, unload least recently used conversations
    if (totalMessages > this.config.unloadThreshold) {
      this.unloadLeastRecentlyUsed();
    }

    // Also enforce conversation cache size limit
    if (this.conversationCache.size > this.config.conversationCacheSize) {
      this.unloadLeastRecentlyUsed();
    }
  }

  /**
   * Unload least recently used conversations
   */
  private unloadLeastRecentlyUsed(): void {
    // Sort conversations by access time
    const sorted = Array.from(this.accessTimestamps.entries())
      .sort((a, b) => a[1] - b[1]); // Oldest first

    // Unload oldest conversations until we're under limits
    let totalMessages = 0;
    for (const messages of this.conversationCache.values()) {
      totalMessages += messages.length;
    }

    for (const [conversationId] of sorted) {
      if (totalMessages <= this.config.maxMessagesInMemory && 
          this.conversationCache.size <= this.config.conversationCacheSize) {
        break;
      }

      const messages = this.conversationCache.get(conversationId);
      if (messages) {
        totalMessages -= messages.length;
        this.unloadConversation(conversationId);
      }
    }
  }

  /**
   * Merge messages and deduplicate
   */
  private mergeMessages(existing: Message[], newMessages: Message[]): Message[] {
    const messageMap = new Map<string, Message>();

    // Add existing messages
    for (const msg of existing) {
      messageMap.set(msg.id, msg);
    }

    // Add new messages (will overwrite if duplicate)
    for (const msg of newMessages) {
      messageMap.set(msg.id, msg);
    }

    // Convert back to array and sort by timestamp
    return Array.from(messageMap.values())
      .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())
      .slice(0, this.config.maxMessagesInMemory);
  }

  /**
   * Get memory usage statistics
   */
  getMemoryStats(): {
    totalMessages: number;
    conversationCount: number;
    averageMessagesPerConversation: number;
  } {
    let totalMessages = 0;
    for (const messages of this.conversationCache.values()) {
      totalMessages += messages.length;
    }

    const conversationCount = this.conversationCache.size;
    const averageMessagesPerConversation = conversationCount > 0 
      ? totalMessages / conversationCount 
      : 0;

    return {
      totalMessages,
      conversationCount,
      averageMessagesPerConversation
    };
  }

  /**
   * Clear all cached messages
   */
  clear(): void {
    this.conversationCache.clear();
    this.accessTimestamps.clear();
  }
}

/**
 * WebSocket Optimizer for Battery Efficiency
 * Optimizes WebSocket usage to minimize battery drain
 * Requirement 8.6: Use WebSocket connections efficiently to minimize battery drain
 */
export class WebSocketOptimizer {
  private config: WebSocketConfig;
  private lastActivityTime: Map<string, number> = new Map();
  private heartbeatTimers: Map<string, NodeJS.Timeout> = new Map();
  private pendingPublishes: Map<string, string[]> = new Map();
  private publishTimers: Map<string, NodeJS.Timeout> = new Map();

  constructor(config: Partial<WebSocketConfig> = {}) {
    this.config = {
      heartbeatIntervalMs: config.heartbeatIntervalMs || 30000, // 30 seconds
      idleTimeoutMs: config.idleTimeoutMs || 60000, // 1 minute
      batchPublishDelayMs: config.batchPublishDelayMs || 50 // 50ms
    };
  }

  /**
   * Register WebSocket activity
   */
  registerActivity(relayUrl: string): void {
    this.lastActivityTime.set(relayUrl, Date.now());
  }

  /**
   * Check if relay is idle
   */
  isIdle(relayUrl: string): boolean {
    const lastActivity = this.lastActivityTime.get(relayUrl);
    if (!lastActivity) return true;

    return Date.now() - lastActivity > this.config.idleTimeoutMs;
  }

  /**
   * Start heartbeat for a relay
   * Sends periodic pings to keep connection alive efficiently
   */
  startHeartbeat(relayUrl: string, sendPing: () => void): void {
    // Clear existing heartbeat
    this.stopHeartbeat(relayUrl);

    // Start new heartbeat
    const timer = setInterval(() => {
      // Only send ping if relay has been idle
      if (this.isIdle(relayUrl)) {
        sendPing();
        this.registerActivity(relayUrl);
      }
    }, this.config.heartbeatIntervalMs);

    this.heartbeatTimers.set(relayUrl, timer);
  }

  /**
   * Stop heartbeat for a relay
   */
  stopHeartbeat(relayUrl: string): void {
    const timer = this.heartbeatTimers.get(relayUrl);
    if (timer) {
      clearInterval(timer);
      this.heartbeatTimers.delete(relayUrl);
    }
  }

  /**
   * Batch publish messages to reduce WebSocket writes
   * Collects multiple publishes and sends them together
   */
  batchPublish(relayUrl: string, payload: string, sendFn: (payloads: string[]) => void): void {
    // Add to pending publishes
    const pending = this.pendingPublishes.get(relayUrl) || [];
    pending.push(payload);
    this.pendingPublishes.set(relayUrl, pending);

    // Clear existing timer
    const existingTimer = this.publishTimers.get(relayUrl);
    if (existingTimer) {
      clearTimeout(existingTimer);
    }

    // Set new timer to batch publishes
    const timer = setTimeout(() => {
      const payloads = this.pendingPublishes.get(relayUrl) || [];
      if (payloads.length > 0) {
        sendFn(payloads);
        this.pendingPublishes.delete(relayUrl);
        this.publishTimers.delete(relayUrl);
        this.registerActivity(relayUrl);
      }
    }, this.config.batchPublishDelayMs);

    this.publishTimers.set(relayUrl, timer);
  }

  /**
   * Flush pending publishes immediately
   */
  flushPublishes(relayUrl: string, sendFn: (payloads: string[]) => void): void {
    const timer = this.publishTimers.get(relayUrl);
    if (timer) {
      clearTimeout(timer);
      this.publishTimers.delete(relayUrl);
    }

    const payloads = this.pendingPublishes.get(relayUrl) || [];
    if (payloads.length > 0) {
      sendFn(payloads);
      this.pendingPublishes.delete(relayUrl);
      this.registerActivity(relayUrl);
    }
  }

  /**
   * Clean up resources for a relay
   */
  cleanup(relayUrl: string): void {
    this.stopHeartbeat(relayUrl);
    
    const timer = this.publishTimers.get(relayUrl);
    if (timer) {
      clearTimeout(timer);
      this.publishTimers.delete(relayUrl);
    }

    this.pendingPublishes.delete(relayUrl);
    this.lastActivityTime.delete(relayUrl);
  }

  /**
   * Clean up all resources
   */
  cleanupAll(): void {
    for (const relayUrl of this.heartbeatTimers.keys()) {
      this.cleanup(relayUrl);
    }
  }
}

/**
 * Global performance optimizer instances
 */
export const messageBatchProcessor = new MessageBatchProcessor();
export const messageMemoryManager = new MessageMemoryManager();
export const webSocketOptimizer = new WebSocketOptimizer();
