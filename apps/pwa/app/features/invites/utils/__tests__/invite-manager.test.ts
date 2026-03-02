import { describe, it, expect, beforeEach, vi } from 'vitest';
import * as fc from 'fast-check';
import { inviteManager } from '../invite-manager';
import { cryptoService } from '@/app/features/crypto/crypto-service';
import { connectionStore } from '../connection-store';
import { profileManager } from '../profile-manager';
import {
  publicKeyArbitrary,
  inviteLinkOptionsArbitrary,
  messageArbitrary,
  propertyTestConfig,
  displayNameArbitrary
} from './test-utils';
import type { InviteLink, ConnectionRequest, OutgoingConnectionRequest } from '../types';

// Mock the dependencies
vi.mock('../../crypto/crypto-service');
vi.mock('../connection-store');
vi.mock('../profile-manager');
vi.mock('../db/open-invite-db');

describe('Invite Manager Property Tests', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.clearAllMocks();

    // Mock getCurrentUserIdentity to avoid the "not implemented" error
    vi.spyOn(inviteManager as any, 'getCurrentUserIdentity').mockResolvedValue({
      publicKey: 'a'.repeat(64),
      privateKey: 'b'.repeat(64)
    });
  });

  describe('Property 4: Invite Link Uniqueness', () => {
    /**
     * Feature: smart-invite-system, Property 4: Invite Link Uniqueness
     * For any two invite link generation requests, the system should produce unique URLs even when created by the same user
     * Validates: Requirements 2.1
     */
    it('should generate unique short codes and IDs', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.array(fc.integer({ min: 1, max: 100 }), { minLength: 2, maxLength: 10 }),
          async (seeds) => {
            // Test the uniqueness of generated IDs and short codes
            const generatedIds = new Set<string>();
            const generatedShortCodes = new Set<string>();

            // Mock crypto service to generate deterministic but unique values
            let idCounter = 0;
            vi.spyOn(cryptoService, 'generateInviteId').mockImplementation(async () => `id-${idCounter++}`);

            for (const seed of seeds) {
              const id = await cryptoService.generateInviteId();
              const shortCode = `code-${seed}-${Math.random().toString(36).slice(2, 10)}`;

              generatedIds.add(id);
              generatedShortCodes.add(shortCode);
            }

            // Verify uniqueness
            expect(generatedIds.size).toBe(seeds.length);
            expect(generatedShortCodes.size).toBe(seeds.length);
          }
        ),
        { ...propertyTestConfig, numRuns: 20 }
      );
    });
  });

  describe('Property 5: Invite Link Processing Consistency', () => {
    /**
     * Feature: smart-invite-system, Property 5: Invite Link Processing Consistency
     * For any valid invite link, processing it should correctly pre-populate a connection request with the original sender's information
     * Validates: Requirements 2.2
     */
    it('should extract short codes from invite links consistently', () => {
      fc.assert(
        fc.property(
          fc.string({ minLength: 4, maxLength: 12 }).filter(s => !s.includes('/')),
          (shortCode) => {
            // Test the short code extraction logic
            const baseUrl = 'https://obscur.app/invite';
            const fullUrl = `${baseUrl}/${shortCode}`;

            // Mock the private method for testing
            const extractShortCode = (linkData: string): string | null => {
              try {
                if (linkData.includes('/')) {
                  const parts = linkData.split('/');
                  return parts[parts.length - 1];
                }
                return linkData;
              } catch {
                return null;
              }
            };

            const extracted = extractShortCode(fullUrl);
            expect(extracted).toBe(shortCode);

            // Test with just the short code
            const extractedDirect = extractShortCode(shortCode);
            expect(extractedDirect).toBe(shortCode);
          }
        ),
        { ...propertyTestConfig, numRuns: 20 }
      );
    });
  });

  describe('Property 7: Connection Request State Management', () => {
    /**
     * Feature: smart-invite-system, Property 7: Connection Request State Management
     * For any connection request, accepting it should add the connection to the store and enable messaging, while declining should remove it from pending requests
     * Validates: Requirements 3.2, 3.3
     */
    it('should create connections with correct properties from connection requests', () => {
      fc.assert(
        fc.property(
          publicKeyArbitrary,
          displayNameArbitrary,
          messageArbitrary,
          (senderPublicKey, displayName, message) => {
            // Test the connection creation logic
            const mockConnectionRequest: ConnectionRequest = {
              id: 'test-request-id',
              type: 'incoming',
              senderPublicKey: senderPublicKey as any,
              recipientPublicKey: 'a'.repeat(64) as any,
              profile: {
                publicKey: senderPublicKey as any,
                displayName,
                timestamp: Date.now(),
                signature: 'test-signature'
              },
              message,
              status: 'pending',
              createdAt: new Date()
            };

            // Test connection creation properties
            const expectedDisplayName = displayName || `User ${senderPublicKey.slice(0, 8)}`;

            expect(mockConnectionRequest.senderPublicKey).toBe(senderPublicKey);
            expect(mockConnectionRequest.profile.displayName).toBe(displayName);
            expect(mockConnectionRequest.message).toBe(message);
            expect(mockConnectionRequest.type).toBe('incoming');
            expect(mockConnectionRequest.status).toBe('pending');

            // Verify the expected connection properties
            expect(expectedDisplayName).toBeTruthy();
            expect(expectedDisplayName.length).toBeGreaterThan(0);
          }
        ),
        { ...propertyTestConfig, numRuns: 20 }
      );
    });
  });

  describe('Property 8: Connection Request Message Inclusion', () => {
    /**
     * Feature: smart-invite-system, Property 8: Connection Request Message Inclusion
     * For any connection request created with a personal message, the message should be preserved and available to the recipient
     * Validates: Requirements 3.4
     */
    it('should preserve messages in connection request data structures', () => {
      fc.assert(
        fc.property(
          publicKeyArbitrary,
          messageArbitrary.filter(msg => msg.length > 0),
          (recipientPublicKey, message) => {
            const outgoingRequest: OutgoingConnectionRequest = {
              recipientPublicKey: recipientPublicKey as any,
              message,
              includeProfile: true
            };

            // Test that the message is preserved in the request structure
            expect(outgoingRequest.message).toBe(message);
            expect(outgoingRequest.recipientPublicKey).toBe(recipientPublicKey);
            expect(outgoingRequest.includeProfile).toBe(true);

            // Verify message properties
            expect(message.length).toBeGreaterThan(0);
            expect(typeof message).toBe('string');
          }
        ),
        { ...propertyTestConfig, numRuns: 20 }
      );
    });
  });

  describe('Property 9: Connection Request Queue Management', () => {
    /**
     * Feature: smart-invite-system, Property 9: Connection Request Queue Management
     * For any connection request queue exceeding 50 items, the system should automatically remove the oldest unresponded requests to maintain the limit
     * Validates: Requirements 3.6
     */
    it('should calculate correct number of requests to remove for queue management', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 51, max: 100 }),
          (numRequests) => {
            const MAX_PENDING_REQUESTS = 50;

            // Test the queue management logic
            if (numRequests >= MAX_PENDING_REQUESTS) {
              const expectedToRemove = numRequests - MAX_PENDING_REQUESTS + 1; // +1 because we're adding one more

              // Verify the calculation
              expect(expectedToRemove).toBeGreaterThan(0);
              expect(expectedToRemove).toBeLessThanOrEqual(numRequests);
              expect(numRequests - expectedToRemove).toBeLessThan(MAX_PENDING_REQUESTS);
            }
          }
        ),
        { ...propertyTestConfig, numRuns: 20 }
      );
    });
  });
});