/**
 * Message Flow Debugger
 * 
 * Provides debugging utilities for analyzing message flow through the system.
 * Tracks message lifecycle events, relay interactions, and performance metrics.
 * 
 * Requirements: 5.8, 4.7
 */

import type { Message, MessageStatus } from './message-queue';
import type { NostrEvent } from '@dweb/nostr/nostr-event';

/**
 * Message lifecycle event types
 */
export type MessageLifecycleEvent =
  | 'created'
  | 'encrypted'
  | 'signed'
  | 'published'
  | 'relay_accepted'
  | 'relay_rejected'
  | 'queued'
  | 'retry_scheduled'
  | 'retry_attempted'
  | 'received'
  | 'decrypted'
  | 'persisted'
  | 'displayed'
  | 'failed';

/**
 * Message flow event
 */
export interface MessageFlowEvent {
  messageId: string;
  event: MessageLifecycleEvent;
  timestamp: Date;
  details?: Record<string, any>;
  relayUrl?: string;
  error?: string;
  duration?: number;
}

/**
 * Relay interaction record
 */
export interface RelayInteraction {
  relayUrl: string;
  messageId: string;
  action: 'publish' | 'subscribe' | 'receive' | 'ok' | 'error';
  timestamp: Date;
  success: boolean;
  latency?: number;
  error?: string;
}

/**
 * Message flow summary
 */
export interface MessageFlowSummary {
  messageId: string;
  conversationId: string;
  content: string;
  isOutgoing: boolean;
  status: MessageStatus;
  createdAt: Date;
  events: MessageFlowEvent[];
  relayInteractions: RelayInteraction[];
  totalDuration: number;
  encryptionTime?: number;
  signingTime?: number;
  publishTime?: number;
  decryptionTime?: number;
  errors: string[];
}

/**
 * System health metrics
 */
export interface SystemHealthMetrics {
  timestamp: Date;
  messagesInMemory: number;
  queuedMessages: number;
  activeSubscriptions: number;
  connectedRelays: number;
  totalRelays: number;
  averageLatency: number;
  successRate: number;
  errorRate: number;
  memoryUsage?: number;
}

/**
 * Message Flow Debugger Class
 */
class MessageFlowDebugger {
  private events: Map<string, MessageFlowEvent[]> = new Map();
  private relayInteractions: Map<string, RelayInteraction[]> = new Map();
  private performanceMarks: Map<string, number> = new Map();
  private enabled: boolean = false;
  private maxEventsPerMessage: number = 100;
  private maxMessages: number = 1000;

  /**
   * Enable debugging
   */
  enable(): void {
    this.enabled = true;
    console.log('[MessageFlowDebugger] Debugging enabled');
  }

  /**
   * Disable debugging
   */
  disable(): void {
    this.enabled = false;
    console.log('[MessageFlowDebugger] Debugging disabled');
  }

  /**
   * Check if debugging is enabled
   */
  isEnabled(): boolean {
    return this.enabled;
  }

  /**
   * Clear all debug data
   */
  clear(): void {
    this.events.clear();
    this.relayInteractions.clear();
    this.performanceMarks.clear();
    console.log('[MessageFlowDebugger] Debug data cleared');
  }

  /**
   * Track a message lifecycle event
   */
  trackEvent(
    messageId: string,
    event: MessageLifecycleEvent,
    details?: Record<string, any>,
    relayUrl?: string,
    error?: string
  ): void {
    if (!this.enabled) return;

    const flowEvent: MessageFlowEvent = {
      messageId,
      event,
      timestamp: new Date(),
      details,
      relayUrl,
      error
    };

    // Calculate duration if we have a start mark
    const markKey = `${messageId}:${event}:start`;
    if (this.performanceMarks.has(markKey)) {
      const startTime = this.performanceMarks.get(markKey)!;
      flowEvent.duration = Date.now() - startTime;
      this.performanceMarks.delete(markKey);
    }

    // Get or create events array for this message
    let messageEvents = this.events.get(messageId);
    if (!messageEvents) {
      messageEvents = [];
      this.events.set(messageId, messageEvents);
    }

    // Add event
    messageEvents.push(flowEvent);

    // Limit events per message
    if (messageEvents.length > this.maxEventsPerMessage) {
      messageEvents.shift();
    }

    // Limit total messages tracked
    if (this.events.size > this.maxMessages) {
      const oldestMessageId = this.events.keys().next().value;
      this.events.delete(oldestMessageId);
      this.relayInteractions.delete(oldestMessageId);
    }

    // Log event
    this.logEvent(flowEvent);
  }

