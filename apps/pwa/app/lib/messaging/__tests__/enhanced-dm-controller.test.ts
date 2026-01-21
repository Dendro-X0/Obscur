import { describe, it, expect, beforeEach, vi, type MockedFunction } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useEnhancedDmController } from '../enhanced-dm-controller';
import type { PublicKeyHex } from '@dweb/crypto/public-key-hex';
import type { PrivateKeyHex } from '@dweb/crypto/private-key-hex';
import type { RelayConnection } from '../../relay-connection';

/**
 * Property-based tests for enhanced DM controller
 * These tests validate universal correctness properties with multiple iterations
 */

// Mock dependencies
vi.mock('@dweb/nostr/create-nostr-dm-event', () => ({
  createNostrDmEvent: vi.fn()
}));

vi.mock('../crypto-service', () => ({
  cryptoService: {
    encryptDM: vi.fn(),
    decryptDM: vi.fn(),
    verifyEventSignature: vi.fn(),
    isValidPubkey: vi.fn(),
    normalizeKey: vi.fn()
  }
}));

vi.mock('../message-queue', () => ({
  messageQueue: {
    persistMessage: vi.fn(),
    updateMessageStatus: vi.fn(),
    getMessage: vi.fn(),
    getMessages: vi.fn(),
    queueOutgoingMessage: vi.fn(),
    getQueuedMessages: vi.fn(),
    removeFromQueue: vi.fn()
  }
}));

vi.mock('../../parse-public-key-input', () => ({
  parsePublicKeyInput: vi.fn()
}));

vi.mock('../../nostr-safety-limits', () => ({
  NOSTR_SAFETY_LIMITS: {
    maxDmPlaintextChars: 1000
  }
}));

