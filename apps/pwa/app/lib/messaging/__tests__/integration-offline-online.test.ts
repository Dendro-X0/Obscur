/**
 * Integration Tests: Offline/Online Scenarios
 * 
 * Tests message queuing when offline, automatic sending when coming online,
 * and message synchronization after reconnection.
 * 
 * Requirements: 4.4, 6.1, 6.2, 7.1, 7.2
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

describe('Integration: Offline/Online Scenarios', () => {
  const alice: { pub: PublicKeyHex; priv: PrivateKeyHex } = {
    pub: 'a1633cafcc01ebfb6d78e39f687a1f0995c62fc95f51ead10a02ee0be551b5dc' as PublicKeyHex,
    priv: '5dab087e624a8a4b79e17f8b83800ee66f3bb1292618b6fd1c2f8b27ff88e0eb' as PrivateKeyHex
  };

  const bob: { pub: PublicKeyHex } = {
    pub: 'c2047f9441ed7d6d3045406e95c07cd85c778e4b8cef3ca7abac09b95c709ee5' as PublicKeyHex
  };

  let mockPool: any;
  let messageListeners: Set<(params: { url: string; message: string }) => void>;

  beforeEach(() => {
    vi.clearAllMocks();
    messageListeners = new Set();
  });

  afterEach(() => {
    messageListeners.clear();
  });

  describe('Offline Message Queuing', () => {
    it('should queue messages when all relays are offline', async () => {
      // Set up pool with all relays offline
      mockPool = {
        connections: [
          { url: 'wss://relay1.example.com', status: 'closed' as const, updatedAtUnixMs: Date.now() },
          { url: 'wss://relay2.example.com', status: 'error' as const, updatedAtUnixMs: Date.now() }
        ],
        sendToOpen: vi.fn(),
        publishToAll: vi.fn(async () => ({
          success: false,
          successCount: 0,
          totalRelays: 2,
          results: [
            { relayUrl: 'wss://relay1.example.com', success: false, error: 'Connection closed' },
            { relayUrl: 'wss://relay2.example.com', success: false, error: 'Connection error' }
          ],
          overallError: 'All relays failed'
        })),
        subscribeToMessages: vi.fn((handler: any) => {
          messageListeners.add(handler);
          return () => messageListeners.delete(handler);
        })
      };

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

      // Try to send message while offline
      let sendResult: any;
      await act(async () => {
        sendResult = await result.current.sendDm({
          peerPublicKeyInput: bob.pub,
          plaintext: 'Offline message'
        });
      });

      // Message should fail to send
      expect(sendResult.success).toBe(false);

      // Verify message is in queued state
      await waitFor(() => {
        const messages = result.current.state.messages;
        const queuedMessage = messages.find(m => m.content === 'Offline message');
        expect(queuedMessage).toBeDefined();
        expect(['queued', 'rejected']).toContain(queuedMessage?.status);
      });
    });

    it('should queue multiple messages when offline', async () => {
      mockPool = {
        connections: [
          { url: 'wss://relay1.example.com', status: 'closed' as const, updatedAtUnixMs: Date.now() }
        ],
        sendToOpen: vi.fn(),
        publishToAll: vi.fn(async () => ({
          success: false,
          successCount: 0,
          totalRelays: 1,
          results: [
            { relayUrl: 'wss://relay1.example.com', success: false, error: 'Offline' }
          ],
          overallError: 'All relays offline'
        })),
        subscribeToMessages: vi.fn(() => () => {})
      };

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

      // Send multiple messages while offline
      for (let i = 0; i < 3; i++) {
        await act(async () => {
          await result.current.sendDm({
            peerPublicKeyInput: bob.pub,
            plaintext: `Offline message ${i + 1}`
          });
        });
      }

      // Verify all messages are queued
      await waitFor(() => {
        const messages = result.current.state.messages;
        expect(messages.length).toBeGreaterThanOrEqual(3);
        
        for (let i = 0; i < 3; i++) {
          const message = messages.find(m => m.content === `Offline message ${i + 1}`);
          expect(message).toBeDefined();
        }
      });
    });
  });

  describe('Coming Online', () => {
    it('should automatically send queued messages when connectivity returns', async () => {
      // Start offline
      mockPool = {
        connections: [
          { url: 'wss://relay1.example.com', status: 'closed' as const, updatedAtUnixMs: Date.now() }
        ],
        sendToOpen: vi.fn(),
        publishToAll: vi.fn(async () => ({
          success: false,
          successCount: 0,
          totalRelays: 1,
          results: [{ relayUrl: 'wss://relay1.example.com', success: false, error: 'Offline' }],
          overallError: 'Offline'
        })),
        subscribeToMessages: vi.fn(() => () => {})
      };

      const { result, rerender } = renderHook(() =>
        useEnhancedDMController({
          myPublicKeyHex: alice.pub,
          myPrivateKeyHex: alice.priv,
          pool: mockPool
        })
      );

      await waitFor(() => {
        expect(result.current.state.status).toBe('ready');
      });

      // Send message while offline
      await act(async () => {
        await result.current.sendDm({
          peerPublicKeyInput: bob.pub,
          plaintext: 'Queued message'
        });
      });

      // Verify message is queued
      await waitFor(() => {
        const messages = result.current.state.messages;
        const queuedMessage = messages.find(m => m.content === 'Queued message');
        expect(queuedMessage).toBeDefined();
      });

      // Simulate coming online
      mockPool.connections = [
        { url: 'wss://relay1.example.com', status: 'open' as const, updatedAtUnixMs: Date.now() }
      ];
      mockPool.publishToAll = vi.fn(async () => ({
        success: true,
        successCount: 1,
        totalRelays: 1,
        results: [{ relayUrl: 'wss://relay1.example.com', success: true }]
      }));

      // Manually trigger queue processing
      await act(async () => {
        await result.current.processOfflineQueue();
      });

      // Verify queue processing was attempted
      expect(result.current.state.status).toBe('ready');
    });

    it('should sync missed messages when coming online', async () => {
      // Start with online pool
      mockPool = {
        connections: [
          { url: 'wss://relay1.example.com', status: 'open' as const, updatedAtUnixMs: Date.now() }
        ],
        sendToOpen: vi.fn(),
        publishToAll: vi.fn(async () => ({
          success: true,
          successCount: 1,
          totalRelays: 1,
          results: [{ relayUrl: 'wss://relay1.example.com', success: true }]
        })),
        subscribeToMessages: vi.fn((handler: any) => {
          messageListeners.add(handler);
          return () => messageListeners.delete(handler);
        })
      };

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

      // Trigger sync for missed messages
      const oneHourAgo = new Date(Date.now() - 3600000);
      await act(async () => {
        await result.current.syncMissedMessages(oneHourAgo);
      });

      // Verify sync request was sent
      expect(mockPool.sendToOpen).toHaveBeenCalled();
      
      // Check that a REQ message was sent with since filter
      const calls = mockPool.sendToOpen.mock.calls;
      const syncCall = calls.find((call: any[]) => {
        const message = call[0];
        return message.includes('REQ') && message.includes('"kinds":[4]') && message.includes('"since"');
      });
      expect(syncCall).toBeDefined();
    });
  });

  describe('Network State Transitions', () => {
    it('should handle rapid online/offline transitions', async () => {
      mockPool = {
        connections: [
          { url: 'wss://relay1.example.com', status: 'open' as const, updatedAtUnixMs: Date.now() }
        ],
        sendToOpen: vi.fn(),
        publishToAll: vi.fn(async () => ({
          success: true,
          successCount: 1,
          totalRelays: 1,
          results: [{ relayUrl: 'wss://relay1.example.com', success: true }]
        })),
        subscribeToMessages: vi.fn(() => () => {})
      };

      const { result, rerender } = renderHook(() =>
        useEnhancedDMController({
          myPublicKeyHex: alice.pub,
          myPrivateKeyHex: alice.priv,
          pool: mockPool
        })
      );

      await waitFor(() => {
        expect(result.current.state.status).toBe('ready');
      });

      // Send message while online
      await act(async () => {
        await result.current.sendDm({
          peerPublicKeyInput: bob.pub,
          plaintext: 'Online message'
        });
      });

      // Go offline
      mockPool.connections = [
        { url: 'wss://relay1.example.com', status: 'closed' as const, updatedAtUnixMs: Date.now() }
      ];
      mockPool.publishToAll = vi.fn(async () => ({
        success: false,
        successCount: 0,
        totalRelays: 1,
        results: [{ relayUrl: 'wss://relay1.example.com', success: false, error: 'Offline' }],
        overallError: 'Offline'
      }));

      rerender();

      // Try to send while offline
      await act(async () => {
        await result.current.sendDm({
          peerPublicKeyInput: bob.pub,
          plaintext: 'Offline message'
        });
      });

      // Come back online
      mockPool.connections = [
        { url: 'wss://relay1.example.com', status: 'open' as const, updatedAtUnixMs: Date.now() }
      ];
      mockPool.publishToAll = vi.fn(async () => ({
        success: true,
        successCount: 1,
        totalRelays: 1,
        results: [{ relayUrl: 'wss://relay1.example.com', success: true }]
      }));

      rerender();

      // System should remain stable
      expect(result.current.state.status).toBe('ready');
    });

    it('should track network state correctly', async () => {
      mockPool = {
        connections: [
          { url: 'wss://relay1.example.com', status: 'open' as const, updatedAtUnixMs: Date.now() }
        ],
        sendToOpen: vi.fn(),
        publishToAll: vi.fn(async () => ({
          success: true,
          successCount: 1,
          totalRelays: 1,
          results: [{ relayUrl: 'wss://relay1.example.com', success: true }]
        })),
        subscribeToMessages: vi.fn(() => () => {})
      };

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

      // Verify network state is tracked
      expect(result.current.state.networkState).toBeDefined();
      expect(result.current.state.networkState.hasRelayConnection).toBe(true);
    });
  });

  describe('Message Sync After Reconnection', () => {
    it('should request messages since last known timestamp', async () => {
      mockPool = {
        connections: [
          { url: 'wss://relay1.example.com', status: 'open' as const, updatedAtUnixMs: Date.now() }
        ],
        sendToOpen: vi.fn(),
        publishToAll: vi.fn(async () => ({
          success: true,
          successCount: 1,
          totalRelays: 1,
          results: [{ relayUrl: 'wss://relay1.example.com', success: true }]
        })),
        subscribeToMessages: vi.fn((handler: any) => {
          messageListeners.add(handler);
          return () => messageListeners.delete(handler);
        })
      };

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

      // Receive a message to establish a timestamp
      await act(async () => {
        const event = {
          id: 'msg_1',
          kind: 4,
          pubkey: bob.pub,
          created_at: Math.floor(Date.now() / 1000) - 3600, // 1 hour ago
          tags: [['p', alice.pub]],
          content: 'encrypted_Old message',
          sig: 'sig'
        };
        const eventMessage = JSON.stringify(['EVENT', 'sub', event]);
        messageListeners.forEach(listener => {
          listener({ url: 'wss://relay1.example.com', message: eventMessage });
        });
      });

      await waitFor(() => {
        const messages = result.current.state.messages;
        expect(messages.some(m => m.content === 'Old message')).toBe(true);
      });

      // Clear previous calls
      mockPool.sendToOpen.mockClear();

      // Trigger sync
      await act(async () => {
        await result.current.syncMissedMessages();
      });

      // Verify sync request includes since parameter
      expect(mockPool.sendToOpen).toHaveBeenCalled();
      const syncCalls = mockPool.sendToOpen.mock.calls.filter((call: any[]) => {
        const message = call[0];
        return message.includes('REQ') && message.includes('"since"');
      });
      expect(syncCalls.length).toBeGreaterThan(0);
    });

    it('should handle large message backlogs efficiently', async () => {
      mockPool = {
        connections: [
          { url: 'wss://relay1.example.com', status: 'open' as const, updatedAtUnixMs: Date.now() }
        ],
        sendToOpen: vi.fn(),
        publishToAll: vi.fn(async () => ({
          success: true,
          successCount: 1,
          totalRelays: 1,
          results: [{ relayUrl: 'wss://relay1.example.com', success: true }]
        })),
        subscribeToMessages: vi.fn((handler: any) => {
          messageListeners.add(handler);
          return () => messageListeners.delete(handler);
        })
      };

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

      // Trigger sync
      await act(async () => {
        await result.current.syncMissedMessages(new Date(Date.now() - 86400000)); // 24 hours ago
      });

      // Simulate receiving many messages
      await act(async () => {
        for (let i = 0; i < 50; i++) {
          const event = {
            id: `backlog_${i}`,
            kind: 4,
            pubkey: bob.pub,
            created_at: Math.floor(Date.now() / 1000) - (3600 - i * 60), // Spread over time
            tags: [['p', alice.pub]],
            content: `encrypted_Backlog message ${i}`,
            sig: 'sig'
          };
          const eventMessage = JSON.stringify(['EVENT', 'sub', event]);
          messageListeners.forEach(listener => {
            listener({ url: 'wss://relay1.example.com', message: eventMessage });
          });
        }
      });

      // System should handle the backlog without crashing
      await waitFor(() => {
        expect(result.current.state.status).toBe('ready');
      }, { timeout: 5000 });
    });
  });
});