  /**
   * Start tracking performance for an operation
   */
  startPerformanceTracking(messageId: string, operation: string): void {
    if (!this.enabled) return;
    const markKey = `${messageId}:${operation}:start`;
    this.performanceMarks.set(markKey, Date.now());
  }

  /**
   * End performance tracking and record duration
   */
  endPerformanceTracking(messageId: string, operation: string): number | undefined {
    if (!this.enabled) return undefined;
    
    const markKey = `${messageId}:${operation}:start`;
    const startTime = this.performanceMarks.get(markKey);
    
    if (startTime) {
      const duration = Date.now() - startTime;
      this.performanceMarks.delete(markKey);
      return duration;
    }
    
    return undefined;
  }

  /**
   * Track a relay interaction
   */
  trackRelayInteraction(
    messageId: string,
    relayUrl: string,
    action: RelayInteraction['action'],
    success: boolean,
    latency?: number,
    error?: string
  ): void {
    if (!this.enabled) return;

    const interaction: RelayInteraction = {
      relayUrl,
      messageId,
      action,
      timestamp: new Date(),
      success,
      latency,
      error
    };

    // Get or create interactions array for this message
    let messageInteractions = this.relayInteractions.get(messageId);
    if (!messageInteractions) {
      messageInteractions = [];
      this.relayInteractions.set(messageId, messageInteractions);
    }

    messageInteractions.push(interaction);

    // Log interaction
    this.logRelayInteraction(interaction);
  }

  /**
   * Get message flow summary
   */
  getMessageFlow(messageId: string): MessageFlowSummary | null {
    const events = this.events.get(messageId);
    const relayInteractions = this.relayInteractions.get(messageId) || [];

    if (!events || events.length === 0) {
      return null;
    }

    // Calculate durations
    const createdEvent = events.find(e => e.event === 'created');
    const encryptedEvent = events.find(e => e.event === 'encrypted');
    const signedEvent = events.find(e => e.event === 'signed');
    const publishedEvent = events.find(e => e.event === 'published');
    const decryptedEvent = events.find(e => e.event === 'decrypted');

    const encryptionTime = encryptedEvent?.duration;
    const signingTime = signedEvent?.duration;
    const publishTime = publishedEvent?.duration;
    const decryptionTime = decryptedEvent?.duration;

    // Calculate total duration
    const firstEvent = events[0];
    const lastEvent = events[events.length - 1];
    const totalDuration = lastEvent.timestamp.getTime() - firstEvent.timestamp.getTime();

    // Extract errors
    const errors = events
      .filter(e => e.error)
      .map(e => e.error!);

    // Determine status from events
    let status: MessageStatus = 'sending';
    if (events.some(e => e.event === 'failed')) {
      status = 'failed';
    } else if (events.some(e => e.event === 'relay_accepted')) {
      status = 'accepted';
    } else if (events.some(e => e.event === 'queued')) {
      status = 'queued';
    } else if (events.some(e => e.event === 'relay_rejected')) {
      status = 'rejected';
    }

    return {
      messageId,
      conversationId: events[0].details?.conversationId || 'unknown',
      content: events[0].details?.content || '',
      isOutgoing: events[0].details?.isOutgoing || false,
      status,
      createdAt: firstEvent.timestamp,
      events,
      relayInteractions,
      totalDuration,
      encryptionTime,
      signingTime,
      publishTime,
      decryptionTime,
      errors
    };
  }

