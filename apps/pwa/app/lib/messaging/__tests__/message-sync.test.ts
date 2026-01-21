/**
 * Integration tests for message synchronization
 * Tests missed message sync and deduplication
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { useEnhancedDMController } from '../enhanced-dm-controller';
import type { PublicKeyHex } from '@dweb/crypto/public-key-hex';
import type { PrivateKeyHex } from '@dweb/crypto/private-key-hex';
import type { RelayConnection } from '../../relays/relay-connection';

// Mock crypto service
vi.mock('../../crypto/crypto-service', () => ({
  cryptoService: {
    verifyEventSignature: vi.fn().mockResolvedValue(true),
    decryptDM: vi.fn().mockResolvedValue('Test message content'),
    encryptDM: vi.fn().mockResolvedValue('encrypted_content'),
    signEvent: vi.fn().mockResolvedValue({
      id: 'event_123',
      pubkey: 'sender_pubkey',
      created_at: Math.floor(Date.now() / 1000),
      kind: 4,
      tags: [['p', 'recipient_pubkey']],
      content: 'encrypted_content',
      sig: 'signature'
    })
  }
}));

// Mock message queue
vi.mock('../message-queue', () => ({
  MessageQueue: class MessageQueue {
    constructor(publicKey: any) {}
    persistMessage = vi.fn().mockResolvedValue(undefined);
    updateMessageStatus = vi.fn().mockResolvedValue(undefined);
    getMessage = vi.fn().mockResolvedValue(null);
    queueOutgoingMessage = vi.fn().mockResolvedValue(undefined);
  }
}));

// Mock retry manager
vi.mock('../retry-manager', () => ({
  retryManager: {
    recordRelaySuccess: vi.fn(),
    recordRelayFailure: vi.fn(),
    shouldRetry: vi.fn().mockReturnValue({ shouldRetry: false }),
    calculateNextRetry: vi.fn().mockReturnValue(new Date())
  }
}));

describe('Message Synchronization', () => {
  const mockMyPublicKey = 'my_public_key_hex' as PublicKeyHex;
  const mockMyPrivateKey = 'my_private_key_hex' as PrivateKeyHex;
  const mockPeerPublicKey = 'peer_public_key_hex' as PublicKeyHex;

  let mockRelayPool: any;
  let messageHandlers: Array<(params: { url: string; message: string }) => void>;

  beforeEach(() => {
    vi.clearAllMocks();
    messageHandlers = [];

    mockRelayPool = {
      connections: [
        { url: 'wss://relay1.example.com', status: 'open', updatedAtUnixMs: Date.now() } as RelayConnection
      ],
      sendToOpen: vi.fn(),
      subscribeToMessages: vi.fn((handler) => {
        messageHandlers.push(handler);
        return () => {
          const index = messageHandlers.indexOf(handler);
          if (index > -1) messageHandlers.splice(index, 1);
        };
      })
    };
  });

  describe('Missed Message Sync', () => {
    it('should trigger sync when coming online', async () => {
      const { result } = renderHook(() =>
        useEnhancedDMController({
          myPublicKeyHex: mockMyPublicKey,
          myPrivateKeyHex: mockMyPrivateKey,
          pool: mockRelayPool
        })
      );

      await waitFor(() => {
        expect(result.current.state.status).toBe('ready');
      });

      // Verify sync subscription was sent
      await waitFor(() => {
        const syncCalls = mockRelayPool.sendToOpen.mock.calls.filter((call: any[]) => {
          const message = call[0];
          return message.includes('REQ') && message.includes('"since"');
        });
        expect(syncCalls.length).toBeGreaterThan(0);
      }, { timeout: 2000 });
    });

    it('should use provided timestamp for sync', async () => {
      // Start with no relay connections to prevent automatic sync
      mockRelayPool.connections = [];

      const { result } = renderHook(() =>
        useEnhancedDMController({
          myPublicKeyHex: mockMyPublicKey,
          myPrivateKeyHex: mockMyPrivateKey,
          pool: mockRelayPool
        })
      );

      await waitFor(() => {
        expect(result.current.state.status).toBe('ready');
      });

      // Now add relay connection
      mockRelayPool.connections = [
        { url: 'wss://relay1.example.com', status: 'open', updatedAtUnixMs: Date.now() } as RelayConnection
      ];

      const syncTimestamp = new Date('2024-01-01T00:00:00Z');

      await act(async () => {
        await result.current.syncMissedMessages(syncTimestamp);
      });

      // Verify sync request includes the timestamp
      await waitFor(() => {
        const syncCalls = mockRelayPool.sendToOpen.mock.calls.filter((call: any[]) => {
          const message = call[0];
          if (!message.includes('REQ') || !message.includes('"since"')) return false;
          
          const parsed = JSON.parse(message);
          const expectedTimestamp = Math.floor(syncTimestamp.getTime() / 1000);
          return parsed[2]?.since === expectedTimestamp;
        });
        expect(syncCalls.length).toBeGreaterThan(0);
      });
    });

    it('should show sync progress during sync', async () => {
      const { result } = renderHook(() =>
        useEnhancedDMController({
          myPublicKeyHex: mockMyPublicKey,
          myPrivateKeyHex: mockMyPrivateKey,
          pool: mockRelayPool
        })
      );

      await waitFor(() => {
        expect(result.current.state.status).toBe('ready');
      });

      await act(async () => {
        void result.current.syncMissedMessages();
      });

      // Check that sync progress is set
      await waitFor(() => {
        expect(result.current.state.syncProgress).toBeDefined();
      });
    });

    it('should not sync when already syncing', async () => {
      const { result } = renderHook(() =>
        useEnhancedDMController({
          myPublicKeyHex: mockMyPublicKey,
          myPrivateKeyHex: mockMyPrivateKey,
          pool: mockRelayPool
        })
      );

      await waitFor(() => {
        expect(result.current.state.status).toBe('ready');
      });

      // Start first sync
      await act(async () => {
        void result.current.syncMissedMessages();
      });

      const callCountAfterFirst = mockRelayPool.sendToOpen.mock.calls.length;

      // Try to start second sync immediately
      await act(async () => {
        void result.current.syncMissedMessages();
      });

      // Should not have made additional sync requests
      expect(mockRelayPool.sendToOpen.mock.calls.length).toBe(callCountAfterFirst);
    });
  });

  describe('Message Deduplication', () => {
    it('should deduplicate messages with same event ID', async () => {
      const mockPeerTrust = {
        isAccepted: vi.fn().mockReturnValue(true)
      };

      const { result } = renderHook(() =>
        useEnhancedDMController({
          myPublicKeyHex: mockMyPublicKey,
          myPrivateKeyHex: mockMyPrivateKey,
          pool: mockRelayPool,
          peerTrust: mockPeerTrust
        })
      );

      await waitFor(() => {
        expect(result.current.state.status).toBe('ready');
      });

      // Create a test event
      const testEvent = {
        id: 'duplicate_event_123',
        pubkey: mockPeerPublicKey,
        created_at: Math.floor(Date.now() / 1000),
        kind: 4,
        tags: [['p', mockMyPublicKey]],
        content: 'encrypted_test_message',
        sig: 'test_signature'
      };

      // Send the same event twice
      const eventMessage = JSON.stringify(['EVENT', 'sub_123', testEvent]);

      await act(async () => {
        messageHandlers[0]({ url: 'wss://relay1.example.com', message: eventMessage });
        await new Promise(resolve => setTimeout(resolve, 100));
      });

      const messageCountAfterFirst = result.current.state.messages.length;

      await act(async () => {
        messageHandlers[0]({ url: 'wss://relay1.example.com', message: eventMessage });
        await new Promise(resolve => setTimeout(resolve, 100));
      });

      // Should still have the same number of messages (duplicate was ignored)
      expect(result.current.state.messages.length).toBe(messageCountAfterFirst);
    });
  });

  describe('Message Ordering', () => {
    it('should sort out-of-order messages by timestamp', async () => {
      const mockPeerTrust = {
        isAccepted: vi.fn().mockReturnValue(true)
      };

      const { result } = renderHook(() =>
        useEnhancedDMController({
          myPublicKeyHex: mockMyPublicKey,
          myPrivateKeyHex: mockMyPrivateKey,
          pool: mockRelayPool,
          peerTrust: mockPeerTrust
        })
      );

      await waitFor(() => {
        expect(result.current.state.status).toBe('ready');
      });

      const now = Math.floor(Date.now() / 1000);

      // Create events with different timestamps (send in wrong order)
      const event1 = {
        id: 'event_1',
        pubkey: mockPeerPublicKey,
        created_at: now - 100, // Oldest
        kind: 4,
        tags: [['p', mockMyPublicKey]],
        content: 'encrypted_message_1',
        sig: 'sig_1'
      };

      const event2 = {
        id: 'event_2',
        pubkey: mockPeerPublicKey,
        created_at: now - 50, // Middle
        kind: 4,
        tags: [['p', mockMyPublicKey]],
        content: 'encrypted_message_2',
        sig: 'sig_2'
      };

      const event3 = {
        id: 'event_3',
        pubkey: mockPeerPublicKey,
        created_at: now, // Newest
        kind: 4,
        tags: [['p', mockMyPublicKey]],
        content: 'encrypted_message_3',
        sig: 'sig_3'
      };

      // Send events in wrong order: newest, oldest, middle
      await act(async () => {
        messageHandlers[0]({ url: 'wss://relay1.example.com', message: JSON.stringify(['EVENT', 'sub_123', event3]) });
        await new Promise(resolve => setTimeout(resolve, 50));
      });

      await act(async () => {
        messageHandlers[0]({ url: 'wss://relay1.example.com', message: JSON.stringify(['EVENT', 'sub_123', event1]) });
        await new Promise(resolve => setTimeout(resolve, 50));
      });

      await act(async () => {
        messageHandlers[0]({ url: 'wss://relay1.example.com', message: JSON.stringify(['EVENT', 'sub_123', event2]) });
        await new Promise(resolve => setTimeout(resolve, 50));
      });

      // Verify messages are sorted by timestamp (newest first)
      const messages = result.current.state.messages;
      expect(messages.length).toBe(3);
      expect(messages[0].eventId).toBe('event_3'); // Newest
      expect(messages[1].eventId).toBe('event_2'); // Middle
      expect(messages[2].eventId).toBe('event_1'); // Oldest
    });
  });
});
