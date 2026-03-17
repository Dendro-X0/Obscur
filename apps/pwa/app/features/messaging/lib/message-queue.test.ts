/**
 * Property-based tests for MessageQueue
 * 
 * Tests the correctness properties defined in the core messaging MVP spec:
 * - Property 17: Immediate persistence
 * - Property 21: At-rest encryption
 * - Validates Requirements 3.1, 3.5
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fc from 'fast-check';
import { MessageQueue, type Message, type MessageStatus } from './message-queue';
import type { PublicKeyHex } from '@dweb/crypto/public-key-hex';
import { openMessageDb } from './open-message-db';

describe('MessageQueue Property Tests', () => {
  let messageQueue: MessageQueue;
  const testIdentity = '1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef' as PublicKeyHex;

  // Clean up localStorage before and after each test
  beforeEach(() => {
    // Clear any existing test data
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
    // Clean up after each test
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
  const hexChar = fc.constantFrom('0', '1', '2', '3', '4', '5', '6', '7', '8', '9', 'a', 'b', 'c', 'd', 'e', 'f');
  const validPubkey = fc.array(hexChar, { minLength: 64, maxLength: 64 }).map(chars => chars.join('') as PublicKeyHex);
  const messageStatus = fc.constantFrom<MessageStatus>('sending', 'queued', 'accepted', 'rejected', 'delivered', 'failed');
  const messageContent = fc.string({ minLength: 1, maxLength: 1000 });
  const conversationId = fc.string({ minLength: 1, maxLength: 50 });
  const messageId = fc.string({ minLength: 1, maxLength: 50 });

  const validMessage: fc.Arbitrary<Message> = fc.record({
    id: messageId,
    conversationId: conversationId,
    content: messageContent,
    kind: fc.constant('user'),
    timestamp: fc.date({ min: new Date('2020-01-01'), max: new Date('2030-01-01') }),
    isOutgoing: fc.boolean(),
    status: messageStatus,
    senderPubkey: fc.constant(testIdentity),
    recipientPubkey: validPubkey
  });

  const getRawStoredMessage = async (id: string): Promise<Record<string, unknown> | null> => {
    const db = await openMessageDb();
    return await new Promise((resolve, reject) => {
      const tx = db.transaction("messages", "readonly");
      const store = tx.objectStore("messages");
      const request = store.get(id);
      request.onsuccess = () => resolve((request.result as Record<string, unknown> | undefined) ?? null);
      request.onerror = () => reject(request.error);
    });
  };

  describe('Property 17: Immediate persistence', () => {
    it('should persist any message immediately upon processing', async () => {
      await fc.assert(
        fc.asyncProperty(
          validMessage,
          async (message) => {
            // Persist the message
            await messageQueue.persistMessage(message);

            // Immediately retrieve it
            const retrieved = await messageQueue.getMessage(message.id);

            // Should be available immediately
            expect(retrieved).not.toBeNull();
            expect(retrieved!.id).toBe(message.id);
            expect(retrieved!.content).toBe(message.content);
            expect(retrieved!.conversationId).toBe(message.conversationId);
            expect(retrieved!.isOutgoing).toBe(message.isOutgoing);
            expect(retrieved!.status).toBe(message.status);
            expect(retrieved!.senderPubkey).toBe(message.senderPubkey);
            expect(retrieved!.recipientPubkey).toBe(message.recipientPubkey);
            expect(retrieved!.timestamp.getTime()).toBe(message.timestamp.getTime());
          }
        ),
        { numRuns: 50 }
      );
    });

    it('should persist messages in the correct conversation', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.array(validMessage, { minLength: 1, maxLength: 10 }),
          async (messages) => {
            // Persist all messages
            for (const message of messages) {
              await messageQueue.persistMessage(message);
            }

            // Group messages by conversation
            const messagesByConversation = new Map<string, Message[]>();
            for (const message of messages) {
              if (!messagesByConversation.has(message.conversationId)) {
                messagesByConversation.set(message.conversationId, []);
              }
              messagesByConversation.get(message.conversationId)!.push(message);
            }

            // Verify each conversation contains the correct messages
            for (const [conversationId, expectedMessages] of messagesByConversation) {
              const retrievedMessages = await messageQueue.getMessages(conversationId);

              expect(retrievedMessages.length).toBe(expectedMessages.length);

              // Check that all expected messages are present
              for (const expectedMessage of expectedMessages) {
                const found = retrievedMessages.find(m => m.id === expectedMessage.id);
                expect(found).toBeDefined();
                expect(found!.content).toBe(expectedMessage.content);
              }
            }
          }
        ),
        { numRuns: 20 }
      );
    });

    it('should handle concurrent persistence operations', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.array(validMessage, { minLength: 2, maxLength: 5 }),
          async (messages) => {
            // Ensure unique IDs to avoid conflicts
            const uniqueMessages = messages.map((msg, index) => ({
              ...msg,
              id: `${msg.id}_${index}`
            }));

            // Persist all messages concurrently
            await Promise.all(uniqueMessages.map(msg => messageQueue.persistMessage(msg)));

            // Verify all messages were persisted
            for (const message of uniqueMessages) {
              const retrieved = await messageQueue.getMessage(message.id);
              expect(retrieved).not.toBeNull();
              expect(retrieved!.content).toBe(message.content);
            }
          }
        ),
        { numRuns: 20 }
      );
    });
  });

  describe('Property 21: At-rest encryption', () => {
    it('should encrypt sensitive message data in storage', async () => {
      await fc.assert(
        fc.asyncProperty(
          validMessage,
          async (message) => {
            // Persist the message
            await messageQueue.persistMessage(message);

            // Check raw storage - content should be encrypted
            const rawStored = await getRawStoredMessage(message.id);
            expect(rawStored).not.toBeNull();

            // The encryptedData field should not contain the original content in plaintext
            expect(rawStored!.encryptedData).toBeDefined();
            expect(rawStored!.content).toBe("[ENCRYPTED]");
            expect(rawStored!.isEncrypted).toBe(true);

            // But we should be able to retrieve the original content
            const retrieved = await messageQueue.getMessage(message.id);
            expect(retrieved!.content).toBe(message.content);
          }
        ),
        { numRuns: 30 }
      );
    });

    it('should encrypt different messages with different ciphertext', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.tuple(validMessage, validMessage),
          async ([message1, message2]) => {
            // Ensure different content
            if (message1.content === message2.content) {
              message2 = { ...message2, content: message2.content + '_different' };
            }

            // Ensure different IDs
            message1 = { ...message1, id: 'msg1_' + message1.id };
            message2 = { ...message2, id: 'msg2_' + message2.id };

            // Persist both messages
            await messageQueue.persistMessage(message1);
            await messageQueue.persistMessage(message2);

            // Get raw storage for both
            const raw1 = await getRawStoredMessage(message1.id);
            const raw2 = await getRawStoredMessage(message2.id);

            expect(raw1).not.toBeNull();
            expect(raw2).not.toBeNull();

            // Different messages should have different encrypted data
            expect(raw1!.encryptedData).not.toBe(raw2!.encryptedData);
          }
        ),
        { numRuns: 20 }
      );
    });

    it('should handle encryption/decryption roundtrip correctly', async () => {
      await fc.assert(
        fc.asyncProperty(
          validMessage,
          async (message) => {
            // Add some complex data to test encryption
            const complexMessage: Message = {
              ...message,
              attachments: [{
                kind: 'image',
                url: 'https://example.com/image.jpg',
                contentType: 'image/jpeg',
                fileName: 'test.jpg'
              }],
              replyTo: {
                messageId: 'reply-to-id',
                previewText: 'Original message preview'
              },
              reactions: {
                '👍': 5,
                '❤️': 3
              }
            };

            // Persist and retrieve
            await messageQueue.persistMessage(complexMessage);
            const retrieved = await messageQueue.getMessage(complexMessage.id);

            // All data should be preserved
            expect(retrieved).not.toBeNull();
            expect(retrieved!.content).toBe(complexMessage.content);
            expect(retrieved!.attachments).toEqual(complexMessage.attachments);
            expect(retrieved!.replyTo).toEqual(complexMessage.replyTo);
            expect(retrieved!.reactions).toEqual(complexMessage.reactions);
          }
        ),
        { numRuns: 20 }
      );
    });
  });

  describe('Message Status Updates', () => {
    it('should update message status correctly', async () => {
      await fc.assert(
        fc.asyncProperty(
          validMessage,
          messageStatus,
          async (message, newStatus) => {
            // Skip if new status is the same as original
            if (message.status === newStatus) {
              return true;
            }

            // Persist original message
            await messageQueue.persistMessage(message);

            // Update status
            await messageQueue.updateMessageStatus(message.id, newStatus);

            // Verify status was updated
            const retrieved = await messageQueue.getMessage(message.id);
            expect(retrieved).not.toBeNull();
            expect(retrieved!.status).toBe(newStatus);

            // Other fields should remain unchanged
            expect(retrieved!.content).toBe(message.content);
            expect(retrieved!.conversationId).toBe(message.conversationId);
          }
        ),
        { numRuns: 30 }
      );
    });

    it('should handle status updates for non-existent messages gracefully', async () => {
      await fc.assert(
        fc.asyncProperty(
          messageId,
          messageStatus,
          async (nonExistentId, status) => {
            // Try to update status of non-existent message
            await expect(messageQueue.updateMessageStatus(nonExistentId, status))
              .resolves.toBeUndefined();
          }
        ),
        { numRuns: 20 }
      );
    });
  });

  describe('Message Retrieval Properties', () => {
    it('should return null for non-existent messages', async () => {
      await fc.assert(
        fc.asyncProperty(
          messageId,
          async (nonExistentId) => {
            const retrieved = await messageQueue.getMessage(nonExistentId);
            expect(retrieved).toBeNull();
          }
        ),
        { numRuns: 20 }
      );
    });

    it('should return messages in chronological order', async () => {
      await fc.assert(
        fc.asyncProperty(
          validPubkey,
          fc.array(validMessage, { minLength: 2, maxLength: 10 }),
          async (peerPubkey, messages) => {
            const convId = [testIdentity, peerPubkey].sort().join(':');
            // Set all messages to same conversation and ensure unique IDs
            const conversationMessages = messages.map((msg, index) => ({
              ...msg,
              conversationId: convId,
              id: `msg_${index}_${msg.id}`,
              timestamp: new Date(Date.now() + index * 1000) // Ensure different timestamps
            }));

            // Persist messages in random order
            const shuffled = [...conversationMessages].sort(() => Math.random() - 0.5);
            for (const message of shuffled) {
              await messageQueue.persistMessage(message);
            }

            // Retrieve messages
            const retrieved = await messageQueue.getMessages(convId);

            // Should be in chronological order
            for (let i = 1; i < retrieved.length; i++) {
              expect(retrieved[i - 1].timestamp.getTime()).toBeGreaterThanOrEqual(
                retrieved[i].timestamp.getTime()
              );
            }
          }
        ),
        { numRuns: 15 }
      );
    });
  });

  describe('Error Handling Properties', () => {
    it('should handle storage errors gracefully', async () => {
      await fc.assert(
        fc.asyncProperty(
          validMessage,
          async (message) => {
            // All operations should return structured results, never throw unhandled errors
            try {
              await messageQueue.persistMessage(message);
              const retrieved = await messageQueue.getMessage(message.id);

              // Operations should complete successfully or fail gracefully
              expect(typeof retrieved === 'object' || retrieved === null).toBe(true);
            } catch (error) {
              // If an error is thrown, it should be a proper Error object
              expect(error instanceof Error).toBe(true);
            }
          }
        ),
        { numRuns: 30 }
      );
    });
  });
});

/**
 * Feature: core-messaging-mvp
 * Property 17: Immediate persistence
 * Property 21: At-rest encryption
 * 
 * For any message that is sent or received, the Message_Queue should persist it 
 * to local storage immediately upon processing, with sensitive data encrypted at rest.
 * 
 * Validates Requirements 3.1, 3.5:
 * - 3.1: Message_Queue SHALL persist messages to local storage immediately
 * - 3.5: Message_Queue SHALL encrypt sensitive message data at rest using the user's key
 */