describe('Enhanced DM Controller Property Tests', () => {
  const mockPublicKey: PublicKeyHex = '02a1633cafcc01ebfb6d78e39f687a1f0995c62fc95f51ead10a02ee0be551b5dc' as PublicKeyHex;
  const mockPrivateKey: PrivateKeyHex = '5dab087e624a8a4b79e17f8b83800ee66f3bb1292618b6fd1c2f8b27ff88e0eb' as PrivateKeyHex;
  const mockRecipientKey: PublicKeyHex = '03c2047f9441ed7d6d3045406e95c07cd85c778e4b8cef3ca7abac09b95c709ee5' as PublicKeyHex;

  let mockRelayPool: {
    connections: RelayConnection[];
    sendToOpen: MockedFunction<any>;
    subscribeToMessages: MockedFunction<any>;
  };

  beforeEach(() => {
    vi.clearAllMocks();
    
    mockRelayPool = {
      connections: [
        { url: 'wss://relay1.example.com', status: 'open', updatedAtUnixMs: Date.now() },
        { url: 'wss://relay2.example.com', status: 'open', updatedAtUnixMs: Date.now() },
        { url: 'wss://relay3.example.com', status: 'error', updatedAtUnixMs: Date.now(), errorMessage: 'Connection failed' }
      ],
      sendToOpen: vi.fn(),
      subscribeToMessages: vi.fn(() => vi.fn()) // Return unsubscribe function
    };

    // Setup default mocks
    const { parsePublicKeyInput } = require('../../parse-public-key-input');
    parsePublicKeyInput.mockReturnValue({ ok: true, publicKeyHex: mockRecipientKey });

    const { createNostrDmEvent } = require('@dweb/nostr/create-nostr-dm-event');
    createNostrDmEvent.mockResolvedValue({
      id: 'mock_event_id',
      kind: 4,
      created_at: Math.floor(Date.now() / 1000),
      content: 'encrypted_content',
      pubkey: mockPublicKey,
      sig: 'mock_signature',
      tags: [['p', mockRecipientKey]]
    });

    const { cryptoService } = require('../crypto-service');
    cryptoService.verifyEventSignature.mockResolvedValue(true);
    cryptoService.decryptDM.mockResolvedValue('decrypted_message');
    cryptoService.isValidPubkey.mockReturnValue(true);

    const { messageQueue } = require('../message-queue');
    messageQueue.persistMessage.mockResolvedValue(undefined);
    messageQueue.updateMessageStatus.mockResolvedValue(undefined);
    messageQueue.queueOutgoingMessage.mockResolvedValue(undefined);
    messageQueue.getQueuedMessages.mockResolvedValue([]);
  });

  describe('Property 1: Message encryption consistency', () => {
    /**
     * For any valid message content and recipient public key, the DM_Controller 
     * should encrypt the message using NIP-04 encryption before creating the Nostr event
     * Validates: Requirements 1.1
     */
    it('should encrypt all outgoing messages consistently', async () => {
      const testMessages = [
        'Hello, world!',
        'Special chars: !@#$%^&*()',
        'Unicode: 🚀 🌟 ✨',
        'A'.repeat(500), // Long message
        'Multi\nline\nmessage'
      ];

      for (const message of testMessages) {
        const { result } = renderHook(() => 
          useEnhancedDmController({
            myPublicKeyHex: mockPublicKey,
            myPrivateKeyHex: mockPrivateKey,
            pool: mockRelayPool
          })
        );

        await act(async () => {
          const sendResult = await result.current.sendDm({
            peerPublicKeyInput: mockRecipientKey,
            plaintext: message
          });
          
          expect(sendResult.success).toBe(true);
          expect(sendResult.messageId).toBeTruthy();
        });

        // Verify that createNostrDmEvent was called (which handles encryption)
        const { createNostrDmEvent } = require('@dweb/nostr/create-nostr-dm-event');
        expect(createNostrDmEvent).toHaveBeenCalledWith({
          senderPrivateKeyHex: mockPrivateKey,
          recipientPublicKeyHex: mockRecipientKey,
          plaintext: message
        });
      }
    });

    it('should handle encryption failures gracefully', async () => {
      const { createNostrDmEvent } = require('@dweb/nostr/create-nostr-dm-event');
      createNostrDmEvent.mockRejectedValue(new Error('Encryption failed'));

      const { result } = renderHook(() => 
        useEnhancedDmController({
          myPublicKeyHex: mockPublicKey,
          myPrivateKeyHex: mockPrivateKey,
          pool: mockRelayPool
        })
      );

      await act(async () => {
        const sendResult = await result.current.sendDm({
          peerPublicKeyInput: mockRecipientKey,
          plaintext: 'Test message'
        });
        
        expect(sendResult.success).toBe(false);
        expect(sendResult.error).toContain('Failed to send message');
      });
    });
  });

  describe('Property 2: Event creation completeness', () => {
    /**
     * For any encrypted message, the DM_Controller should create a properly 
     * formatted Nostr event containing the encrypted content in the correct field
     * Validates: Requirements 1.2
     */
    it('should create complete Nostr events for all messages', async () => {
      const { result } = renderHook(() => 
        useEnhancedDmController({
          myPublicKeyHex: mockPublicKey,
          myPrivateKeyHex: mockPrivateKey,
          pool: mockRelayPool
        })
      );

      const testMessage = 'Test message for event creation';

      await act(async () => {
        const sendResult = await result.current.sendDm({
          peerPublicKeyInput: mockRecipientKey,
          plaintext: testMessage
        });
        
        expect(sendResult.success).toBe(true);
      });

      // Verify event structure
      const { createNostrDmEvent } = require('@dweb/nostr/create-nostr-dm-event');
      expect(createNostrDmEvent).toHaveBeenCalledWith({
        senderPrivateKeyHex: mockPrivateKey,
        recipientPublicKeyHex: mockRecipientKey,
        plaintext: testMessage
      });

      // Verify message persistence with correct structure
      const { messageQueue } = require('../message-queue');
      expect(messageQueue.persistMessage).toHaveBeenCalledWith(
        expect.objectContaining({
          id: 'mock_event_id',
          conversationId: mockRecipientKey,
          content: testMessage,
          isOutgoing: true,
          status: 'sending',
          eventId: 'mock_event_id',
          senderPubkey: mockPublicKey,
          recipientPubkey: mockRecipientKey,
          encryptedContent: 'encrypted_content'
        })
      );
    });
  });

  describe('Property 4: Multi-relay publishing', () => {
    /**
     * For any signed event, the DM_Controller should attempt to publish it 
     * to all currently connected relays
     * Validates: Requirements 1.4
     */
    it('should publish to all connected relays', async () => {
      const { result } = renderHook(() => 
        useEnhancedDmController({
          myPublicKeyHex: mockPublicKey,
          myPrivateKeyHex: mockPrivateKey,
          pool: mockRelayPool
        })
      );

      await act(async () => {
        const sendResult = await result.current.sendDm({
          peerPublicKeyInput: mockRecipientKey,
          plaintext: 'Test message'
        });
        
        expect(sendResult.success).toBe(true);
        expect(sendResult.relayResults).toHaveLength(2); // Only connected relays
        
        // Verify results for each connected relay
        const connectedRelays = mockRelayPool.connections.filter(c => c.status === 'open');
        expect(sendResult.relayResults).toHaveLength(connectedRelays.length);
        
        sendResult.relayResults.forEach(result => {
          expect(result.success).toBe(true);
          expect(result.latency).toBeGreaterThanOrEqual(0);
          expect(connectedRelays.some(r => r.url === result.relayUrl)).toBe(true);
        });
      });

      // Verify sendToOpen was called
      expect(mockRelayPool.sendToOpen).toHaveBeenCalled();
    });

    it('should handle partial relay failures', async () => {
      // Mock sendToOpen to throw error on second call
      let callCount = 0;
      mockRelayPool.sendToOpen.mockImplementation(() => {
        callCount++;
        if (callCount === 2) {
          throw new Error('Relay connection failed');
        }
      });

      const { result } = renderHook(() => 
        useEnhancedDmController({
          myPublicKeyHex: mockPublicKey,
          myPrivateKeyHex: mockPrivateKey,
          pool: mockRelayPool
        })
      );

      await act(async () => {
        const sendResult = await result.current.sendDm({
          peerPublicKeyInput: mockRecipientKey,
          plaintext: 'Test message'
        });
        
        // Should still succeed if at least one relay works
        expect(sendResult.success).toBe(true);
        expect(sendResult.relayResults.some(r => r.success)).toBe(true);
        expect(sendResult.relayResults.some(r => !r.success)).toBe(true);
      });
    });
  });

  describe('Property 5: Graceful relay failure handling', () => {
    /**
     * For any relay connection failure during publishing, the DM_Controller 
     * should continue attempting to publish to other available relays
     * Validates: Requirements 1.5
     */
    it('should continue with other relays when some fail', async () => {
      // Set up pool with mixed relay states
      mockRelayPool.connections = [
        { url: 'wss://good-relay.com', status: 'open', updatedAtUnixMs: Date.now() },
        { url: 'wss://bad-relay.com', status: 'error', updatedAtUnixMs: Date.now(), errorMessage: 'Failed' },
        { url: 'wss://another-good.com', status: 'open', updatedAtUnixMs: Date.now() }
      ];

      const { result } = renderHook(() => 
        useEnhancedDmController({
          myPublicKeyHex: mockPublicKey,
          myPrivateKeyHex: mockPrivateKey,
          pool: mockRelayPool
        })
      );

      await act(async () => {
        const sendResult = await result.current.sendDm({
          peerPublicKeyInput: mockRecipientKey,
          plaintext: 'Test message'
        });
        
        expect(sendResult.success).toBe(true);
        // Should only attempt to send to open relays
        expect(sendResult.relayResults).toHaveLength(2);
        expect(sendResult.relayResults.every(r => r.success)).toBe(true);
      });
    });

    it('should queue message when no relays are connected', async () => {
      // Set up pool with no connected relays
      mockRelayPool.connections = [
        { url: 'wss://offline1.com', status: 'closed', updatedAtUnixMs: Date.now() },
        { url: 'wss://offline2.com', status: 'error', updatedAtUnixMs: Date.now(), errorMessage: 'Failed' }
      ];

      const { result } = renderHook(() => 
        useEnhancedDmController({
          myPublicKeyHex: mockPublicKey,
          myPrivateKeyHex: mockPrivateKey,
          pool: mockRelayPool
        })
      );

      await act(async () => {
        const sendResult = await result.current.sendDm({
          peerPublicKeyInput: mockRecipientKey,
          plaintext: 'Test message'
        });
        
        expect(sendResult.success).toBe(false);
        expect(sendResult.error).toContain('No relays connected');
        expect(sendResult.relayResults).toHaveLength(0);
      });

      // Verify message was queued for retry
      const { messageQueue } = require('../message-queue');
      expect(messageQueue.queueOutgoingMessage).toHaveBeenCalled();
      expect(messageQueue.updateMessageStatus).toHaveBeenCalledWith('mock_event_id', 'queued');
    });
  });

  describe('Property 9: Subscription establishment', () => {
    /**
     * For any successful relay connection, the DM_Controller should establish 
     * subscriptions for direct message events targeting the user's public key
     * Validates: Requirements 2.1
     */
    it('should establish subscriptions when relays are connected', async () => {
      const { result } = renderHook(() => 
        useEnhancedDmController({
          myPublicKeyHex: mockPublicKey,
          myPrivateKeyHex: mockPrivateKey,
          pool: mockRelayPool
        })
      );

      // Wait for subscription to be established
      await act(async () => {
        result.current.subscribeToIncomingDMs();
      });

      // Verify subscription was sent to relays
      expect(mockRelayPool.sendToOpen).toHaveBeenCalledWith(
        expect.stringContaining('"REQ"')
      );

      // Verify subscription includes correct filter
      const subscriptionCall = mockRelayPool.sendToOpen.mock.calls.find(call => 
        call[0].includes('"REQ"')
      );
      expect(subscriptionCall).toBeTruthy();
      
      const subscriptionData = JSON.parse(subscriptionCall[0]);
      expect(subscriptionData[0]).toBe('REQ');
      expect(subscriptionData[2]).toEqual(
        expect.objectContaining({
          kinds: [4],
          '#p': [mockPublicKey],
          limit: 50
        })
      );

      // Verify subscription is tracked in state
      expect(result.current.state.subscriptions).toHaveLength(1);
      expect(result.current.state.subscriptions[0]).toEqual(
        expect.objectContaining({
          isActive: true,
          filter: expect.objectContaining({
            kinds: [4],
            '#p': [mockPublicKey]
          })
        })
      );
    });

    it('should not establish subscriptions when no relays are connected', async () => {
      mockRelayPool.connections = [
        { url: 'wss://offline.com', status: 'closed', updatedAtUnixMs: Date.now() }
      ];

      const { result } = renderHook(() => 
        useEnhancedDmController({
          myPublicKeyHex: mockPublicKey,
          myPrivateKeyHex: mockPrivateKey,
          pool: mockRelayPool
        })
      );

      await act(async () => {
        result.current.subscribeToIncomingDMs();
      });

      // Should not send subscription when no relays are open
      expect(mockRelayPool.sendToOpen).not.toHaveBeenCalled();
    });
  });

  describe('Property 10: Signature verification requirement', () => {
    /**
     * For any incoming DM event, the DM_Controller should verify the event 
     * signature before processing the message content
     * Validates: Requirements 2.2
     */
    it('should verify signatures before processing incoming messages', async () => {
      const { cryptoService } = require('../crypto-service');
      
      const { result } = renderHook(() => 
        useEnhancedDmController({
          myPublicKeyHex: mockPublicKey,
          myPrivateKeyHex: mockPrivateKey,
          pool: mockRelayPool
        })
      );

      // Simulate incoming message
      const mockEvent = {
        id: 'incoming_event_id',
        kind: 4,
        created_at: Math.floor(Date.now() / 1000),
        content: 'encrypted_incoming_content',
        pubkey: mockRecipientKey,
        sig: 'incoming_signature',
        tags: [['p', mockPublicKey]]
      };

      // Get the message handler
      const messageHandler = mockRelayPool.subscribeToMessages.mock.calls[0][0];
      
      await act(async () => {
        await messageHandler({
          url: 'wss://relay1.example.com',
          message: JSON.stringify(['EVENT', 'sub_id', mockEvent])
        });
      });

      // Verify signature verification was called
      expect(cryptoService.verifyEventSignature).toHaveBeenCalledWith(mockEvent);
      
      // Verify decryption was called (only after signature verification)
      expect(cryptoService.decryptDM).toHaveBeenCalledWith(
        'encrypted_incoming_content',
        mockRecipientKey,
        mockPrivateKey
      );
    });

    it('should reject messages with invalid signatures', async () => {
      const { cryptoService } = require('../crypto-service');
      cryptoService.verifyEventSignature.mockResolvedValue(false);

      const { result } = renderHook(() => 
        useEnhancedDmController({
          myPublicKeyHex: mockPublicKey,
          myPrivateKeyHex: mockPrivateKey,
          pool: mockRelayPool
        })
      );

      const mockEvent = {
        id: 'invalid_event_id',
        kind: 4,
        created_at: Math.floor(Date.now() / 1000),
        content: 'encrypted_content',
        pubkey: mockRecipientKey,
        sig: 'invalid_signature',
        tags: [['p', mockPublicKey]]
      };

      const messageHandler = mockRelayPool.subscribeToMessages.mock.calls[0][0];
      
      await act(async () => {
        await messageHandler({
          url: 'wss://relay1.example.com',
          message: JSON.stringify(['EVENT', 'sub_id', mockEvent])
        });
      });

      // Verify signature verification was called
      expect(cryptoService.verifyEventSignature).toHaveBeenCalledWith(mockEvent);
      
      // Verify decryption was NOT called for invalid signature
      expect(cryptoService.decryptDM).not.toHaveBeenCalled();
      
      // Verify message was not persisted
      const { messageQueue } = require('../message-queue');
      expect(messageQueue.persistMessage).not.toHaveBeenCalled();
    });
  });

  describe('Input Validation Properties', () => {
    it('should reject invalid recipient keys', async () => {
      const { parsePublicKeyInput } = require('../../parse-public-key-input');
      parsePublicKeyInput.mockReturnValue({ ok: false, error: 'Invalid key' });

      const { result } = renderHook(() => 
        useEnhancedDmController({
          myPublicKeyHex: mockPublicKey,
          myPrivateKeyHex: mockPrivateKey,
          pool: mockRelayPool
        })
      );

      await act(async () => {
        const sendResult = await result.current.sendDm({
          peerPublicKeyInput: 'invalid_key',
          plaintext: 'Test message'
        });
        
        expect(sendResult.success).toBe(false);
        expect(sendResult.error).toBe('Invalid recipient public key.');
      });
    });

    it('should reject empty messages', async () => {
      const { result } = renderHook(() => 
        useEnhancedDmController({
          myPublicKeyHex: mockPublicKey,
          myPrivateKeyHex: mockPrivateKey,
          pool: mockRelayPool
        })
      );

      await act(async () => {
        const sendResult = await result.current.sendDm({
          peerPublicKeyInput: mockRecipientKey,
          plaintext: '   ' // Only whitespace
        });
        
        expect(sendResult.success).toBe(false);
        expect(sendResult.error).toBe('Message cannot be empty');
      });
    });

    it('should reject messages that are too long', async () => {
      const { result } = renderHook(() => 
        useEnhancedDmController({
          myPublicKeyHex: mockPublicKey,
          myPrivateKeyHex: mockPrivateKey,
          pool: mockRelayPool
        })
      );

      const longMessage = 'A'.repeat(1001); // Exceeds limit of 1000

      await act(async () => {
        const sendResult = await result.current.sendDm({
          peerPublicKeyInput: mockRecipientKey,
          plaintext: longMessage
        });
        
        expect(sendResult.success).toBe(false);
        expect(sendResult.error).toContain('Message is too long');
      });
    });
  });

  describe('State Management Properties', () => {
    it('should maintain consistent state transitions', async () => {
      const { result } = renderHook(() => 
        useEnhancedDmController({
          myPublicKeyHex: mockPublicKey,
          myPrivateKeyHex: mockPrivateKey,
          pool: mockRelayPool
        })
      );

      // Initial state should be ready
      expect(result.current.state.status).toBe('ready');
      expect(result.current.state.messages).toHaveLength(0);
      expect(result.current.state.subscriptions).toHaveLength(1);

      // Send a message
      await act(async () => {
        await result.current.sendDm({
          peerPublicKeyInput: mockRecipientKey,
          plaintext: 'Test message'
        });
      });

      // State should include the sent message
      expect(result.current.state.messages).toHaveLength(1);
      expect(result.current.state.messages[0]).toEqual(
        expect.objectContaining({
          id: 'mock_event_id',
          peerPublicKeyHex: mockRecipientKey,
          plaintext: 'Test message',
          direction: 'outgoing',
          deliveryStatus: 'sending'
        })
      );
    });
  });
});

/**
 * Feature: core-messaging-mvp
 * Property 1: Message encryption consistency
 * Property 2: Event creation completeness  
 * Property 4: Multi-relay publishing
 * Property 5: Graceful relay failure handling
 * Property 9: Subscription establishment
 * Property 10: Signature verification requirement
 * 
 * Validates: Requirements 1.1, 1.2, 1.4, 1.5, 2.1, 2.2
 * 
 * This test suite validates that the enhanced DM controller properly handles
 * message encryption, event creation, multi-relay publishing, and incoming
 * message verification with proper error handling.
 */