  /**
   * Get all tracked message IDs
   */
  getTrackedMessageIds(): string[] {
    return Array.from(this.events.keys());
  }

  /**
   * Get recent message flows
   */
  getRecentFlows(limit: number = 10): MessageFlowSummary[] {
    const messageIds = this.getTrackedMessageIds();
    const recentIds = messageIds.slice(-limit);
    
    return recentIds
      .map(id => this.getMessageFlow(id))
      .filter((flow): flow is MessageFlowSummary => flow !== null);
  }

  /**
   * Get relay performance statistics
   */
  getRelayStats(): Map<string, {
    totalInteractions: number;
    successCount: number;
    failureCount: number;
    averageLatency: number;
    successRate: number;
  }> {
    const stats = new Map<string, {
      totalInteractions: number;
      successCount: number;
      failureCount: number;
      averageLatency: number;
      successRate: number;
    }>();

    // Aggregate all relay interactions
    for (const interactions of this.relayInteractions.values()) {
      for (const interaction of interactions) {
        const relayUrl = interaction.relayUrl;
        
        if (!stats.has(relayUrl)) {
          stats.set(relayUrl, {
            totalInteractions: 0,
            successCount: 0,
            failureCount: 0,
            averageLatency: 0,
            successRate: 0
          });
        }

        const relayStat = stats.get(relayUrl)!;
        relayStat.totalInteractions++;
        
        if (interaction.success) {
          relayStat.successCount++;
        } else {
          relayStat.failureCount++;
        }

        if (interaction.latency) {
          // Update running average
          const prevAvg = relayStat.averageLatency;
          const count = relayStat.successCount;
          relayStat.averageLatency = (prevAvg * (count - 1) + interaction.latency) / count;
        }
      }
    }

    // Calculate success rates
    for (const [relayUrl, stat] of stats.entries()) {
      stat.successRate = stat.totalInteractions > 0
        ? stat.successCount / stat.totalInteractions
        : 0;
    }

    return stats;
  }

  /**
   * Export debug data as JSON
   */
  exportDebugData(): string {
    const data = {
      timestamp: new Date().toISOString(),
      messages: this.getTrackedMessageIds().map(id => this.getMessageFlow(id)),
      relayStats: Object.fromEntries(this.getRelayStats()),
      summary: {
        totalMessages: this.events.size,
        totalRelayInteractions: Array.from(this.relayInteractions.values())
          .reduce((sum, interactions) => sum + interactions.length, 0)
      }
    };

    return JSON.stringify(data, null, 2);
  }

  /**
   * Log event to console
   */
  private logEvent(event: MessageFlowEvent): void {
    const timestamp = event.timestamp.toISOString();
    const duration = event.duration ? ` (${event.duration}ms)` : '';
    const relay = event.relayUrl ? ` [${event.relayUrl}]` : '';
    const error = event.error ? ` ERROR: ${event.error}` : '';
    
    console.log(
      `[MessageFlow] ${timestamp} | ${event.messageId.substring(0, 8)} | ${event.event}${relay}${duration}${error}`
    );
  }

  /**
   * Log relay interaction to console
   */
  private logRelayInteraction(interaction: RelayInteraction): void {
    const timestamp = interaction.timestamp.toISOString();
    const status = interaction.success ? '✓' : '✗';
    const latency = interaction.latency ? ` (${interaction.latency}ms)` : '';
    const error = interaction.error ? ` ERROR: ${interaction.error}` : '';
    
    console.log(
      `[RelayInteraction] ${timestamp} | ${status} | ${interaction.relayUrl} | ${interaction.action}${latency}${error}`
    );
  }
}

// Export singleton instance
export const messageFlowDebugger = new MessageFlowDebugger();

// Expose to window for browser console access
if (typeof window !== 'undefined') {
  (window as any).messageFlowDebugger = messageFlowDebugger;
}
