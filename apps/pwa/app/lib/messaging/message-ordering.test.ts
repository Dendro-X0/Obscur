/**
 * Property-based tests for Message Ordering
 * 
 * Tests the correctness properties defined in the core messaging MVP spec:
 * - Property 22: Timestamp ordering maintenance
 * - Validates Requirements 3.6
 */

import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import fc from 'fast-check';
import { MessageQueue, type Message, type MessageStatus } from './message-queue';
import type { PublicKeyHex } from '@dweb/crypto/public-key-hex';

describe('Message Ordering Property Tests', () => {
  let messageQueue: MessageQueue;
  const testIdentity = '1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef' as PublicKeyHex;
  
  beforeEach(() => {
    // Clear localStorage
    const keysToRemove: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key?.includes('obscur.messages')) {
        keysToRemove.push(key);
      }
    }
    keysToRemove.forEach(key => localStorage.removeItem(key));
    
    messageQueue = new MessageQueue(testIdentity);
  });

  afterEach(() => {
    // Clean up
    const keysToRemove: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key?.includes('obscur.messages')) {
        keysToRemove.push(key);
      }
    }
    keysToRemove.forEach(key => localStorage.removeItem(key));
  });

  // Helper arbitraries
  const validPubkey = fc.hexaString({ minLength: 64, maxLength: 64 }) as fc.Arbitrary<PublicKeyHex>;
  const messageStatus = fc.constantFrom('sending', 'queued', 'accepted', 'rejected', 'delivered', 'failed') as fc.Arbitrary<MessageStatus>;
  const messageContent = fc.string({ minLength: 1, maxLength: 1000 });
  const conversationId = fc.string({ minLength: 1, maxLength: 50 });

  const messageWithTimestamp = fc.record({
    id: fc.string({ minLength: 1, maxLength: 50 }),
    conversationId: conversationId,
    content: messageContent,
    timestamp: fc.date({ min: new Date('2020-01-01'), max: new Date('2030-01-01') }),
    isOutgoing: fc.boolean(),
    status: messageStatus,
    senderPubkey: validPubkey,
    recipientPubkey: validPubkey
  }) as fc.Arbitrary<Message>;

  describe('Property 22: Timestamp ordering maintenance', () => {
    it('should maintain chronological ordering for any set of messages in a conversation', async () => {
      await fc.assert(
        fc.asyncProperty(
          conversationId,
          fc.array(messageWithTimestamp, { minLength: 2, maxLength: 20 }),
          async (convId, messages) => {
            // Ensure all messages belong to the same conversation and have unique IDs
            const conversationMessages = messages.map((msg, index) => ({
              ...msg,
              conversationId: convId,
              id: `msg_${index}_${Date.now()}_${Math.random()}`,
              // Ensure different timestamps by adding index-based offset
              timestamp: new Date(msg.timestamp.getTime() + index * 1000)
            }));

            // Persist messages in random order to test sorting
            const shuffledMessages = [...conversationMessages].sort(() => Math.random() - 0.5);
            
            for (const message of shuffledMessages) {
              await messageQueue.persistMessage(message);
            }

            // Retrieve messages
            const retrievedMessages = await messageQueue.getMessages(convId);

            // Should have all messages
            expect(retrievedMessages.length).toBe(conversationMessages.length);

            // Should be in chronological order (timestamp ascending)
            for (let i = 1; i < retrievedMessages.length; i++) {
              expect(retrievedMessages[i].timestamp.getTime()).toBeGreaterThanOrEqual(
                retrievedMessages[i - 1].timestamp.getTime()
              );
            }

            // Should contain all original messages
            for (const originalMessage of conversationMessages) {
              const found = retrievedMessages.find(m => m.id === originalMessage.id);
              expect(found).toBeDefined();
              expect(found!.content).toBe(originalMessage.content);
              expect(found!.timestamp.getTime()).toBe(originalMessage.timestamp.getTime());
            }
          }
        ),
        { numRuns: 30 }
      );
    });

    it('should handle messages with identical timestamps correctly', async () => {
      await fc.assert(
        fc.asyncProperty(
          conversationId,
          fc.date({ min: new Date('2020-01-01'), max: new Date('2025-01-01') }),
          fc.integer({ min: 2, max: 10 }),
          async (convId, sharedTimestamp, messageCount) => {
            // Create messages with identical timestamps
            const messages: Message[] = [];
            for (let i = 0; i < messageCount; i++) {
              messages.push({
                id: `msg_${i}_${Date.now()}_${Math.random()}`,
                conversationId: convId,
                content: `Message ${i}`,
                timestamp: new Date(sharedTimestamp.getTime()), // Same timestamp
                isOutgoing: i % 2 === 0,
                status: 'delivered',
                senderPubkey: '1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef' as PublicKeyHex,
                recipientPubkey: 'abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890' as PublicKeyHex
              });
            }

            // Persist in random order
            const shuffled = [...messages].sort(() => Math.random() - 0.5);
            for (const message of shuffled) {
              await messageQueue.persistMessage(message);
            }

            // Retrieve messages
            const retrieved = await messageQueue.getMessages(convId);

            // Should have all messages
            expect(retrieved.length).toBe(messageCount);

            // All should have the same timestamp
            for (const message of retrieved) {
              expect(message.timestamp.getTime()).toBe(sharedTimestamp.getTime());
            }

            // Should be stable sort (maintain some consistent order for same timestamps)
            // We can't guarantee the exact order, but it should be consistent
            const retrievedAgain = await messageQueue.getMessages(convId);
            expect(retrievedAgain.map(m => m.id)).toEqual(retrieved.map(m => m.id));
          }
        ),
        { numRuns: 20 }
      );
    });

    it('should maintain ordering across multiple conversations', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.array(conversationId, { minLength: 2, maxLength: 5 }),
          fc.array(messageWithTimestamp, { minLength: 10, maxLength: 30 }),
          async (conversationIds, messages) => {
            // Distribute messages across conversations
            const messagesByConversation = new Map<string, Message[]>();
            
            messages.forEach((msg, index) => {
              const convId = conversationIds[index % conversationIds.length];
              const uniqueMsg = {
                ...msg,
                id: `msg_${index}_${Date.now()}_${Math.random()}`,
                conversationId: convId
              };
              
              if (!messagesByConversation.has(convId)) {
                messagesByConversation.set(convId, []);
              }
              messagesByConversation.get(convId)!.push(uniqueMsg);
            });

            // Persist all messages in random order
            const allMessages = Array.from(messagesByConversation.values()).flat();
            const shuffled = [...allMessages].sort(() => Math.random() - 0.5);
            
            for (const message of shuffled) {
              await messageQueue.persistMessage(message);
            }

            // Verify ordering for each conversation
            for (const [convId, expectedMessages] of messagesByConversation) {
              const retrieved = await messageQueue.getMessages(convId);
              
              // Should have correct number of messages
              expect(retrieved.length).toBe(expectedMessages.length);
              
              // Should be in chronological order
              for (let i = 1; i < retrieved.length; i++) {
                expect(retrieved[i].timestamp.getTime()).toBeGreaterThanOrEqual(
                  retrieved[i - 1].timestamp.getTime()
                );
              }
              
              // Should contain all expected messages
              for (const expectedMsg of expectedMessages) {
                const found = retrieved.find(m => m.id === expectedMsg.id);
                expect(found).toBeDefined();
              }
            }
          }
        ),
        { numRuns: 15 }
      );
    });

    it('should handle edge cases with very old and very new timestamps', async () => {
      await fc.assert(
        fc.asyncProperty(
          conversationId,
          async (convId) => {
            const messages: Message[] = [
              {
                id: 'very_old',
                conversationId: convId,
                content: 'Very old message',
                timestamp: new Date('1970-01-01T00:00:01Z'), // Very old
                isOutgoing: true,
                status: 'delivered',
                senderPubkey: '1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef' as PublicKeyHex,
                recipientPubkey: 'abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890' as PublicKeyHex
              },
              {
                id: 'very_new',
                conversationId: convId,
                content: 'Very new message',
                timestamp: new Date('2099-12-31T23:59:59Z'), // Very new
                isOutgoing: false,
                status: 'delivered',
                senderPubkey: 'abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890' as PublicKeyHex,
                recipientPubkey: '1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef' as PublicKeyHex
              },
              {
                id: 'middle',
                conversationId: convId,
                content: 'Middle message',
                timestamp: new Date(), // Current time
                isOutgoing: true,
                status: 'delivered',
                senderPubkey: '1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef' as PublicKeyHex,
                recipientPubkey: 'abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890' as PublicKeyHex
              }
            ];

            // Persist in reverse chronological order
            for (const message of messages.reverse()) {
              await messageQueue.persistMessage(message);
            }

            // Retrieve messages
            const retrieved = await messageQueue.getMessages(convId);

            // Should be in correct chronological order
            expect(retrieved.length).toBe(3);
            expect(retrieved[0].id).toBe('very_old');
            expect(retrieved[1].id).toBe('middle');
            expect(retrieved[2].id).toBe('very_new');

            // Verify timestamps are in order
            expect(retrieved[0].timestamp.getTime()).toBeLessThan(retrieved[1].timestamp.getTime());
            expect(retrieved[1].timestamp.getTime()).toBeLessThan(retrieved[2].timestamp.getTime());
          }
        ),
        { numRuns: 10 }
      );
    });

    it('should maintain ordering after status updates', async () => {
      await fc.assert(
        fc.asyncProperty(
          conversationId,
          fc.array(messageWithTimestamp, { minLength: 3, maxLength: 10 }),
          async (convId, messages) => {
            // Ensure unique IDs and same conversation
            const uniqueMessages = messages.map((msg, index) => ({
              ...msg,
              conversationId: convId,
              id: `msg_${index}_${Date.now()}_${Math.random()}`,
              timestamp: new Date(msg.timestamp.getTime() + index * 1000) // Ensure different timestamps
            }));

            // Persist messages
            for (const message of uniqueMessages) {
              await messageQueue.persistMessage(message);
            }

            // Update status of some messages
            const messagesToUpdate = uniqueMessages.slice(0, Math.ceil(uniqueMessages.length / 2));
            for (const message of messagesToUpdate) {
              await messageQueue.updateMessageStatus(message.id, 'accepted');
            }

            // Retrieve messages
            const retrieved = await messageQueue.getMessages(convId);

            // Should still be in chronological order
            for (let i = 1; i < retrieved.length; i++) {
              expect(retrieved[i].timestamp.getTime()).toBeGreaterThanOrEqual(
                retrieved[i - 1].timestamp.getTime()
              );
            }

            // Updated messages should have new status but same timestamp
            for (const updatedMessage of messagesToUpdate) {
              const found = retrieved.find(m => m.id === updatedMessage.id);
              expect(found).toBeDefined();
              expect(found!.status).toBe('accepted');
              expect(found!.timestamp.getTime()).toBe(updatedMessage.timestamp.getTime());
            }
          }
        ),
        { numRuns: 20 }
      );
    });
  });

  describe('Pagination Properties', () => {
    it('should respect pagination limits', async () => {
      await fc.assert(
        fc.asyncProperty(
          conversationId,
          fc.array(messageWithTimestamp, { minLength: 10, maxLength: 50 }),
          fc.integer({ min: 1, max: 20 }),
          async (convId, messages, limit) => {
            // Create unique messages in same conversation
            const uniqueMessages = messages.map((msg, index) => ({
              ...msg,
              conversationId: convId,
              id: `msg_${index}_${Date.now()}_${Math.random()}`,
              timestamp: new Date(msg.timestamp.getTime() + index * 1000)
            }));

            // Persist all messages
            for (const message of uniqueMessages) {
              await messageQueue.persistMessage(message);
            }

            // Retrieve with limit
            const retrieved = await messageQueue.getMessages(convId, { limit });

            // Should respect limit
            expect(retrieved.length).toBeLessThanOrEqual(limit);
            expect(retrieved.length).toBeLessThanOrEqual(uniqueMessages.length);

            // Should still be in chronological order
            for (let i = 1; i < retrieved.length; i++) {
              expect(retrieved[i].timestamp.getTime()).toBeGreaterThanOrEqual(
                retrieved[i - 1].timestamp.getTime()
              );
            }
          }
        ),
        { numRuns: 20 }
      );
    });
  });
});

/**
 * Feature: core-messaging-mvp
 * Property 22: Timestamp ordering maintenance
 * 
 * For any set of messages in a conversation, the Message_Queue should maintain 
 * chronological ordering based on message timestamps.
 * 
 * Validates Requirements 3.6:
 * - 3.6: Message_Queue SHALL maintain message ordering by timestamp
 */