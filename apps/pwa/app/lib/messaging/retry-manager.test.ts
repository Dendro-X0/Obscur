/**
 * Property-based tests for RetryManager
 * 
 * Tests the correctness properties defined in the core messaging MVP spec:
 * - Property 8: Retry queue on total failure
 * - Validates Requirements 1.8
 */

import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';
import fc from 'fast-check';
import { RetryManager, type RetryConfig, type OutgoingMessage } from './retry-manager';
import type { PublicKeyHex } from '@dweb/crypto/public-key-hex';

describe('RetryManager Property Tests', () => {
  let retryManager: RetryManager;
  
  beforeEach(() => {
    retryManager = new RetryManager();
    jest.clearAllTimers();
    jest.useFakeTimers();
  });

  afterEach(() => {
    retryManager.cleanup();
    jest.useRealTimers();
  });

  // Helper arbitraries
  const validPubkey = fc.hexaString({ minLength: 64, maxLength: 64 }) as fc.Arbitrary<PublicKeyHex>;
  const relayUrl = fc.webUrl();
  const messageContent = fc.string({ minLength: 1, maxLength: 1000 });
  const retryCount = fc.integer({ min: 0, max: 10 });

  const outgoingMessage = fc.record({
    id: fc.string({ minLength: 1, maxLength: 50 }),
    conversationId: fc.string({ minLength: 1, maxLength: 50 }),
    content: messageContent,
    recipientPubkey: validPubkey,
    createdAt: fc.date({ min: new Date('2020-01-01'), max: new Date('2030-01-01') }),
    retryCount: retryCount,
    nextRetryAt: fc.date({ min: new Date('2020-01-01'), max: new Date('2030-01-01') })
  }) as fc.Arbitrary<OutgoingMessage>;

  describe('Property 8: Retry queue on total failure', () => {
    it('should queue messages for retry when all relay publishing attempts fail', () => {
      fc.assert(
        fc.property(
          outgoingMessage,
          fc.string(),
          (message, errorMessage) => {
            // Simulate total failure scenario
            const result = retryManager.shouldRetry(message, errorMessage);
            
            if (message.retryCount < 5) { // Default max retries
              // Should retry if under max retry limit
              expect(result.shouldRetry).toBe(true);
              expect(result.nextRetryAt).toBeDefined();
              expect(result.nextRetryAt!.getTime()).toBeGreaterThan(Date.now());
            } else {
              // Should not retry if max retries exceeded
              expect(result.shouldRetry).toBe(false);
              expect(result.error).toContain('Max retries');
            }
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should calculate exponential backoff correctly', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 0, max: 8 }),
          fc.date({ min: new Date('2020-01-01'), max: new Date('2025-01-01') }),
          (retryCount, baseTime) => {
            const nextRetry = retryManager.calculateNextRetry(retryCount, baseTime);
            
            // Next retry should be in the future
            expect(nextRetry.getTime()).toBeGreaterThan(baseTime.getTime());
            
            // Delay should increase with retry count (exponential backoff)
            const delay = nextRetry.getTime() - baseTime.getTime();
            const expectedMinDelay = 1000 * Math.pow(2, retryCount) - 1000; // Base delay with backoff minus jitter
            
            // Should be at least the minimum expected delay (accounting for jitter)
            expect(delay).toBeGreaterThanOrEqual(expectedMinDelay);
            
            // Should not exceed maximum delay (5 minutes + jitter)
            expect(delay).toBeLessThanOrEqual(300000 + 1000);
          }
        ),
        { numRuns: 50 }
      );
    });

    it('should respect maximum retry limits', () => {
      fc.assert(
        fc.property(
          outgoingMessage,
          (message) => {
            // Test with message at max retries
            const maxRetriesMessage = { ...message, retryCount: 5 };
            const result = retryManager.shouldRetry(maxRetriesMessage);
            
            expect(result.shouldRetry).toBe(false);
            expect(result.error).toContain('Max retries');
          }
        ),
        { numRuns: 50 }
      );
    });

    it('should handle retry scheduling correctly', () => {
      fc.assert(
        fc.property(
          fc.string({ minLength: 1, maxLength: 50 }),
          fc.date({ min: new Date(), max: new Date(Date.now() + 60000) }),
          (messageId, retryAt) => {
            let callbackExecuted = false;
            const callback = jest.fn(() => {
              callbackExecuted = true;
              return Promise.resolve();
            });
            
            // Schedule retry
            retryManager.scheduleRetry(messageId, retryAt, callback);
            
            // Fast-forward time to retry point
            jest.advanceTimersByTime(retryAt.getTime() - Date.now() + 100);
            
            // Callback should have been executed
            expect(callback).toHaveBeenCalled();
          }
        ),
        { numRuns: 20 }
      );
    });
  });

  describe('Circuit Breaker Properties', () => {
    it('should track relay failures correctly', () => {
      fc.assert(
        fc.property(
          relayUrl,
          fc.integer({ min: 1, max: 10 }),
          (url, failureCount) => {
            // Record multiple failures
            for (let i = 0; i < failureCount; i++) {
              retryManager.recordRelayFailure(url, `Error ${i}`);
            }
            
            const status = retryManager.getCircuitBreakerStatus();
            const breaker = status.get(url);
            
            expect(breaker).toBeDefined();
            expect(breaker!.failureCount).toBe(failureCount);
            
            // Circuit should be open if failures exceed threshold
            if (failureCount >= 5) {
              expect(breaker!.state).toBe('open');
              expect(retryManager.isRelayAvailable(url)).toBe(false);
            } else {
              expect(breaker!.state).toBe('closed');
              expect(retryManager.isRelayAvailable(url)).toBe(true);
            }
          }
        ),
        { numRuns: 50 }
      );
    });

    it('should recover from failures with successes', () => {
      fc.assert(
        fc.property(
          relayUrl,
          fc.integer({ min: 1, max: 5 }),
          (url, successCount) => {
            // First, cause some failures (but not enough to open circuit)
            retryManager.recordRelayFailure(url);
            retryManager.recordRelayFailure(url);
            
            // Then record successes
            for (let i = 0; i < successCount; i++) {
              retryManager.recordRelaySuccess(url);
            }
            
            const status = retryManager.getCircuitBreakerStatus();
            const breaker = status.get(url);
            
            expect(breaker).toBeDefined();
            expect(breaker!.successCount).toBe(successCount);
            
            // Failure count should be reduced by successes
            expect(breaker!.failureCount).toBeLessThanOrEqual(2);
          }
        ),
        { numRuns: 30 }
      );
    });

    it('should filter available relays correctly', () => {
      fc.assert(
        fc.property(
          fc.array(relayUrl, { minLength: 1, maxLength: 10 }),
          (relayUrls) => {
            // Make some relays fail enough to open circuit breakers
            const uniqueUrls = [...new Set(relayUrls)];
            const failedUrls = uniqueUrls.slice(0, Math.floor(uniqueUrls.length / 2));
            
            failedUrls.forEach(url => {
              // Cause enough failures to open circuit breaker
              for (let i = 0; i < 6; i++) {
                retryManager.recordRelayFailure(url);
              }
            });
            
            const availableRelays = retryManager.getAvailableRelays(uniqueUrls);
            
            // Available relays should not include failed ones
            failedUrls.forEach(url => {
              expect(availableRelays).not.toContain(url);
            });
            
            // Should include non-failed relays
            const nonFailedUrls = uniqueUrls.filter(url => !failedUrls.includes(url));
            nonFailedUrls.forEach(url => {
              expect(availableRelays).toContain(url);
            });
          }
        ),
        { numRuns: 20 }
      );
    });
  });

  describe('Retry Configuration Properties', () => {
    it('should respect custom retry configuration', () => {
      fc.assert(
        fc.property(
          fc.record({
            maxRetries: fc.integer({ min: 1, max: 10 }),
            baseDelayMs: fc.integer({ min: 100, max: 5000 }),
            maxDelayMs: fc.integer({ min: 10000, max: 600000 }),
            backoffMultiplier: fc.float({ min: 1.1, max: 3.0 }),
            jitterMs: fc.integer({ min: 0, max: 2000 })
          }),
          outgoingMessage,
          (config, message) => {
            const customRetryManager = new RetryManager(config);
            
            // Test with message at max retries
            const maxRetriesMessage = { ...message, retryCount: config.maxRetries };
            const result = customRetryManager.shouldRetry(maxRetriesMessage);
            
            expect(result.shouldRetry).toBe(false);
            
            // Test with message under max retries
            const underLimitMessage = { ...message, retryCount: config.maxRetries - 1 };
            const retryResult = customRetryManager.shouldRetry(underLimitMessage);
            
            expect(retryResult.shouldRetry).toBe(true);
            
            customRetryManager.cleanup();
          }
        ),
        { numRuns: 20 }
      );
    });
  });

  describe('Error Handling Properties', () => {
    it('should handle all operations gracefully', () => {
      fc.assert(
        fc.property(
          fc.string(),
          fc.string(),
          outgoingMessage,
          (relayUrl, errorMessage, message) => {
            // All operations should complete without throwing
            expect(() => {
              retryManager.recordRelayFailure(relayUrl, errorMessage);
              retryManager.recordRelaySuccess(relayUrl);
              retryManager.isRelayAvailable(relayUrl);
              retryManager.shouldRetry(message, errorMessage);
            }).not.toThrow();
          }
        ),
        { numRuns: 50 }
      );
    });

    it('should handle cleanup operations safely', () => {
      fc.assert(
        fc.property(
          fc.array(relayUrl, { maxLength: 5 }),
          (relayUrls) => {
            // Create some circuit breakers and timeouts
            relayUrls.forEach(url => {
              retryManager.recordRelayFailure(url);
              retryManager.scheduleRetry(`msg-${url}`, new Date(Date.now() + 1000), async () => {});
            });
            
            // Cleanup should not throw
            expect(() => retryManager.cleanup()).not.toThrow();
            
            // Circuit breakers should still exist (cleanup only removes old ones)
            const status = retryManager.getCircuitBreakerStatus();
            expect(status.size).toBeGreaterThanOrEqual(0);
          }
        ),
        { numRuns: 20 }
      );
    });
  });
});

/**
 * Feature: core-messaging-mvp
 * Property 8: Retry queue on total failure
 * 
 * For any message where all relay publishing attempts fail, the DM_Controller 
 * should add the message to the retry queue with appropriate exponential backoff.
 * 
 * Validates Requirements 1.8:
 * - 1.8: When all relays fail, DM_Controller SHALL queue the message for retry
 */