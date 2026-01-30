/**
 * Retry Manager for Obscur
 * 
 * Handles retry logic for failed message operations including:
 * - Exponential backoff scheduling
 * - Circuit breaker pattern for failing relays
 * - Retry queue management
 * - Failure tracking and recovery
 */

import type { OutgoingMessage } from './message-queue';

/**
 * Retry configuration
 */
export interface RetryConfig {
  maxRetries: number;
  baseDelayMs: number;
  maxDelayMs: number;
  backoffMultiplier: number;
  jitterMs: number;
}

/**
 * Circuit breaker state
 */
export type CircuitBreakerState = 'closed' | 'open' | 'half-open';

/**
 * Circuit breaker for relay failures
 */
export interface CircuitBreaker {
  relayUrl: string;
  state: CircuitBreakerState;
  failureCount: number;
  lastFailureAt?: Date;
  nextRetryAt?: Date;
  successCount: number;
}

/**
 * Retry attempt result
 */
export interface RetryResult {
  success: boolean;
  shouldRetry: boolean;
  nextRetryAt?: Date;
  error?: string;
}

/**
 * Default retry configuration
 */
const DEFAULT_RETRY_CONFIG: RetryConfig = {
  maxRetries: 5,
  baseDelayMs: 1000,      // 1 second
  maxDelayMs: 300000,     // 5 minutes
  backoffMultiplier: 2,
  jitterMs: 1000          // ±1 second jitter
};

/**
 * Circuit breaker configuration
 */
const CIRCUIT_BREAKER_CONFIG = {
  failureThreshold: 5,
  recoveryTimeMs: 60000,    // 1 minute
  halfOpenSuccessThreshold: 3
};

/**
 * Retry Manager implementation
 */
export class RetryManager {
  private readonly config: RetryConfig;
  private readonly circuitBreakers: Map<string, CircuitBreaker>;
  private retryTimeouts: Map<string, NodeJS.Timeout>;

  constructor(config?: Partial<RetryConfig>) {
    this.config = { ...DEFAULT_RETRY_CONFIG, ...config };
    this.circuitBreakers = new Map();
    this.retryTimeouts = new Map();
  }

  /**
   * Calculate next retry time with exponential backoff
   */
  calculateNextRetry(retryCount: number, baseTime: Date = new Date()): Date {
    const delay = Math.min(
      this.config.baseDelayMs * Math.pow(this.config.backoffMultiplier, retryCount),
      this.config.maxDelayMs
    );

    // Add jitter to prevent thundering herd
    const jitter = (Math.random() - 0.5) * 2 * this.config.jitterMs;
    const totalDelay = delay + jitter;

    return new Date(baseTime.getTime() + Math.max(0, totalDelay));
  }

  /**
   * Determine if a message should be retried
   */
  shouldRetry(message: OutgoingMessage, error?: string): RetryResult {
    // Check if we've exceeded max retries
    if (message.retryCount >= this.config.maxRetries) {
      return {
        success: false,
        shouldRetry: false,
        error: `Max retries (${this.config.maxRetries}) exceeded`
      };
    }

    // Check circuit breakers for all relays
    const allRelaysBlocked = this.areAllRelaysBlocked();
    if (allRelaysBlocked) {
      // If all relays are blocked, wait for the earliest recovery time
      const earliestRecovery = this.getEarliestRecoveryTime();
      return {
        success: false,
        shouldRetry: true,
        nextRetryAt: earliestRecovery || this.calculateNextRetry(message.retryCount)
      };
    }

    // Calculate next retry time
    const nextRetryAt = this.calculateNextRetry(message.retryCount);

    return {
      success: false,
      shouldRetry: true,
      nextRetryAt,
      error
    };
  }

  /**
   * Record a relay failure
   */
  recordRelayFailure(relayUrl: string, error?: string): void {
    let breaker = this.circuitBreakers.get(relayUrl);
    
    if (!breaker) {
      breaker = {
        relayUrl,
        state: 'closed',
        failureCount: 0,
        successCount: 0
      };
      this.circuitBreakers.set(relayUrl, breaker);
    }

    breaker.failureCount++;
    breaker.lastFailureAt = new Date();
    breaker.successCount = 0; // Reset success count on failure

    // Check if we should open the circuit breaker
    if (breaker.failureCount >= CIRCUIT_BREAKER_CONFIG.failureThreshold) {
      breaker.state = 'open';
      breaker.nextRetryAt = new Date(
        Date.now() + CIRCUIT_BREAKER_CONFIG.recoveryTimeMs
      );
      
      console.warn(`Circuit breaker opened for relay ${relayUrl} after ${breaker.failureCount} failures`);
    }
  }

