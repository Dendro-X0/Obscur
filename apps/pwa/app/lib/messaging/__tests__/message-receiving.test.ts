/**
 * Integration tests for message receiving pipeline
 * Tests subscription management, incoming message processing, and routing
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

describe('Message Receiving Pipeline', () => {
  let mockPool: any;
  let messageHandlers: Array<(params: { url: string; message: string }) => void>;
  
  const myPublicKey = '1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef' as PublicKeyHex;
  const myPrivateKey = 'fedcba0987654321fedcba0987654321fedcba0987654321fedcba0987654321' as PrivateKeyHex;
  const senderPublicKey = 'abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890' as PublicKeyHex;

  beforeEach(() => {
    messageHandlers = [];
    
    mockPool = {
      connections: [
        { url: 'wss://relay1.example.com', status: 'open' } as RelayConnection,
        { url: 'wss://relay2.example.com', status: 'open' } as RelayConnection
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

  describe('Subscription Management', () => {
    it('should establish subscription when relay connections are available', async () => {
      const { result } = renderHook(() =>
        useEnhancedDMController({
          myPublicKeyHex: myPublicKey,
          myPrivateKeyHex: myPrivateKey,
          pool: mockPool
        })
      );

      await waitFor(() => {
        expect(mockPool.sendToOpen).toHaveBeenCalled();
      });

      // Verify REQ message was sent
      const calls = mockPool.sendToOpen.mock.calls;
      const reqCall = calls.find((call: any) => {
        try {
          const msg = JSON.parse(call[0]);
          return msg[0] === 'REQ';
        } catch {
          return false;
        }
      });

      expect(reqCall).toBeDefined();
      
      if (reqCall) {
        const reqMessage = JSON.parse(reqCall[0]);
        expect(reqMessage[0]).toBe('REQ');
        expect(reqMessage[2]).toMatchObject({
          kinds: [4],
          '#p': [myPublicKey],
          limit: 50
        });
      }
    });

    it('should track active subscriptions in state', async () => {
      const { result } = renderHook(() =>
        useEnhancedDMController({
          myPublicKeyHex: myPublicKey,
          myPrivateKeyHex: myPrivateKey,
          pool: mockPool
        })
      );

      await waitFor(() => {
        expect(result.current.state.subscriptions.length).toBeGreaterThan(0);
      });

      const subscription = result.current.state.subscriptions[0];
      expect(subscription).toMatchObject({
        filter: {
          kinds: [4],
          '#p': [myPublicKey]
        },
        isActive: true
      });
    });

    it('should allow manual subscription', () => {
      const { result } = renderHook(() =>
        useEnhancedDMController({
          myPublicKeyHex: myPublicKey,
          myPrivateKeyHex: myPrivateKey,
          pool: mockPool
        })
      );

      act(() => {
        result.current.subscribeToIncomingDMs();
      });

      expect(mockPool.sendToOpen).toHaveBeenCalled();
    });

    it('should allow unsubscribing from DMs', async () => {
      const { result } = renderHook(() =>
        useEnhancedDMController({
          myPublicKeyHex: myPublicKey,
          myPrivateKeyHex: myPrivateKey,
          pool: mockPool
        })
      );

      await waitFor(() => {
        expect(result.current.state.subscriptions.length).toBeGreaterThan(0);
      });

      act(() => {
        result.current.unsubscribeFromDMs();
      });

      // Verify CLOSE message was sent
      const calls = mockPool.sendToOpen.mock.calls;
      const closeCall = calls.find((call: any) => {
        try {
          const msg = JSON.parse(call[0]);
          return msg[0] === 'CLOSE';
        } catch {
          return false;
        }
      });

      expect(closeCall).toBeDefined();
      expect(result.current.state.subscriptions.length).toBe(0);
    });
  });

  describe('Incoming Message Processing', () => {
    it('should process valid incoming DM event', async () => {
      const mockBlocklist = {
        isBlocked: vi.fn().mockReturnValue(false)
      };
      
      const mockPeerTrust = {
        isAccepted: vi.fn().mockReturnValue(true)
      };

      const { result } = renderHook(() =>
        useEnhancedDMController({
          myPublicKeyHex: myPublicKey,
          myPrivateKeyHex: myPrivateKey,
          pool: mockPool,
          blocklist: mockBlocklist,
          peerTrust: mockPeerTrust
        })
      );

      await waitFor(() => {
        expect(messageHandlers.length).toBeGreaterThan(0);
      });

      // Simulate incoming EVENT message
      const incomingEvent = {
        id: 'event_456',
        pubkey: senderPublicKey,
        created_at: Math.floor(Date.now() / 1000),
        kind: 4,
        tags: [['p', myPublicKey]],
        content: 'encrypted_test_message',
        sig: 'valid_signature'
      };

      const eventMessage = JSON.stringify(['EVENT', 'sub_123', incomingEvent]);

      await act(async () => {
        messageHandlers[0]({ url: 'wss://relay1.example.com', message: eventMessage });
        await new Promise(resolve => setTimeout(resolve, 100));
      });

      await waitFor(() => {
        expect(result.current.state.messages.length).toBeGreaterThan(0);
      });

      const message = result.current.state.messages[0];
      expect(message).toMatchObject({
        id: 'event_456',
        content: 'Test message content',
        isOutgoing: false,
        status: 'delivered',
        senderPubkey: senderPublicKey
      });
    });

    it('should reject messages with invalid signatures', async () => {
      const { cryptoService } = await import('../../crypto/crypto-service');
      vi.mocked(cryptoService.verifyEventSignature).mockResolvedValueOnce(false);

      const { result } = renderHook(() =>
        useEnhancedDMController({
          myPublicKeyHex: myPublicKey,
          myPrivateKeyHex: myPrivateKey,
          pool: mockPool
        })
      );

      await waitFor(() => {
        expect(messageHandlers.length).toBeGreaterThan(0);
      });

      const incomingEvent = {
        id: 'event_789',
        pubkey: senderPublicKey,
        created_at: Math.floor(Date.now() / 1000),
        kind: 4,
        tags: [['p', myPublicKey]],
        content: 'encrypted_test_message',
        sig: 'invalid_signature'
      };

      const eventMessage = JSON.stringify(['EVENT', 'sub_123', incomingEvent]);

      await act(async () => {
        messageHandlers[0]({ url: 'wss://relay1.example.com', message: eventMessage });
        await new Promise(resolve => setTimeout(resolve, 100));
      });

      // Message should not be added
      expect(result.current.state.messages.length).toBe(0);
    });

    it('should handle decryption failures gracefully', async () => {
      const { cryptoService } = await import('../../crypto/crypto-service');
      vi.mocked(cryptoService.decryptDM).mockRejectedValueOnce(new Error('Decryption failed'));

      const { result } = renderHook(() =>
        useEnhancedDMController({
          myPublicKeyHex: myPublicKey,
          myPrivateKeyHex: myPrivateKey,
          pool: mockPool
        })
      );

      await waitFor(() => {
        expect(messageHandlers.length).toBeGreaterThan(0);
      });

      const incomingEvent = {
        id: 'event_999',
        pubkey: senderPublicKey,
        created_at: Math.floor(Date.now() / 1000),
        kind: 4,
        tags: [['p', myPublicKey]],
        content: 'bad_encrypted_content',
        sig: 'valid_signature'
      };

      const eventMessage = JSON.stringify(['EVENT', 'sub_123', incomingEvent]);

      await act(async () => {
        messageHandlers[0]({ url: 'wss://relay1.example.com', message: eventMessage });
        await new Promise(resolve => setTimeout(resolve, 100));
      });

      // Message should not be added due to decryption failure
      expect(result.current.state.messages.length).toBe(0);
    });
  });

  describe('Message Routing and Filtering', () => {
    it('should filter out messages from blocked senders', async () => {
      const mockBlocklist = {
        isBlocked: vi.fn().mockReturnValue(true)
      };

      const { result } = renderHook(() =>
        useEnhancedDMController({
          myPublicKeyHex: myPublicKey,
          myPrivateKeyHex: myPrivateKey,
          pool: mockPool,
          blocklist: mockBlocklist
        })
      );

      await waitFor(() => {
        expect(messageHandlers.length).toBeGreaterThan(0);
      });

      const incomingEvent = {
        id: 'event_blocked',
        pubkey: senderPublicKey,
        created_at: Math.floor(Date.now() / 1000),
        kind: 4,
        tags: [['p', myPublicKey]],
        content: 'encrypted_test_message',
        sig: 'valid_signature'
      };

      const eventMessage = JSON.stringify(['EVENT', 'sub_123', incomingEvent]);

      await act(async () => {
        messageHandlers[0]({ url: 'wss://relay1.example.com', message: eventMessage });
        await new Promise(resolve => setTimeout(resolve, 100));
      });

      // Message should be filtered out
      expect(result.current.state.messages.length).toBe(0);
      expect(mockBlocklist.isBlocked).toHaveBeenCalledWith({ publicKeyHex: senderPublicKey });
    });

    it('should route unknown sender messages to requests inbox', async () => {
      const mockPeerTrust = {
        isAccepted: vi.fn().mockReturnValue(false)
      };

      const mockRequestsInbox = {
        upsertIncoming: vi.fn()
      };

      const { result } = renderHook(() =>
        useEnhancedDMController({
          myPublicKeyHex: myPublicKey,
          myPrivateKeyHex: myPrivateKey,
          pool: mockPool,
          peerTrust: mockPeerTrust,
          requestsInbox: mockRequestsInbox
        })
      );

      await waitFor(() => {
        expect(messageHandlers.length).toBeGreaterThan(0);
      });

      const incomingEvent = {
        id: 'event_unknown',
        pubkey: senderPublicKey,
        created_at: Math.floor(Date.now() / 1000),
        kind: 4,
        tags: [['p', myPublicKey]],
        content: 'encrypted_test_message',
        sig: 'valid_signature'
      };

      const eventMessage = JSON.stringify(['EVENT', 'sub_123', incomingEvent]);

      await act(async () => {
        messageHandlers[0]({ url: 'wss://relay1.example.com', message: eventMessage });
        await new Promise(resolve => setTimeout(resolve, 100));
      });

      // Message should be routed to requests inbox, not main conversation
      expect(result.current.state.messages.length).toBe(0);
      expect(mockRequestsInbox.upsertIncoming).toHaveBeenCalledWith({
        peerPublicKeyHex: senderPublicKey,
        plaintext: 'Test message content',
        createdAtUnixSeconds: expect.any(Number)
      });
    });

    it('should add messages from accepted contacts to conversation', async () => {
      const mockPeerTrust = {
        isAccepted: vi.fn().mockReturnValue(true)
      };

      const { result } = renderHook(() =>
        useEnhancedDMController({
          myPublicKeyHex: myPublicKey,
          myPrivateKeyHex: myPrivateKey,
          pool: mockPool,
          peerTrust: mockPeerTrust
        })
      );

      await waitFor(() => {
        expect(messageHandlers.length).toBeGreaterThan(0);
      });

      const incomingEvent = {
        id: 'event_accepted',
        pubkey: senderPublicKey,
        created_at: Math.floor(Date.now() / 1000),
        kind: 4,
        tags: [['p', myPublicKey]],
        content: 'encrypted_test_message',
        sig: 'valid_signature'
      };

      const eventMessage = JSON.stringify(['EVENT', 'sub_123', incomingEvent]);

      await act(async () => {
        messageHandlers[0]({ url: 'wss://relay1.example.com', message: eventMessage });
        await new Promise(resolve => setTimeout(resolve, 100));
      });

      // Message should be added to conversation
      await waitFor(() => {
        expect(result.current.state.messages.length).toBeGreaterThan(0);
      });

      const message = result.current.state.messages[0];
      expect(message.senderPubkey).toBe(senderPublicKey);
      expect(message.isOutgoing).toBe(false);
    });
  });
});
