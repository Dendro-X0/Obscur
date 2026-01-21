/**
 * Integration Tests: Multi-Relay Failover and Recovery
 * 
 * Tests relay connection management, failover behavior, and recovery
 * when individual relays fail or become unavailable.
 * 
 * Requirements: 1.4, 1.5, 4.2, 4.3, 4.6, 4.8, 7.7
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

describe('Integration: Multi-Relay Failover and Recovery', () => {
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

  describe('Multi-Relay Publishing', () => {
    it('should publish to all connected relays', async () => {
      mockPool = {
        connections: [
          { url: 'wss://relay1.example.com', status: 'open' as const, updatedAtUnixMs: Date.now() },
          { url: 'wss://relay2.example.com', status: 'open' as const, updatedAtUnixMs: Date.now() },
          { url: 'wss://relay3.example.com', status: 'open' as const, updatedAtUnixMs: Date.now() }
        ],
        sendToOpen: vi.fn(),
        publishToAll: vi.fn(async () => ({
          success: true,
          successCount: 3,
          totalRelays: 3,
          results: [
            { relayUrl: 'wss://relay1.example.com', success: true, latency: 50 },
            { relayUrl: 'wss://relay2.example.com', success: true, latency: 75 },
            { relayUrl: 'wss://relay3.example.com', success: true, latency: 100 }
          ]
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

      // Send message
      let sendResult: any;
      await act(async () => {
        sendResult = await result.current.sendDm({
          peerPublicKeyInput: bob.pub,
          plaintext: 'Test message'
        });
      });

      // Verify message was published to all relays
      expect(sendResult.success).toBe(true);
      expect(sendResult.relayResults).toHaveLength(3);
      expect(sendResult.relayResults.every((r: any) => r.success)).toBe(true);
    });

    it('should succeed if at least one relay accepts', async () => {
      mockPool = {
        connections: [
          { url: 'wss://relay1.example.com', status: 'open' as const, updatedAtUnixMs: Date.now() },
          { url: 'wss://relay2.example.com', status: 'open' as const, updatedAtUnixMs: Date.now() },
          { url: 'wss://relay3.example.com', status: 'open' as const, updatedAtUnixMs: Date.now() }
        ],
        sendToOpen: vi.fn(),
        publishToAll: vi.fn(async () => ({
          success: true,
          successCount: 1,
          totalRelays: 3,
          results: [
            { relayUrl: 'wss://relay1.example.com', success: true, latency: 50 },
            { relayUrl: 'wss://relay2.example.com', success: false, error: 'Rate limited' },
            { relayUrl: 'wss://relay3.example.com', success: false, error: 'Connection timeout' }
          ]
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

      // Send message
      let sendResult: any;
      await act(async () => {
        sendResult = await result.current.sendDm({
          peerPublicKeyInput: bob.pub,
          plaintext: 'Test message'
        });
      });

      // Should succeed because one relay accepted
      expect(sendResult.success).toBe(true);
      expect(sendResult.relayResults.some((r: any) => r.success)).toBe(true);
      
      // Verify message status is 'accepted'
      await waitFor(() => {
        const messages = result.current.state.messages;
        const message = messages.find(m => m.id === sendResult.messageId);
        expect(message?.status).toBe('accepted');
      });
    });
  });

  describe('Individual Relay Failures', () => {
    it('should continue with other relays when one fails', async () => {
      mockPool = {
        connections: [
          { url: 'wss://relay1.example.com', status: 'open' as const, updatedAtUnixMs: Date.now() },
          { url: 'wss://relay2.example.com', status: 'error' as const, updatedAtUnixMs: Date.now() },
          { url: 'wss://relay3.example.com', status: 'open' as const, updatedAtUnixMs: Date.now() }
        ],
        sendToOpen: vi.fn(),
        publishToAll: vi.fn(async () => ({
          success: true,
          successCount: 2,
          totalRelays: 3,
          results: [
            { relayUrl: 'wss://relay1.example.com', success: true },
            { relayUrl: 'wss://relay2.example.com', success: false, error: 'Connection error' },
            { relayUrl: 'wss://relay3.example.com', success: true }
          ]
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

      // Send message
      let sendResult: any;
      await act(async () => {
        sendResult = await result.current.sendDm({
          peerPublicKeyInput: bob.pub,
          plaintext: 'Test message'
        });
      });

      // Should succeed with 2 out of 3 relays
      expect(sendResult.success).toBe(true);
      expect(sendResult.relayResults.filter((r: any) => r.success).length).toBe(2);
    });

    it('should track relay-specific failures', async () => {
      mockPool = {
        connections: [
          { url: 'wss://relay1.example.com', status: 'open' as const, updatedAtUnixMs: Date.now() },
          { url: 'wss://relay2.example.com', status: 'open' as const, updatedAtUnixMs: Date.now() }
        ],
        sendToOpen: vi.fn(),
        publishToAll: vi.fn(async () => ({
          success: true,
          successCount: 1,
          totalRelays: 2,
          results: [
            { relayUrl: 'wss://relay1.example.com', success: true },
            { relayUrl: 'wss://relay2.example.com', success: false, error: 'Rate limited' }
          ]
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

      // Send message
      let sendResult: any;
      await act(async () => {
        sendResult = await result.current.sendDm({
          peerPublicKeyInput: bob.pub,
          plaintext: 'Test message'
        });
      });

      // Verify relay results are tracked
      expect(sendResult.relayResults).toHaveLength(2);
      
      const relay1Result = sendResult.relayResults.find((r: any) => r.relayUrl === 'wss://relay1.example.com');
      const relay2Result = sendResult.relayResults.find((r: any) => r.relayUrl === 'wss://relay2.example.com');
      
      expect(relay1Result?.success).toBe(true);
      expect(relay2Result?.success).toBe(false);
      expect(relay2Result?.error).toBe('Rate limited');
    });
  });

  describe('All Relays Fail', () => {
    it('should queue message when all relays fail', async () => {
      mockPool = {
        connections: [
          { url: 'wss://relay1.example.com', status: 'open' as const, updatedAtUnixMs: Date.now() },
          { url: 'wss://relay2.example.com', status: 'open' as const, updatedAtUnixMs: Date.now() }
        ],
        sendToOpen: vi.fn(),
        publishToAll: vi.fn(async () => ({
          success: false,
          successCount: 0,
          totalRelays: 2,
          results: [
            { relayUrl: 'wss://relay1.example.com', success: false, error: 'Rejected' },
            { relayUrl: 'wss://relay2.example.com', success: false, error: 'Rejected' }
          ],
          overallError: 'All relays rejected'
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

      // Send message
      let sendResult: any;
      await act(async () => {
        sendResult = await result.current.sendDm({
          peerPublicKeyInput: bob.pub,
          plaintext: 'Test message'
        });
      });

      // Should fail
      expect(sendResult.success).toBe(false);
      
      // Message should be queued for retry
      await waitFor(() => {
        const messages = result.current.state.messages;
        const message = messages.find(m => m.content === 'Test message');
        expect(message).toBeDefined();
        expect(['queued', 'rejected']).toContain(message?.status);
      });
    });
  });

  describe('Relay Recovery', () => {
    it('should handle relay coming back online', async () => {
      // Start with one relay offline
      mockPool = {
        connections: [
          { url: 'wss://relay1.example.com', status: 'open' as const, updatedAtUnixMs: Date.now() },
          { url: 'wss://relay2.example.com', status: 'closed' as const, updatedAtUnixMs: Date.now() }
        ],
        sendToOpen: vi.fn(),
        publishToAll: vi.fn(async () => ({
          success: true,
          successCount: 1,
          totalRelays: 2,
          results: [
            { relayUrl: 'wss://relay1.example.com', success: true },
            { relayUrl: 'wss://relay2.example.com', success: false, error: 'Offline' }
          ]
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

      // Send message with one relay offline
      await act(async () => {
        await result.current.sendDm({
          peerPublicKeyInput: bob.pub,
          plaintext: 'Message 1'
        });
      });

      // Bring relay2 back online
      mockPool.connections = [
        { url: 'wss://relay1.example.com', status: 'open' as const, updatedAtUnixMs: Date.now() },
        { url: 'wss://relay2.example.com', status: 'open' as const, updatedAtUnixMs: Date.now() }
      ];
      mockPool.publishToAll = vi.fn(async () => ({
        success: true,
        successCount: 2,
        totalRelays: 2,
        results: [
          { relayUrl: 'wss://relay1.example.com', success: true },
          { relayUrl: 'wss://relay2.example.com', success: true }
        ]
      }));

      rerender();

      // Send another message
      let sendResult: any;
      await act(async () => {
        sendResult = await result.current.sendDm({
          peerPublicKeyInput: bob.pub,
          plaintext: 'Message 2'
        });
      });

      // Should now succeed with both relays
      expect(sendResult.success).toBe(true);
      expect(sendResult.relayResults.filter((r: any) => r.success).length).toBe(2);
    });
  });

  describe('Relay Performance Tracking', () => {
    it('should track relay latency', async () => {
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
            { relayUrl: 'wss://relay1.example.com', success: true, latency: 50 },
            { relayUrl: 'wss://relay2.example.com', success: true, latency: 200 }
          ]
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

      // Send message
      let sendResult: any;
      await act(async () => {
        sendResult = await result.current.sendDm({
          peerPublicKeyInput: bob.pub,
          plaintext: 'Test message'
        });
      });

      // Verify latency is tracked
      expect(sendResult.relayResults[0].latency).toBeDefined();
      expect(sendResult.relayResults[1].latency).toBeDefined();
      
      // Relay1 should be faster
      const relay1 = sendResult.relayResults.find((r: any) => r.relayUrl === 'wss://relay1.example.com');
      const relay2 = sendResult.relayResults.find((r: any) => r.relayUrl === 'wss://relay2.example.com');
      
      expect(relay1.latency).toBeLessThan(relay2.latency);
    });
  });

  describe('Subscription Management Across Relays', () => {
    it('should subscribe to all open relays', async () => {
      mockPool = {
        connections: [
          { url: 'wss://relay1.example.com', status: 'open' as const, updatedAtUnixMs: Date.now() },
          { url: 'wss://relay2.example.com', status: 'open' as const, updatedAtUnixMs: Date.now() },
          { url: 'wss://relay3.example.com', status: 'closed' as const, updatedAtUnixMs: Date.now() }
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

      // Verify subscription was sent to open relays
      expect(mockPool.sendToOpen).toHaveBeenCalled();
      
      // Check for REQ message
      const calls = mockPool.sendToOpen.mock.calls;
      const reqCall = calls.find((call: any[]) => {
        const message = call[0];
        return message.includes('REQ') && message.includes('"kinds":[4]');
      });
      expect(reqCall).toBeDefined();
    });

    it('should receive messages from any connected relay', async () => {
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

      // Receive message from relay1
      await act(async () => {
        const event = {
          id: 'msg_from_relay1',
          kind: 4,
          pubkey: bob.pub,
          created_at: Math.floor(Date.now() / 1000),
          tags: [['p', alice.pub]],
          content: 'encrypted_From relay 1',
          sig: 'sig'
        };
        const eventMessage = JSON.stringify(['EVENT', 'sub', event]);
        messageListeners.forEach(listener => {
          listener({ url: 'wss://relay1.example.com', message: eventMessage });
        });
      });

      // Receive message from relay2
      await act(async () => {
        const event = {
          id: 'msg_from_relay2',
          kind: 4,
          pubkey: bob.pub,
          created_at: Math.floor(Date.now() / 1000),
          tags: [['p', alice.pub]],
          content: 'encrypted_From relay 2',
          sig: 'sig'
        };
        const eventMessage = JSON.stringify(['EVENT', 'sub', event]);
        messageListeners.forEach(listener => {
          listener({ url: 'wss://relay2.example.com', message: eventMessage });
        });
      });

      // Verify both messages were received
      await waitFor(() => {
        const messages = result.current.state.messages;
        expect(messages.some(m => m.content === 'From relay 1')).toBe(true);
        expect(messages.some(m => m.content === 'From relay 2')).toBe(true);
      }, { timeout: 2000 });
    });
  });
});