  /**
   * Record a relay success
   */
  recordRelaySuccess(relayUrl: string): void {
    let breaker = this.circuitBreakers.get(relayUrl);
    
    if (!breaker) {
      breaker = {
        relayUrl,
        state: 'closed',
        failureCount: 0,
        successCount: 0
      };
      this.circuitBreakers.set(relayUrl, breaker);
    }

    breaker.successCount++;
    
    if (breaker.state === 'half-open') {
      // Check if we should close the circuit breaker
      if (breaker.successCount >= CIRCUIT_BREAKER_CONFIG.halfOpenSuccessThreshold) {
        breaker.state = 'closed';
        breaker.failureCount = 0;
        breaker.nextRetryAt = undefined;
        
        console.info(`Circuit breaker closed for relay ${relayUrl} after ${breaker.successCount} successes`);
      }
    } else if (breaker.state === 'closed') {
      // Reset failure count on success
      breaker.failureCount = Math.max(0, breaker.failureCount - 1);
    }
  }

  /**
   * Check if a relay is available (circuit breaker allows requests)
   */
  isRelayAvailable(relayUrl: string): boolean {
    const breaker = this.circuitBreakers.get(relayUrl);
    
    if (!breaker || breaker.state === 'closed') {
      return true;
    }

    if (breaker.state === 'open') {
      // Check if it's time to try again (half-open)
      if (breaker.nextRetryAt && new Date() >= breaker.nextRetryAt) {
        breaker.state = 'half-open';
        breaker.successCount = 0;
        console.info(`Circuit breaker half-opened for relay ${relayUrl}`);
        return true;
      }
      return false;
    }

    // half-open state - allow limited requests
    return true;
  }

  /**
   * Get available relays (not blocked by circuit breakers)
   */
  getAvailableRelays(allRelayUrls: string[]): string[] {
    return allRelayUrls.filter(url => this.isRelayAvailable(url));
  }

  /**
   * Schedule a retry for a message
   */
  scheduleRetry(
    messageId: string, 
    retryAt: Date, 
    retryCallback: () => Promise<void>
  ): void {
    // Clear any existing timeout
    const existingTimeout = this.retryTimeouts.get(messageId);
    if (existingTimeout) {
      clearTimeout(existingTimeout);
    }

    const delay = retryAt.getTime() - Date.now();
    
    if (delay <= 0) {
      // Retry immediately
      void retryCallback();
      return;
    }

    const timeout = setTimeout(async () => {
      this.retryTimeouts.delete(messageId);
      try {
        await retryCallback();
      } catch (error) {
        console.error(`Retry callback failed for message ${messageId}:`, error);
      }
    }, delay);

    this.retryTimeouts.set(messageId, timeout);
  }

  /**
   * Cancel a scheduled retry
   */
  cancelRetry(messageId: string): void {
    const timeout = this.retryTimeouts.get(messageId);
    if (timeout) {
      clearTimeout(timeout);
      this.retryTimeouts.delete(messageId);
    }
  }

  /**
   * Get circuit breaker status for all relays
   */
  getCircuitBreakerStatus(): Map<string, CircuitBreaker> {
    return new Map(this.circuitBreakers);
  }

  /**
   * Reset circuit breaker for a relay
   */
  resetCircuitBreaker(relayUrl: string): void {
    const breaker = this.circuitBreakers.get(relayUrl);
    if (breaker) {
      breaker.state = 'closed';
      breaker.failureCount = 0;
      breaker.successCount = 0;
      breaker.nextRetryAt = undefined;
      breaker.lastFailureAt = undefined;
    }
  }

  /**
   * Clean up expired circuit breakers and timeouts
   */
  cleanup(): void {
    const now = new Date();
    
    // Clean up old circuit breakers that haven't been used recently
    for (const [relayUrl, breaker] of this.circuitBreakers) {
      if (breaker.lastFailureAt && 
          now.getTime() - breaker.lastFailureAt.getTime() > 24 * 60 * 60 * 1000) { // 24 hours
        this.circuitBreakers.delete(relayUrl);
      }
    }

    // Clear all timeouts (they'll be recreated as needed)
    for (const timeout of this.retryTimeouts.values()) {
      clearTimeout(timeout);
    }
    this.retryTimeouts.clear();
  }

  /**
   * Check if all relays are blocked by circuit breakers
   */
  private areAllRelaysBlocked(): boolean {
    if (this.circuitBreakers.size === 0) {
      return false;
    }

    for (const breaker of this.circuitBreakers.values()) {
      if (this.isRelayAvailable(breaker.relayUrl)) {
        return false;
      }
    }

    return true;
  }

  /**
   * Get the earliest recovery time from all circuit breakers
   */
  private getEarliestRecoveryTime(): Date | null {
    let earliest: Date | null = null;

    for (const breaker of this.circuitBreakers.values()) {
      if (breaker.nextRetryAt) {
        if (!earliest || breaker.nextRetryAt < earliest) {
          earliest = breaker.nextRetryAt;
        }
      }
    }

    return earliest;
  }
}

/**
 * Singleton retry manager instance
 */
export const retryManager = new RetryManager();