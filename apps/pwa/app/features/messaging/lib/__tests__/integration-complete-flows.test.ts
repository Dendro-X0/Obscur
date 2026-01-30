/**
 * Integration Tests: Complete Message Flows
 * 
 * Tests complete message sending and receiving flows end-to-end
 * including encryption, relay publishing, status tracking, and UI updates.
 * 
 * Requirements: All requirements integration testing
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { useEnhancedDMController } from '../enhanced-dm-controller';
import { cryptoService } from '../../crypto/crypto-service';
import type { PublicKeyHex } from '@dweb/crypto/public-key-hex';
import type { PrivateKeyHex } from '@dweb/crypto/private-key-hex';

// Mock dependencies
vi.mock('../../crypto/crypto-service', () => ({
  cryptoService: {
    encryptDM: vi.fn(async (plaintext: string) => `encrypted_${plaintext}`),
    decryptDM: vi.fn(async (ciphertext: string) => ciphertext.replace('encrypted_', '')),
    signEvent: vi.fn(async (event: any) => ({
      ...event,
      id: `event_${Date.now()}_${Math.random()}`,
      sig: 'mock_signature'
    })),
    verifyEventSignature: vi.fn(async () => true),
    isValidPubkey: vi.fn(() => true),
    normalizeKey: vi.fn((key: string) => key.toLowerCase())
  }
}));

vi.mock('../message-queue', () => {
  const messages = new Map();
  const queuedMessages = new Map();
  
  class MockMessageQueue {
    persistMessage = vi.fn(async (msg: any) => {
      messages.set(msg.id, msg);
    });
    updateMessageStatus = vi.fn(async (id: string, status: string) => {
      const msg = messages.get(id);
      if (msg) {
        msg.status = status;
        messages.set(id, msg);
      }
    });
    getMessage = vi.fn(async (id: string) => messages.get(id));
    getMessages = vi.fn(async () => Array.from(messages.values()));
    queueOutgoingMessage = vi.fn(async (msg: any) => {
      queuedMessages.set(msg.id, msg);
    });
    getQueuedMessages = vi.fn(async () => Array.from(queuedMessages.values()));
    removeFromQueue = vi.fn(async (id: string) => {
      queuedMessages.delete(id);
    });
    getLastMessageTimestamp = vi.fn(async () => null);
  }
  
  return {
    MessageQueue: MockMessageQueue
  };
});

vi.mock('../retry-manager', () => ({
  retryManager: {
    shouldRetry: vi.fn(() => ({ shouldRetry: true, nextRetryAt: new Date(Date.now() + 1000) })),
    calculateNextRetry: vi.fn(() => new Date(Date.now() + 1000)),
    recordRelaySuccess: vi.fn(),
    recordRelayFailure: vi.fn()
  }
}));

vi.mock('../../parse-public-key-input', () => ({
  parsePublicKeyInput: vi.fn((input: string) => ({
    ok: true,
    publicKeyHex: input
  }))
}));

vi.mock('../../nostr-safety-limits', () => ({
  NOSTR_SAFETY_LIMITS: {
    maxDmPlaintextChars: 1000
  }
}));

describe('Integration: Complete Message Flows', () => {
  const alice: { pub: PublicKeyHex; priv: PrivateKeyHex } = {
    pub: 'a1633cafcc01ebfb6d78e39f687a1f0995c62fc95f51ead10a02ee0be551b5dc' as PublicKeyHex,
    priv: '5dab087e624a8a4b79e17f8b83800ee66f3bb1292618b6fd1c2f8b27ff88e0eb' as PrivateKeyHex
  };

  const bob: { pub: PublicKeyHex; priv: PrivateKeyHex } = {
    pub: 'c2047f9441ed7d6d3045406e95c07cd85c778e4b8cef3ca7abac09b95c709ee5' as PublicKeyHex,
    priv: '7f8c9d3e2a1b4f5c6d8e9a0b1c2d3e4f5a6b7c8d9e0f1a2b3c4d5e6f7a8b9c0d' as PrivateKeyHex
  };

  let mockPool: any;
  let messageListeners: Set<(params: { url: string; message: string }) => void>;

  beforeEach(() => {
    vi.clearAllMocks();
    messageListeners = new Set();

    mockPool = {
      connections: [
        { url: 'wss://relay1.example.com', status: 'open' as const, updatedAtUnixMs: Date.now() },
        { url: 'wss://relay2.example.com', status: 'open' as const, updatedAtUnixMs: Date.now() }
      ],
      sendToOpen: vi.fn(),
      publishToAll: vi.fn(async () => ({
        success: true,
        successCount: 2,
        totalRelays: 2,
        results: [
          { relayUrl: 'wss://relay1.example.com', success: true },
          { relayUrl: 'wss://relay2.example.com', success: true }
        ]
      })),
      subscribeToMessages: vi.fn((handler: any) => {
        messageListeners.add(handler);
        return () => messageListeners.delete(handler);
      })
    };
  });

  afterEach(() => {
    messageListeners.clear();
  });

  describe('Complete Send-Receive Flow', () => {
    it('should handle complete bidirectional conversation', async () => {
      // Set up Alice's controller
      const { result: aliceController } = renderHook(() =>
        useEnhancedDMController({
          myPublicKeyHex: alice.pub,
          myPrivateKeyHex: alice.priv,
          pool: mockPool,
          peerTrust: {
            isAccepted: () => true
          }
        })
      );

      await waitFor(() => {
        expect(aliceController.current.state.status).toBe('ready');
      });

      // Alice sends message to Bob
      let aliceMessageId: string;
      await act(async () => {
        const result = await aliceController.current.sendDm({
          peerPublicKeyInput: bob.pub,
          plaintext: 'Hello Bob!'
        });
        aliceMessageId = result.messageId;
        expect(result.success).toBe(true);
      });

      // Verify Alice sees her sent message
      await waitFor(() => {
        const messages = aliceController.current.state.messages;
        const sentMessage = messages.find(m => m.id === aliceMessageId);
        expect(sentMessage).toBeDefined();
        expect(sentMessage?.content).toBe('Hello Bob!');
        expect(sentMessage?.isOutgoing).toBe(true);
        expect(sentMessage?.status).toBe('accepted');
      });

      // Simulate Bob receiving Alice's message
      const bobReceivesEvent = {
        id: aliceMessageId,
        kind: 4,
        pubkey: alice.pub,
        created_at: Math.floor(Date.now() / 1000),
        tags: [['p', bob.pub]],
        content: 'encrypted_Hello Bob!',
        sig: 'signature'
      };

      // Set up Bob's controller
      const { result: bobController } = renderHook(() =>
        useEnhancedDMController({
          myPublicKeyHex: bob.pub,
          myPrivateKeyHex: bob.priv,
          pool: mockPool,
          peerTrust: {
            isAccepted: () => true
          }
        })
      );

      await waitFor(() => {
        expect(bobController.current.state.status).toBe('ready');
      });

      // Deliver message to Bob
      await act(async () => {
        const eventMessage = JSON.stringify(['EVENT', 'sub_123', bobReceivesEvent]);
        messageListeners.forEach(listener => {
          listener({ url: 'wss://relay1.example.com', message: eventMessage });
        });
      });

      // Verify Bob received the message
      await waitFor(() => {
        const messages = bobController.current.state.messages;
        const receivedMessage = messages.find(m => m.content === 'Hello Bob!');
        expect(receivedMessage).toBeDefined();
        expect(receivedMessage?.isOutgoing).toBe(false);
        expect(receivedMessage?.status).toBe('delivered');
        expect(receivedMessage?.senderPubkey).toBe(alice.pub);
      }, { timeout: 2000 });

      // Bob replies to Alice
      let bobMessageId: string;
      await act(async () => {
        const result = await bobController.current.sendDm({
          peerPublicKeyInput: alice.pub,
          plaintext: 'Hi Alice!'
        });
        bobMessageId = result.messageId;
        expect(result.success).toBe(true);
      });

      // Simulate Alice receiving Bob's reply
      const aliceReceivesEvent = {
        id: bobMessageId,
        kind: 4,
        pubkey: bob.pub,
        created_at: Math.floor(Date.now() / 1000),
        tags: [['p', alice.pub]],
        content: 'encrypted_Hi Alice!',
        sig: 'signature'
      };

      await act(async () => {
        const eventMessage = JSON.stringify(['EVENT', 'sub_456', aliceReceivesEvent]);
        messageListeners.forEach(listener => {
          listener({ url: 'wss://relay1.example.com', message: eventMessage });
        });
      });

      // Verify Alice received Bob's reply
      await waitFor(() => {
        const messages = aliceController.current.state.messages;
        const receivedMessage = messages.find(m => m.content === 'Hi Alice!');
        expect(receivedMessage).toBeDefined();
        expect(receivedMessage?.isOutgoing).toBe(false);
        expect(receivedMessage?.senderPubkey).toBe(bob.pub);
      }, { timeout: 2000 });

      // Verify conversation has both messages for Alice
      const conversationId = [alice.pub, bob.pub].sort().join(':');
      const aliceConversation = aliceController.current.getMessagesByConversation(conversationId);
      expect(aliceConversation.length).toBeGreaterThanOrEqual(2);
    });

    it('should handle rapid message exchanges', async () => {
      const { result } = renderHook(() =>
        useEnhancedDMController({
          myPublicKeyHex: alice.pub,
          myPrivateKeyHex: alice.priv,
          pool: mockPool,
          peerTrust: {
            isAccepted: () => true
          }
        })
      );

      await waitFor(() => {
        expect(result.current.state.status).toBe('ready');
      });

      // Send multiple messages rapidly
      const messagePromises = [];
      for (let i = 0; i < 5; i++) {
        messagePromises.push(
          act(async () => {
            await result.current.sendDm({
              peerPublicKeyInput: bob.pub,
              plaintext: `Message ${i + 1}`
            });
          })
        );
      }

      await Promise.all(messagePromises);

      // Verify all messages were sent
      await waitFor(() => {
        const messages = result.current.state.messages;
        expect(messages.length).toBeGreaterThanOrEqual(5);
        
        // Check that all messages are present
        for (let i = 0; i < 5; i++) {
          const message = messages.find(m => m.content === `Message ${i + 1}`);
          expect(message).toBeDefined();
          expect(message?.status).toBe('accepted');
        }
      }, { timeout: 3000 });
    });

    it('should maintain message ordering across send and receive', async () => {
      const { result } = renderHook(() =>
        useEnhancedDMController({
          myPublicKeyHex: alice.pub,
          myPrivateKeyHex: alice.priv,
          pool: mockPool,
          peerTrust: {
            isAccepted: () => true
          }
        })
      );

      await waitFor(() => {
        expect(result.current.state.status).toBe('ready');
      });

      // Send first message
      await act(async () => {
        await result.current.sendDm({
          peerPublicKeyInput: bob.pub,
          plaintext: 'First message'
        });
      });

      // Wait a bit
      await new Promise(resolve => setTimeout(resolve, 100));

      // Receive a message
      await act(async () => {
        const event = {
          id: 'incoming_1',
          kind: 4,
          pubkey: bob.pub,
          created_at: Math.floor(Date.now() / 1000),
          tags: [['p', alice.pub]],
          content: 'encrypted_Second message',
          sig: 'sig'
        };
        const eventMessage = JSON.stringify(['EVENT', 'sub', event]);
        messageListeners.forEach(listener => {
          listener({ url: 'wss://relay1.example.com', message: eventMessage });
        });
      });

      // Send third message
      await act(async () => {
        await result.current.sendDm({
          peerPublicKeyInput: bob.pub,
          plaintext: 'Third message'
        });
      });

      // Verify messages are in chronological order
      await waitFor(() => {
        const messages = result.current.state.messages;
        expect(messages.length).toBeGreaterThanOrEqual(3);
        
        // Messages should be sorted by timestamp (newest first in UI)
        const timestamps = messages.map(m => m.timestamp.getTime());
        for (let i = 0; i < timestamps.length - 1; i++) {
          expect(timestamps[i]).toBeGreaterThanOrEqual(timestamps[i + 1]);
        }
      });
    });
  });

  describe('Message Deduplication', () => {
    it('should deduplicate messages received multiple times', async () => {
      const { result } = renderHook(() =>
        useEnhancedDMController({
          myPublicKeyHex: alice.pub,
          myPrivateKeyHex: alice.priv,
          pool: mockPool,
          peerTrust: {
            isAccepted: () => true
          }
        })
      );

      await waitFor(() => {
        expect(result.current.state.status).toBe('ready');
      });

      const duplicateEvent = {
        id: 'duplicate_event_123',
        kind: 4,
        pubkey: bob.pub,
        created_at: Math.floor(Date.now() / 1000),
        tags: [['p', alice.pub]],
        content: 'encrypted_Duplicate message',
        sig: 'signature'
      };

      // Receive message first time
      await act(async () => {
        const eventMessage = JSON.stringify(['EVENT', 'sub', duplicateEvent]);
        messageListeners.forEach(listener => {
          listener({ url: 'wss://relay1.example.com', message: eventMessage });
        });
      });

      // Wait for processing
      await waitFor(() => {
        const messages = result.current.state.messages;
        expect(messages.some(m => m.eventId === 'duplicate_event_123')).toBe(true);
      });

      const initialMessageCount = result.current.state.messages.length;

      // Receive same message again from different relay
      await act(async () => {
        const eventMessage = JSON.stringify(['EVENT', 'sub', duplicateEvent]);
        messageListeners.forEach(listener => {
          listener({ url: 'wss://relay2.example.com', message: eventMessage });
        });
      });

      // Wait a bit for potential processing
      await new Promise(resolve => setTimeout(resolve, 200));

      // Verify message count hasn't increased
      expect(result.current.state.messages.length).toBe(initialMessageCount);
    });
  });

  describe('Error Recovery', () => {
    it('should recover from temporary encryption failures', async () => {
      // Mock encryption to fail once then succeed
      let encryptCallCount = 0;
      vi.mocked(cryptoService.encryptDM).mockImplementation(async (plaintext: string) => {
        encryptCallCount++;
        if (encryptCallCount === 1) {
          throw new Error('Temporary encryption failure');
        }
        return `encrypted_${plaintext}`;
      });

      const { result } = renderHook(() =>
        useEnhancedDMController({
          myPublicKeyHex: alice.pub,
          myPrivateKeyHex: alice.priv,
          pool: mockPool
        })
      );

      await waitFor(() => {
        expect(result.current.state.status).toBe('ready');
      });

      // First attempt should fail
      let firstResult: any;
      await act(async () => {
        firstResult = await result.current.sendDm({
          peerPublicKeyInput: bob.pub,
          plaintext: 'Test message'
        });
      });

      expect(firstResult.success).toBe(false);
      expect(firstResult.error).toBeDefined();

      // Second attempt should succeed
      let secondResult: any;
      await act(async () => {
        secondResult = await result.current.sendDm({
          peerPublicKeyInput: bob.pub,
          plaintext: 'Test message'
        });
      });

      expect(secondResult.success).toBe(true);
    });

    it('should handle decryption failures gracefully', async () => {
      // Mock decryption to fail
      vi.mocked(cryptoService.decryptDM).mockRejectedValueOnce(new Error('Decryption failed'));

      const { result } = renderHook(() =>
        useEnhancedDMController({
          myPublicKeyHex: alice.pub,
          myPrivateKeyHex: alice.priv,
          pool: mockPool,
          peerTrust: {
            isAccepted: () => true
          }
        })
      );

      await waitFor(() => {
        expect(result.current.state.status).toBe('ready');
      });

      // Receive message that will fail decryption
      await act(async () => {
        const event = {
          id: 'bad_decrypt',
          kind: 4,
          pubkey: bob.pub,
          created_at: Math.floor(Date.now() / 1000),
          tags: [['p', alice.pub]],
          content: 'encrypted_bad_content',
          sig: 'sig'
        };
        const eventMessage = JSON.stringify(['EVENT', 'sub', event]);
        messageListeners.forEach(listener => {
          listener({ url: 'wss://relay1.example.com', message: eventMessage });
        });
      });

      // Wait for processing
      await new Promise(resolve => setTimeout(resolve, 200));

      // System should still be ready (not crashed)
      expect(result.current.state.status).toBe('ready');
      
      // Bad message should not appear in state
      const badMessage = result.current.state.messages.find(m => m.eventId === 'bad_decrypt');
      expect(badMessage).toBeUndefined();
    });
  });

  describe('Multi-User Scenarios', () => {
    it('should handle messages from multiple peers simultaneously', async () => {
      const carol: PublicKeyHex = 'd3058e9f5a2b6c7d8e9f0a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d' as PublicKeyHex;

      const { result } = renderHook(() =>
        useEnhancedDMController({
          myPublicKeyHex: alice.pub,
          myPrivateKeyHex: alice.priv,
          pool: mockPool,
          peerTrust: {
            isAccepted: () => true
          }
        })
      );

      await waitFor(() => {
        expect(result.current.state.status).toBe('ready');
      });

      // Receive messages from Bob and Carol simultaneously
      await act(async () => {
        const bobEvent = {
          id: 'bob_msg',
          kind: 4,
          pubkey: bob.pub,
          created_at: Math.floor(Date.now() / 1000),
          tags: [['p', alice.pub]],
          content: 'encrypted_Message from Bob',
          sig: 'sig'
        };

        const carolEvent = {
          id: 'carol_msg',
          kind: 4,
          pubkey: carol,
          created_at: Math.floor(Date.now() / 1000),
          tags: [['p', alice.pub]],
          content: 'encrypted_Message from Carol',
          sig: 'sig'
        };

        const bobMessage = JSON.stringify(['EVENT', 'sub', bobEvent]);
        const carolMessage = JSON.stringify(['EVENT', 'sub', carolEvent]);

        messageListeners.forEach(listener => {
          listener({ url: 'wss://relay1.example.com', message: bobMessage });
          listener({ url: 'wss://relay1.example.com', message: carolMessage });
        });
      });

      // Verify both messages were received
      await waitFor(() => {
        const messages = result.current.state.messages;
        const bobMessage = messages.find(m => m.content === 'Message from Bob');
        const carolMessage = messages.find(m => m.content === 'Message from Carol');
        
        expect(bobMessage).toBeDefined();
        expect(carolMessage).toBeDefined();
        expect(bobMessage?.senderPubkey).toBe(bob.pub);
        expect(carolMessage?.senderPubkey).toBe(carol);
      }, { timeout: 2000 });
    });
  });
});
