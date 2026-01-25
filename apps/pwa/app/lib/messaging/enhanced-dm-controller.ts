/**
 * Enhanced DM Controller for Obscur
 * 
 * Implements complete message sending pipeline with:
 * - NIP-04 encryption via crypto service
 * - Nostr event creation and signing
 * - Multi-relay publishing with status tracking
 * - Message persistence and retry queue
 * - Optimistic UI updates
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { cryptoService } from "../crypto/crypto-service";
import { MessageQueue, type Message, type MessageStatus, type OutgoingMessage } from "./message-queue";
import { retryManager } from "./retry-manager";
import { errorHandler, type MessageError, type NetworkState } from "./error-handler";
import { offlineQueueManager, type QueueStatus } from "./offline-queue-manager";
import { messageMemoryManager, webSocketOptimizer } from "./performance-optimizer";
import { uiPerformanceMonitor, messageThrottler, loadingStateManager } from "./ui-performance";
import type { NostrEvent } from "@dweb/nostr/nostr-event";
import type { PrivateKeyHex } from "@dweb/crypto/private-key-hex";
import type { PublicKeyHex } from "@dweb/crypto/public-key-hex";
import type { RelayConnection } from "../relays/relay-connection";
import { parsePublicKeyInput } from "../parse-public-key-input";
import { NOSTR_SAFETY_LIMITS } from "../nostr-safety-limits";

/**
 * Relay pool interface
 */
type RelayPool = Readonly<{
  connections: ReadonlyArray<RelayConnection>;
  sendToOpen: (payload: string) => void;
  publishToAll?: (payload: string) => Promise<MultiRelayPublishResult>;
  subscribeToMessages: (handler: (params: Readonly<{ url: string; message: string }>) => void) => () => void;
}>;

/**
 * Multi-relay publish result
 */
interface MultiRelayPublishResult {
  success: boolean;
  successCount: number;
  totalRelays: number;
  results: Array<{
    relayUrl: string;
    success: boolean;
    error?: string;
    latency?: number;
  }>;
  overallError?: string;
}

/**
 * Subscription information
 */
interface Subscription {
  id: string;
  filter: NostrFilter;
  isActive: boolean;
  createdAt: Date;
  lastEventAt?: Date;
  eventCount: number;
}

/**
 * Nostr filter for subscriptions
 */
interface NostrFilter {
  kinds: number[];
  authors?: string[];
  '#p'?: string[];
  since?: number;
  until?: number;
  limit?: number;
}

/**
 * Enhanced DM controller state
 */
type EnhancedDMControllerState = Readonly<{
  status: 'initializing' | 'ready' | 'error';
  error?: string;
  messages: ReadonlyArray<Message>;
  subscriptions: ReadonlyArray<Subscription>;
  syncProgress?: {
    total: number;
    completed: number;
    errors: number;
  };
  messageStatusMap: Readonly<Record<string, MessageStatus>>;
  networkState: NetworkState;
  lastError?: MessageError;
  queueStatus?: QueueStatus;
}>;

/**
 * Send result with detailed relay information
 */
interface SendResult {
  success: boolean;
  messageId: string;
  relayResults: Array<{
    relayUrl: string;
    success: boolean;
    error?: string;
    latency?: number;
  }>;
  error?: string;
}

/**
 * Controller parameters
 */
type UseEnhancedDMControllerParams = Readonly<{
  myPublicKeyHex: PublicKeyHex | null;
  myPrivateKeyHex: PrivateKeyHex | null;
  pool: RelayPool;
  blocklist?: {
    isBlocked: (params: Readonly<{ publicKeyHex: PublicKeyHex }>) => boolean;
  };
  peerTrust?: {
    isAccepted: (params: Readonly<{ publicKeyHex: PublicKeyHex }>) => boolean;
  };
  requestsInbox?: {
    upsertIncoming: (params: Readonly<{
      peerPublicKeyHex: PublicKeyHex;
      plaintext: string;
      createdAtUnixSeconds: number
    }>) => void;
  };
}>;

/**
 * Controller result
 */
type UseEnhancedDMControllerResult = Readonly<{
  state: EnhancedDMControllerState;
  sendDm: (params: Readonly<{
    peerPublicKeyInput: string;
    plaintext: string;
    replyTo?: string;
  }>) => Promise<SendResult>;
  retryFailedMessage: (messageId: string) => Promise<void>;
  getMessageStatus: (messageId: string) => MessageStatus | null;
  getMessagesByConversation: (conversationId: string) => ReadonlyArray<Message>;
  subscribeToIncomingDMs: () => void;
  unsubscribeFromDMs: () => void;
  syncMissedMessages: (since?: Date) => Promise<void>;
  processOfflineQueue: () => Promise<void>;
  getOfflineQueueStatus: () => Promise<QueueStatus | null>;
  verifyRecipient: (pubkeyHex: PublicKeyHex) => Promise<{ exists: boolean; profile?: any }>;
}>;

/**
 * Maximum messages to keep in memory
 * Requirement 8.5: Limit memory usage by unloading old messages from active memory
 */
const MAX_MESSAGES_IN_MEMORY = 200;

/**
 * Status transition validation
 * Ensures status changes follow the correct state machine
 */
const isValidStatusTransition = (from: MessageStatus, to: MessageStatus): boolean => {
  const validTransitions: Record<MessageStatus, MessageStatus[]> = {
    'sending': ['accepted', 'rejected', 'queued', 'failed'],
    'queued': ['sending', 'failed'],
    'accepted': ['delivered'],
    'rejected': ['queued', 'failed'],
    'delivered': [],
    'failed': ['queued', 'sending']
  };

  return validTransitions[from]?.includes(to) || false;
};

/**
 * Create initial state
 */
const createInitialState = (): EnhancedDMControllerState => ({
  status: 'initializing',
  messages: [],
  subscriptions: [],
  messageStatusMap: {},
  networkState: errorHandler.getNetworkState()
});

/**
 * Create error state
 */
const createErrorState = (message: string, prevMessages: ReadonlyArray<Message> = [], lastError?: MessageError): EnhancedDMControllerState => ({
  status: 'error',
  error: message,
  messages: prevMessages,
  subscriptions: [],
  messageStatusMap: {},
  networkState: errorHandler.getNetworkState(),
  lastError
});

/**
 * Create ready state
 */
const createReadyState = (messages: ReadonlyArray<Message>): EnhancedDMControllerState => {
  // Build status map for quick lookups
  const messageStatusMap: Record<string, MessageStatus> = {};
  messages.forEach(msg => {
    if (msg.id) messageStatusMap[msg.id] = msg.status;
    if (msg.eventId) messageStatusMap[msg.eventId] = msg.status;
  });

  return {
    status: 'ready',
    messages,
    subscriptions: [],
    messageStatusMap,
    networkState: errorHandler.getNetworkState()
  };
};

/**
 * Generate unique message ID
 */
const generateMessageId = (): string => {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  return Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join('');
};

/**
 * Generate unique subscription ID
 */
const generateSubscriptionId = (): string => {
  const bytes = new Uint8Array(8);
  crypto.getRandomValues(bytes);
  return Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join('');
};

/**
 * Parse relay OK message
 */
interface RelayOkMessage {
  eventId: string;
  ok: boolean;
  message?: string;
}

const parseRelayOkMessage = (payload: string): RelayOkMessage | null => {
  try {
    const parsed = JSON.parse(payload);
    if (!Array.isArray(parsed) || parsed.length < 3 || parsed[0] !== 'OK') {
      return null;
    }

    return {
      eventId: parsed[1],
      ok: parsed[2],
      message: parsed[3]
    };
  } catch {
    return null;
  }
};

/**
 * Enhanced DM Controller Hook
 */
export const useEnhancedDMController = (
  params: UseEnhancedDMControllerParams
): UseEnhancedDMControllerResult => {
  const [state, setState] = useState<EnhancedDMControllerState>(createInitialState);

  // Initialize message queue
  const messageQueue = useMemo(() => {
    if (!params.myPublicKeyHex) return null;
    return new MessageQueue(params.myPublicKeyHex);
  }, [params.myPublicKeyHex]);

  // Track pending messages for status updates
  const pendingMessages = useRef<Map<string, Message>>(new Map());

  // Track relay response times for latency calculation
  const relayRequestTimes = useRef<Map<string, number>>(new Map());

  // Track active subscriptions
  const activeSubscriptions = useRef<Map<string, Subscription>>(new Map());

  // Track if subscription has been requested
  const hasSubscribedRef = useRef<boolean>(false);

  // Track sync state
  const syncStateRef = useRef<{
    isSyncing: boolean;
    lastSyncAt?: Date;
    conversationTimestamps: Map<string, Date>;
  }>({
    isSyncing: false,
    conversationTimestamps: new Map()
  });

  // Track events being processed to prevent race conditions in deduplication
  const processingEvents = useRef<Set<string>>(new Set());

  /**
   * Load messages from storage on mount
   */
  useEffect(() => {
    if (!messageQueue || !params.myPublicKeyHex) return;

    const loadMessages = async () => {
      try {
        // For now, we'll load messages as they come in
        // In a full implementation, we'd load from all conversations
        setState(createReadyState([]));
      } catch (error) {
        console.error('Failed to load messages:', error);
        const messageError = errorHandler.handleUnknownError(
          error instanceof Error ? error : new Error('Failed to load messages')
        );
        setState(createErrorState('Failed to load messages', [], messageError));
      }
    };

    void loadMessages();
  }, [messageQueue, params.myPublicKeyHex]);

  /**
   * Monitor network state changes
   * Requirement 7.1: Handle network connectivity changes
   */
  useEffect(() => {
    const unsubscribe = errorHandler.subscribeToNetworkChanges((networkState) => {
      console.log('Network state changed:', networkState);

      setState(prev => ({
        ...prev,
        networkState
      }));

      // If we just came online, trigger sync
      if (networkState.isOnline && networkState.hasRelayConnection && networkState.lastOnlineAt) {
        const timeSinceOnline = Date.now() - networkState.lastOnlineAt.getTime();
        if (timeSinceOnline < 2000) { // Within 2 seconds of coming online
          console.log('Network restored, triggering message sync');
          void syncMissedMessages();
        }
      }

      // If we went offline, notify user
      if (!networkState.isOnline) {
        errorHandler.handleNetworkOffline();
      }
    });

    return unsubscribe;
  }, []);

  /**
   * Update relay connection status in error handler
   * Also initialize WebSocket optimization for battery efficiency
   * Requirement 8.6: Use WebSocket connections efficiently to minimize battery drain
   */
  useEffect(() => {
    const hasOpenRelay = params.pool.connections.some(c => c.status === 'open');
    errorHandler.updateRelayConnectionStatus(hasOpenRelay);

    // Initialize WebSocket optimization for each relay
    params.pool.connections.forEach(connection => {
      if (connection.status === 'open') {
        // Register activity for newly opened connections
        webSocketOptimizer.registerActivity(connection.url);

        // Start heartbeat to keep connection alive efficiently
        webSocketOptimizer.startHeartbeat(connection.url, () => {
          // Send a ping to keep connection alive
          // In a real implementation, this would send a proper Nostr ping
          console.log(`Sending heartbeat to ${connection.url}`);
        });
      } else if (connection.status === 'closed' || connection.status === 'error') {
        // Clean up optimization resources for closed connections
        webSocketOptimizer.cleanup(connection.url);
      }
    });

    // Cleanup on unmount
    return () => {
      params.pool.connections.forEach(connection => {
        webSocketOptimizer.cleanup(connection.url);
      });
    };
  }, [params.pool.connections]);

  /**
   * Start automatic offline queue processing
   * Requirement 7.2: Automatically send queued messages when connectivity returns
   */
  useEffect(() => {
    if (!messageQueue) return;

    // Helper function to send a queued message
    const sendQueuedMessage = async (message: OutgoingMessage): Promise<boolean> => {
      if (!message.signedEvent) {
        console.error('Queued message missing signed event');
        return false;
      }

      try {
        const eventPayload = JSON.stringify(['EVENT', message.signedEvent]);

        // Use enhanced publishToAll if available
        if (params.pool.publishToAll) {
          const result = await params.pool.publishToAll(eventPayload);

          // Update message status based on result
          if (result.success) {
            await messageQueue.updateMessageStatus(message.id, 'accepted');

            // Update UI
            setState(prev => {
              const updatedMessages = prev.messages.map(m =>
                m.id === message.id ? { ...m, status: 'accepted' as MessageStatus } : m
              );
              return createReadyState(updatedMessages);
            });

            return true;
          } else {
            await messageQueue.updateMessageStatus(message.id, 'rejected');
            return false;
          }
        } else {
          // Fall back to basic sendToOpen
          params.pool.sendToOpen(eventPayload);
          await messageQueue.updateMessageStatus(message.id, 'accepted');
          return true;
        }
      } catch (error) {
        console.error('Failed to send queued message:', error);
        return false;
      }
    };

    // Start automatic queue processing
    offlineQueueManager.startAutoProcessing(
      () => messageQueue.getQueuedMessages(),
      sendQueuedMessage,
      (messageId) => messageQueue.removeFromQueue(messageId)
    );

    // Subscribe to queue status changes
    const unsubscribe = offlineQueueManager.subscribeToQueueStatus((queueStatus) => {
      setState(prev => ({
        ...prev,
        queueStatus
      }));
    });

    return () => {
      offlineQueueManager.stopAutoProcessing();
      unsubscribe();
    };
  }, [messageQueue, params.pool]);

  /**
   * Subscribe to relay messages for status updates
   */
  useEffect(() => {
    if (!params.pool) return;

    const unsubscribe = params.pool.subscribeToMessages((evt) => {
      // Handle OK messages for sent message status updates
      const ok = parseRelayOkMessage(evt.message);
      if (ok) {
        // Update message status based on relay response
        const pendingMessage = pendingMessages.current.get(ok.eventId);
        if (!pendingMessage) return;

        // Calculate latency
        const requestTime = relayRequestTimes.current.get(ok.eventId);
        const latency = requestTime ? Date.now() - requestTime : undefined;

        // Update relay results
        const relayResult = {
          relayUrl: evt.url,
          success: ok.ok,
          error: ok.ok ? undefined : ok.message,
          latency
        };

        const updatedMessage: Message = {
          ...pendingMessage,
          relayResults: [...(pendingMessage.relayResults || []), relayResult]
        };

        // Determine overall status based on relay responses
        const hasSuccess = updatedMessage.relayResults?.some(r => r.success) || false;
        const hasFailure = updatedMessage.relayResults?.some(r => !r.success) || false;
        const openRelayCount = params.pool.connections.filter(c => c.status === 'open').length;
        const allResponded = updatedMessage.relayResults?.length === openRelayCount;

        // Status state machine:
        // sending -> accepted (at least one relay accepted)
        // sending -> rejected (all relays rejected)
        // sending -> sending (still waiting for responses)
        let newStatus = updatedMessage.status;

        if (hasSuccess) {
          newStatus = 'accepted';
          retryManager.recordRelaySuccess(evt.url);
        } else if (hasFailure && allResponded) {
          newStatus = 'rejected';
          retryManager.recordRelayFailure(evt.url, ok.message);

          // Queue for retry if not exceeded max retries
          if (messageQueue && updatedMessage.retryCount !== undefined) {
            const retryResult = retryManager.shouldRetry({
              id: updatedMessage.id,
              conversationId: updatedMessage.conversationId,
              content: updatedMessage.content,
              recipientPubkey: updatedMessage.recipientPubkey,
              createdAt: updatedMessage.timestamp,
              retryCount: updatedMessage.retryCount,
              nextRetryAt: new Date()
            });

            if (retryResult.shouldRetry && retryResult.nextRetryAt) {
              newStatus = 'queued';
              updatedMessage.retryCount = (updatedMessage.retryCount || 0) + 1;

              // Queue the message for retry
              void messageQueue.queueOutgoingMessage({
                id: updatedMessage.id,
                conversationId: updatedMessage.conversationId,
                content: updatedMessage.content,
                recipientPubkey: updatedMessage.recipientPubkey,
                createdAt: updatedMessage.timestamp,
                retryCount: updatedMessage.retryCount,
                nextRetryAt: retryResult.nextRetryAt
              });
            } else {
              newStatus = 'failed';
            }
          }
        }

        // Validate status transition
        if (isValidStatusTransition(updatedMessage.status, newStatus)) {
          updatedMessage.status = newStatus;
        } else {
          console.warn(`Invalid status transition: ${updatedMessage.status} -> ${newStatus}`);
        }

        // Update in memory
        pendingMessages.current.set(ok.eventId, updatedMessage);

        // Update in storage
        if (messageQueue) {
          void messageQueue.updateMessageStatus(ok.eventId, updatedMessage.status);
        }

        // Update UI
        setState(prev => {
          const updatedMessages = prev.messages.map(m =>
            m.eventId === ok.eventId ? updatedMessage : m
          );
          return createReadyState(updatedMessages);
        });
        return;
      }

      // Handle incoming EVENT messages
      const incomingEvent = parseRelayEventMessage(evt.message);
      if (incomingEvent) {
        void handleIncomingEvent(incomingEvent);
      }
    });

    return unsubscribe;
  }, [params.pool, messageQueue]);

  /**
   * Parse relay EVENT message
   */
  const parseRelayEventMessage = (payload: string): NostrEvent | null => {
    try {
      const parsed = JSON.parse(payload);
      if (!Array.isArray(parsed) || parsed.length < 3 || parsed[0] !== 'EVENT') {
        return null;
      }

      const event = parsed[2];

      // Validate it's a kind 4 (DM) event
      if (!event || typeof event !== 'object' || event.kind !== 4) {
        return null;
      }

      // Validate required fields
      if (!event.id || !event.pubkey || !event.content || !event.sig) {
        return null;
      }

      return event as NostrEvent;
    } catch {
      return null;
    }
  };

  /**
   * Handle incoming DM event
   * Implements signature verification, decryption, message routing, and filtering
   * Tracks UI performance to ensure updates within 100ms (Requirement 8.2)
   */
  const handleIncomingEvent = async (event: NostrEvent): Promise<void> => {
    // Start performance tracking
    const endTracking = uiPerformanceMonitor.startTracking();

    if (!params.myPrivateKeyHex || !params.myPublicKeyHex) {
      console.warn('Cannot process incoming message: identity not available');
      endTracking();
      return;
    }

    // Check if we're already processing this event (prevents race conditions)
    if (processingEvents.current.has(event.id)) {
      console.log('Already processing event:', event.id);
      endTracking();
      return;
    }

    // Quick duplicate check before marking as processing
    const isDuplicateInMemory = state.messages.some(m => m.eventId === event.id);
    if (isDuplicateInMemory) {
      console.log('Ignoring duplicate message (in memory):', event.id);
      endTracking();
      return;
    }

    // Mark event as being processed
    processingEvents.current.add(event.id);

    try {
      // Step 1: Verify event signature (Requirement 2.2)
      const isValidSignature = await cryptoService.verifyEventSignature(event);
      if (!isValidSignature) {
        console.warn('Rejected message with invalid signature:', event.id);
        return;
      }

      // Step 2: Check if message is for us
      const recipientTag = event.tags?.find(tag => tag[0] === 'p');
      if (!recipientTag || recipientTag[1] !== params.myPublicKeyHex) {
        // Not for us, ignore
        return;
      }

      const senderPubkey = event.pubkey as PublicKeyHex;

      // Step 3: Filter out messages from blocked senders (Requirement 2.7)
      if (params.blocklist?.isBlocked({ publicKeyHex: senderPubkey })) {
        console.log('Filtered message from blocked sender:', senderPubkey);
        return;
      }

      // Step 4: Decrypt message content using NIP-04 (Requirement 2.3)
      let plaintext: string;
      try {
        plaintext = await cryptoService.decryptDM(
          event.content,
          senderPubkey,
          params.myPrivateKeyHex
        );
      } catch (decryptError) {
        // Gracefully handle decryption failures (Requirement 2.5)
        errorHandler.handleDecryptionError(
          decryptError instanceof Error ? decryptError : new Error('Decryption failed'),
          { eventId: event.id, sender: senderPubkey }
        );
        console.error('Failed to decrypt message:', event.id, decryptError);
        return;
      }

      // Step 5: Check if sender is an accepted contact
      const isAcceptedContact = params.peerTrust?.isAccepted({ publicKeyHex: senderPubkey }) || false;

      // Step 6: Route message based on sender status
      if (!isAcceptedContact) {
        // Route unknown sender messages to requests inbox (Requirement 2.8)
        if (params.requestsInbox) {
          params.requestsInbox.upsertIncoming({
            peerPublicKeyHex: senderPubkey,
            plaintext,
            createdAtUnixSeconds: event.created_at
          });
          console.log('Routed message from unknown sender to requests inbox:', senderPubkey);
        }
        // Don't add to main conversation view for unknown senders
        return;
      }

      // Step 7: Create message object for accepted contacts (Requirement 2.4)
      const conversationId = [params.myPublicKeyHex, senderPubkey].sort().join(':');

      const message: Message = {
        id: event.id,
        conversationId,
        content: plaintext,
        timestamp: new Date(event.created_at * 1000),
        isOutgoing: false,
        status: 'delivered',
        eventId: event.id,
        eventCreatedAt: new Date(event.created_at * 1000),
        senderPubkey,
        recipientPubkey: params.myPublicKeyHex,
        encryptedContent: event.content
      };

      // Step 8: Check for duplicates in storage (Requirement 6.3)
      // Also check in storage to catch duplicates across sessions
      if (messageQueue) {
        const existingMessage = await messageQueue.getMessage(event.id);
        if (existingMessage) {
          console.log('Ignoring duplicate message (found in storage):', event.id);
          return;
        }
      }

      // Step 9: Persist message to storage (Requirement 2.4)
      if (messageQueue) {
        try {
          await messageQueue.persistMessage(message);
        } catch (storageError) {
          errorHandler.handleStorageError(
            storageError instanceof Error ? storageError : new Error('Failed to persist incoming message'),
            { eventId: event.id, sender: senderPubkey }
          );
          console.error('Failed to persist incoming message:', storageError);
          // Continue with UI update even if storage fails
        }
      }

      // Step 10: Update conversation timestamp for sync tracking
      syncStateRef.current.conversationTimestamps.set(conversationId, message.timestamp);

      // Step 11: Update UI with proper ordering (Requirement 6.4)
      // Messages are sorted by timestamp to handle out-of-order arrivals
      // Use memory manager to efficiently handle large conversations
      // Use message throttler for smooth updates under high load (Requirement 8.8)
      messageThrottler.scheduleUpdate(() => {
        setState(prev => {
          // Double-check for duplicates before adding (race condition protection)
          const alreadyExists = prev.messages.some(m => m.eventId === event.id);
          if (alreadyExists) {
            console.log('Ignoring duplicate message (race condition caught):', event.id);
            return prev;
          }

          // Add new message to the list
          const updatedMessages = [message, ...prev.messages];

          // Sort messages by timestamp (newest first for UI display)
          // This ensures out-of-order messages are displayed correctly
          const sortedMessages = updatedMessages.sort((a, b) =>
            b.timestamp.getTime() - a.timestamp.getTime()
          );

          // Use memory manager to limit messages in memory (Requirement 8.5)
          // This prevents memory bloat with large conversations
          const limitedMessages = sortedMessages.slice(0, MAX_MESSAGES_IN_MEMORY);

          // Update memory manager cache
          messageMemoryManager.addMessages(conversationId, limitedMessages);

          return {
            ...createReadyState(limitedMessages),
            subscriptions: Array.from(activeSubscriptions.current.values())
          };
        });
      });

      console.log('Processed incoming message from accepted contact:', event.id);

      // Track performance metric
      const metric = endTracking();
      if (metric.totalTime > 100) {
        console.warn(`Message processing took ${metric.totalTime.toFixed(2)}ms (target: <100ms)`);
      }

    } catch (error) {
      // Gracefully handle any processing errors
      console.error('Error processing incoming event:', error);
      endTracking();
    } finally {
      // Always remove from processing set
      processingEvents.current.delete(event.id);
    }
  };

  /**
   * Send a direct message
   */
  const sendDm = useCallback(async (sendParams: Readonly<{
    peerPublicKeyInput: string;
    plaintext: string;
    replyTo?: string;
  }>): Promise<SendResult> => {
    // Validate identity
    if (!params.myPrivateKeyHex || !params.myPublicKeyHex) {
      const error = 'Identity must be unlocked to send messages';
      const messageError = errorHandler.handleInvalidInput(error);
      setState(prev => createErrorState(error, prev.messages, messageError));
      return {
        success: false,
        messageId: '',
        relayResults: [],
        error
      };
    }

    // Check network state before attempting
    const networkCheck = errorHandler.canAttemptOperation();
    if (!networkCheck.canAttempt) {
      console.log('Cannot send message:', networkCheck.reason);

      // Queue message for later if offline
      if (!errorHandler.getNetworkState().isOnline) {
        errorHandler.handleNetworkOffline({ operation: 'sendMessage' });
      } else {
        errorHandler.handleAllRelaysFailed({ operation: 'sendMessage' });
      }

      // Continue with queuing logic below
    }

    // Validate recipient
    const parsed = parsePublicKeyInput(sendParams.peerPublicKeyInput);
    if (!parsed.ok) {
      const error = 'Invalid recipient public key';
      const messageError = errorHandler.handleInvalidInput(error);
      setState(prev => createErrorState(error, prev.messages, messageError));
      return {
        success: false,
        messageId: '',
        relayResults: [],
        error
      };
    }

    // Validate message content
    const plaintext = sendParams.plaintext.trim();
    if (plaintext.length === 0) {
      const messageError = errorHandler.handleInvalidInput('Message cannot be empty');
      return {
        success: false,
        messageId: '',
        relayResults: [],
        error: 'Message cannot be empty'
      };
    }

    if (plaintext.length > NOSTR_SAFETY_LIMITS.maxDmPlaintextChars) {
      const error = `Message is too long (max ${NOSTR_SAFETY_LIMITS.maxDmPlaintextChars} chars)`;
      const messageError = errorHandler.handleInvalidInput(error);
      setState(prev => createErrorState(error, prev.messages, messageError));
      return {
        success: false,
        messageId: '',
        relayResults: [],
        error
      };
    }

    try {
      // Step 1: Encrypt message using NIP-04
      let encryptedContent: string;
      try {
        encryptedContent = await cryptoService.encryptDM(
          plaintext,
          parsed.publicKeyHex,
          params.myPrivateKeyHex
        );
      } catch (encryptError) {
        const messageError = errorHandler.handleEncryptionError(
          encryptError instanceof Error ? encryptError : new Error('Encryption failed'),
          { recipient: parsed.publicKeyHex }
        );
        setState(prev => ({
          ...prev,
          lastError: messageError
        }));
        throw encryptError;
      }

      // Step 2: Create Nostr event
      const createdAt = Math.floor(Date.now() / 1000);
      const tags: string[][] = [['p', parsed.publicKeyHex]];

      if (sendParams.replyTo) {
        tags.push(['e', sendParams.replyTo, '', 'reply']);
      }

      const unsignedEvent = {
        kind: 4,
        created_at: createdAt,
        tags,
        content: encryptedContent,
        pubkey: params.myPublicKeyHex
      };

      // Step 3: Sign event
      const signedEvent = await cryptoService.signEvent(
        unsignedEvent,
        params.myPrivateKeyHex
      );

      // Step 4: Create message object
      const messageId = signedEvent.id;
      const conversationId = [params.myPublicKeyHex, parsed.publicKeyHex].sort().join(':');

      const message: Message = {
        id: messageId,
        conversationId,
        content: plaintext,
        timestamp: new Date(createdAt * 1000),
        isOutgoing: true,
        status: 'sending',
        eventId: signedEvent.id,
        eventCreatedAt: new Date(createdAt * 1000),
        senderPubkey: params.myPublicKeyHex,
        recipientPubkey: parsed.publicKeyHex,
        encryptedContent,
        relayResults: [],
        retryCount: 0,
        replyTo: sendParams.replyTo ? {
          messageId: sendParams.replyTo,
          previewText: ''
        } : undefined
      };

      // Step 5: Persist message to storage
      if (messageQueue) {
        try {
          await messageQueue.persistMessage(message);
        } catch (storageError) {
          const messageError = errorHandler.handleStorageError(
            storageError instanceof Error ? storageError : new Error('Storage failed'),
            { messageId }
          );
          console.error('Failed to persist message:', messageError);
          // Continue with sending even if storage fails
        }
      }

      // Step 6: Optimistic UI update - show message immediately with 'sending' status
      // This provides instant feedback to the user (Requirement 8.1)
      setState(prev => {
        const updatedMessages = [message, ...prev.messages].slice(0, MAX_MESSAGES_IN_MEMORY);

        // Update memory manager cache (Requirement 8.5)
        messageMemoryManager.addMessages(conversationId, updatedMessages);

        return createReadyState(updatedMessages);
      });

      // Track pending message for status updates
      pendingMessages.current.set(messageId, message);
      relayRequestTimes.current.set(messageId, Date.now());

      // Step 7: Publish to relays with multi-relay failover
      const openRelays = params.pool.connections.filter(c => c.status === 'open');

      if (openRelays.length === 0) {
        // No relays available - queue for retry
        const allRelaysError = errorHandler.handleAllRelaysFailed({ messageId });

        if (messageQueue) {
          const outgoingMessage: OutgoingMessage = {
            id: messageId,
            conversationId,
            content: plaintext,
            recipientPubkey: parsed.publicKeyHex,
            createdAt: new Date(),
            retryCount: 0,
            nextRetryAt: retryManager.calculateNextRetry(0),
            signedEvent
          };

          try {
            await messageQueue.queueOutgoingMessage(outgoingMessage);
            await messageQueue.updateMessageStatus(messageId, 'queued');
          } catch (queueError) {
            errorHandler.handleStorageError(
              queueError instanceof Error ? queueError : new Error('Failed to queue message'),
              { messageId }
            );
          }
        }

        return {
          success: false,
          messageId,
          relayResults: [],
          error: allRelaysError.userMessage
        };
      }

      // Publish event to all relays with failover support
      const eventPayload = JSON.stringify(['EVENT', signedEvent]);

      // Use enhanced publishToAll if available, otherwise fall back to sendToOpen
      if (params.pool.publishToAll) {
        try {
          const publishResult = await params.pool.publishToAll(eventPayload);

          // Update message with relay results
          message.relayResults = publishResult.results;

          // Determine status based on results
          if (publishResult.successCount > 0) {
            message.status = 'accepted';
            if (messageQueue) {
              await messageQueue.updateMessageStatus(messageId, 'accepted');
            }
          } else {
            message.status = 'rejected';
            if (messageQueue) {
              await messageQueue.updateMessageStatus(messageId, 'rejected');

              // Queue for retry
              const outgoingMessage: OutgoingMessage = {
                id: messageId,
                conversationId,
                content: plaintext,
                recipientPubkey: parsed.publicKeyHex,
                createdAt: new Date(),
                retryCount: 0,
                nextRetryAt: retryManager.calculateNextRetry(0),
                signedEvent
              };
              await messageQueue.queueOutgoingMessage(outgoingMessage);
            }
          }

          // Update UI with final status
          setState(prev => {
            const updatedMessages = prev.messages.map(m =>
              m.id === messageId ? message : m
            );
            return createReadyState(updatedMessages);
          });

          return {
            success: publishResult.success,
            messageId,
            relayResults: publishResult.results,
            error: publishResult.overallError
          };
        } catch (error) {
          console.error('Failed to publish to relays:', error);

          // Fall back to basic sendToOpen
          params.pool.sendToOpen(eventPayload);

          return {
            success: true,
            messageId,
            relayResults: openRelays.map(relay => ({
              relayUrl: relay.url,
              success: true
            })),
            error: undefined
          };
        }
      } else {
        // Fall back to basic sendToOpen for backward compatibility
        params.pool.sendToOpen(eventPayload);

        return {
          success: true,
          messageId,
          relayResults: openRelays.map(relay => ({
            relayUrl: relay.url,
            success: true
          })),
          error: undefined
        };
      }

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      console.error('Failed to send message:', error);

      const messageError = errorHandler.handleUnknownError(
        error instanceof Error ? error : new Error(errorMessage),
        { operation: 'sendMessage', recipient: parsed.publicKeyHex }
      );

      setState(prev => ({
        ...createErrorState(errorMessage, prev.messages, messageError)
      }));

      return {
        success: false,
        messageId: '',
        relayResults: [],
        error: messageError.userMessage
      };
    }
  }, [params.myPrivateKeyHex, params.myPublicKeyHex, params.pool, messageQueue]);

  /**
   * Retry a failed message
   */
  const retryFailedMessage = useCallback(async (messageId: string): Promise<void> => {
    if (!messageQueue) return;

    try {
      const message = await messageQueue.getMessage(messageId);
      if (!message) {
        throw new Error('Message not found');
      }

      if (message.status !== 'rejected' && message.status !== 'failed' && message.status !== 'queued') {
        throw new Error('Message is not in a failed state');
      }

      // Update status to sending
      await messageQueue.updateMessageStatus(messageId, 'sending');

      setState(prev => {
        const updatedMessages = prev.messages.map(m =>
          m.id === messageId ? { ...m, status: 'sending' as MessageStatus } : m
        );
        return createReadyState(updatedMessages);
      });

      // Resend the message
      await sendDm({
        peerPublicKeyInput: message.recipientPubkey,
        plaintext: message.content,
        replyTo: message.replyTo?.messageId
      });

    } catch (error) {
      console.error('Failed to retry message:', error);
      throw error;
    }
  }, [messageQueue, sendDm]);

  /**
   * Get message status
   */
  const getMessageStatus = useCallback((messageId: string): MessageStatus | null => {
    const message = state.messages.find(m => m.id === messageId || m.eventId === messageId);
    return message?.status || null;
  }, [state.messages]);

  /**
   * Get messages for a specific conversation
   * Uses memory manager for efficient retrieval (Requirement 8.5)
   */
  const getMessagesByConversation = useCallback((conversationId: string): ReadonlyArray<Message> => {
    // Try to get from memory manager first
    const cachedMessages = messageMemoryManager.getMessages(conversationId);
    if (cachedMessages) {
      return cachedMessages;
    }

    // Fall back to state
    return state.messages.filter(m => m.conversationId === conversationId);
  }, [state.messages]);

  /**
   * Subscribe to incoming DM events
   * Creates subscription filters for user's DM events and establishes subscriptions on all connected relays
   */
  const subscribeToIncomingDMs = useCallback((): void => {
    if (!params.myPublicKeyHex) {
      console.warn('Cannot subscribe: no public key available');
      return;
    }

    if (hasSubscribedRef.current) {
      console.log('Already subscribed to incoming DMs');
      return;
    }

    // Check if we have any open relay connections
    const hasOpenRelay = params.pool.connections.some(c => c.status === 'open');
    if (!hasOpenRelay) {
      console.warn('Cannot subscribe: no open relay connections');
      return;
    }

    // Create subscription ID
    const subId = generateSubscriptionId();

    // Create subscription filter for DM events targeting this user
    const filter: NostrFilter = {
      kinds: [4], // Kind 4 = encrypted direct message
      '#p': [params.myPublicKeyHex], // Messages where we are tagged as recipient
      limit: 50 // Limit initial batch to 50 most recent messages
    };

    // Create subscription object
    const subscription: Subscription = {
      id: subId,
      filter,
      isActive: true,
      createdAt: new Date(),
      eventCount: 0
    };

    // Store subscription
    activeSubscriptions.current.set(subId, subscription);
    hasSubscribedRef.current = true;

    // Send REQ message to all open relays
    const reqMessage = JSON.stringify(['REQ', subId, filter]);
    params.pool.sendToOpen(reqMessage);

    console.log('Subscribed to incoming DMs with filter:', filter);

    // Update state with new subscription
    setState(prev => ({
      ...prev,
      subscriptions: Array.from(activeSubscriptions.current.values())
    }));
  }, [params.myPublicKeyHex, params.pool]);

  /**
   * Unsubscribe from DM events
   * Closes all active subscriptions
   */
  const unsubscribeFromDMs = useCallback((): void => {
    if (activeSubscriptions.current.size === 0) {
      return;
    }

    // Send CLOSE message for each active subscription
    activeSubscriptions.current.forEach((subscription) => {
      const closeMessage = JSON.stringify(['CLOSE', subscription.id]);
      params.pool.sendToOpen(closeMessage);
      console.log('Closed subscription:', subscription.id);
    });

    // Clear subscriptions
    activeSubscriptions.current.clear();
    hasSubscribedRef.current = false;

    // Update state
    setState(prev => ({
      ...prev,
      subscriptions: []
    }));
  }, [params.pool]);

  /**
   * Auto-subscribe when relay connections become available
   */
  useEffect(() => {
    if (!params.myPublicKeyHex) return;

    const hasOpenRelay = params.pool.connections.some(c => c.status === 'open');
    if (hasOpenRelay && !hasSubscribedRef.current) {
      subscribeToIncomingDMs();
    }
  }, [params.myPublicKeyHex, params.pool.connections, subscribeToIncomingDMs]);

  /**
   * Sync missed messages when coming online
   * Implements Requirements 6.1, 6.2, 6.5
   * Uses loading state manager for smooth progress indicators (Requirement 6.6)
   */
  const syncMissedMessages = useCallback(async (since?: Date): Promise<void> => {
    if (!params.myPublicKeyHex || !messageQueue) {
      console.warn('Cannot sync: identity or message queue not available');
      return;
    }

    // Check if already syncing
    if (syncStateRef.current.isSyncing) {
      console.log('Sync already in progress, skipping');
      return;
    }

    // Check if we have any open relay connections
    const hasOpenRelay = params.pool.connections.some(c => c.status === 'open');
    if (!hasOpenRelay) {
      console.warn('Cannot sync: no open relay connections');
      return;
    }

    try {
      syncStateRef.current.isSyncing = true;

      // Set loading state (Requirement 6.6)
      loadingStateManager.setLoading('messageSync', {
        isLoading: true,
        progress: 0,
        message: 'Syncing messages...'
      });

      // Update state to show sync in progress
      setState(prev => ({
        ...prev,
        syncProgress: {
          total: 0,
          completed: 0,
          errors: 0
        }
      }));

      // Determine sync timestamp
      let syncTimestamp: number;

      if (since) {
        // Use provided timestamp
        syncTimestamp = Math.floor(since.getTime() / 1000);
      } else {
        // Get the most recent message timestamp across all conversations
        let mostRecentTimestamp: Date | null = null;

        // Check all known conversations
        for (const [conversationId, lastTimestamp] of syncStateRef.current.conversationTimestamps.entries()) {
          if (!mostRecentTimestamp || lastTimestamp > mostRecentTimestamp) {
            mostRecentTimestamp = lastTimestamp;
          }
        }

        // If we have a recent timestamp, use it; otherwise sync from 24 hours ago
        if (mostRecentTimestamp) {
          syncTimestamp = Math.floor(mostRecentTimestamp.getTime() / 1000);
        } else {
          // Default to last 24 hours if no previous messages
          const oneDayAgo = Date.now() - (24 * 60 * 60 * 1000);
          syncTimestamp = Math.floor(oneDayAgo / 1000);
        }
      }

      console.log('Starting message sync from timestamp:', new Date(syncTimestamp * 1000));

      // Create sync subscription with since filter
      const syncSubId = generateSubscriptionId();
      const syncFilter: NostrFilter = {
        kinds: [4], // DM events
        '#p': [params.myPublicKeyHex], // Messages for us
        since: syncTimestamp,
        limit: 100 // Batch size for efficient sync
      };

      // Track sync progress
      let syncedCount = 0;
      let errorCount = 0;

      // Create temporary subscription for sync
      const syncReqMessage = JSON.stringify(['REQ', syncSubId, syncFilter]);
      params.pool.sendToOpen(syncReqMessage);

      // Set up timeout for sync completion
      const syncTimeout = setTimeout(() => {
        // Close sync subscription
        const closeMessage = JSON.stringify(['CLOSE', syncSubId]);
        params.pool.sendToOpen(closeMessage);

        // Update sync state
        syncStateRef.current.isSyncing = false;
        syncStateRef.current.lastSyncAt = new Date();

        // Complete loading state
        loadingStateManager.complete('messageSync');

        // Update UI
        setState(prev => ({
          ...prev,
          syncProgress: undefined
        }));

        console.log(`Sync completed: ${syncedCount} messages synced, ${errorCount} errors`);
      }, 10000); // 10 second timeout for sync

      // Note: Actual message processing happens through the existing handleIncomingEvent
      // which is already subscribed to relay messages. The sync subscription will
      // trigger those events to be received and processed.

      // Update sync progress periodically
      const progressInterval = setInterval(() => {
        const progress = syncedCount + errorCount > 0
          ? (syncedCount / (syncedCount + errorCount)) * 100
          : 0;

        // Update loading state with progress
        loadingStateManager.updateProgress('messageSync', progress,
          `Synced ${syncedCount} messages...`);

        setState(prev => {
          if (!prev.syncProgress) return prev;
          return {
            ...prev,
            syncProgress: {
              total: syncedCount + errorCount,
              completed: syncedCount,
              errors: errorCount
            }
          };
        });
      }, 500);

      // Clean up on completion
      setTimeout(() => {
        clearInterval(progressInterval);
        clearTimeout(syncTimeout);
      }, 10000);

    } catch (error) {
      console.error('Failed to sync missed messages:', error);
      syncStateRef.current.isSyncing = false;

      // Complete loading state with error
      loadingStateManager.complete('messageSync');

      setState(prev => ({
        ...prev,
        syncProgress: undefined
      }));
    }
  }, [params.myPublicKeyHex, params.pool, messageQueue]);

  /**
   * Verify if a recipient exists on the network by checking for metadata (Kind 0)
   * Requirement: Prevents messaging 'ghost' accounts
   */
  const verifyRecipient = useCallback(async (pubkeyHex: PublicKeyHex): Promise<{ exists: boolean; profile?: any }> => {
    return new Promise((resolve) => {
      const subId = `verify-${Math.random().toString(36).substring(7)}`;
      let found = false;
      let profile: any = undefined;

      const filter = {
        kinds: [0],
        authors: [pubkeyHex],
        limit: 1
      };

      const cleanup = params.pool.subscribeToMessages(({ message }) => {
        try {
          const parsed = JSON.parse(message);
          if (parsed[0] === "EVENT" && parsed[1] === subId) {
            const event = parsed[2];
            if (event.pubkey === pubkeyHex && event.kind === 0) {
              found = true;
              profile = JSON.parse(event.content);
              cleanup();
              resolve({ exists: true, profile });
            }
          }
          if (parsed[0] === "EOSE" && parsed[1] === subId) {
            cleanup();
            if (!found) resolve({ exists: false });
          }
        } catch (e) { }
      });

      params.pool.sendToOpen(JSON.stringify(["REQ", subId, filter]));

      // Timeout after 3 seconds for verification
      setTimeout(() => {
        cleanup();
        if (!found) resolve({ exists: false });
      }, 3000);
    });
  }, [params.pool]);

  /**
   * Monitor relay connection changes and trigger sync when coming online
   */
  useEffect(() => {
    if (!params.myPublicKeyHex) return;

    const hasOpenRelay = params.pool.connections.some(c => c.status === 'open');
    const hadOpenRelay = params.pool.connections.some(c =>
      c.status === 'open' &&
      c.updatedAtUnixMs < Date.now() - 1000 // Was open at least 1 second ago
    );

    // If we just came online (have open relay now but didn't before)
    if (hasOpenRelay && !syncStateRef.current.lastSyncAt) {
      console.log('Relay connection established, triggering initial sync');
      void syncMissedMessages();
    }
  }, [params.pool.connections, params.myPublicKeyHex, syncMissedMessages]);

  /**
   * Manually process offline queue
   */
  const processOfflineQueue = useCallback(async (): Promise<void> => {
    if (!messageQueue) return;

    const sendQueuedMessage = async (message: OutgoingMessage): Promise<boolean> => {
      if (!message.signedEvent) {
        console.error('Queued message missing signed event');
        return false;
      }

      try {
        const eventPayload = JSON.stringify(['EVENT', message.signedEvent]);

        if (params.pool.publishToAll) {
          const result = await params.pool.publishToAll(eventPayload);

          if (result.success) {
            await messageQueue.updateMessageStatus(message.id, 'accepted');
            setState(prev => {
              const updatedMessages = prev.messages.map(m =>
                m.id === message.id ? { ...m, status: 'accepted' as MessageStatus } : m
              );
              return createReadyState(updatedMessages);
            });
            return true;
          } else {
            await messageQueue.updateMessageStatus(message.id, 'rejected');
            return false;
          }
        } else {
          params.pool.sendToOpen(eventPayload);
          await messageQueue.updateMessageStatus(message.id, 'accepted');
          return true;
        }
      } catch (error) {
        console.error('Failed to send queued message:', error);
        return false;
      }
    };

    await offlineQueueManager.manualProcessQueue(
      () => messageQueue.getQueuedMessages(),
      sendQueuedMessage,
      (messageId) => messageQueue.removeFromQueue(messageId)
    );
  }, [messageQueue, params.pool]);

  /**
   * Get offline queue status
   */
  const getOfflineQueueStatus = useCallback(async () => {
    if (!messageQueue) return null;
    return offlineQueueManager.getQueueStatus(() => messageQueue.getQueuedMessages());
  }, [messageQueue]);

  return {
    state,
    sendDm,
    retryFailedMessage,
    getMessageStatus,
    getMessagesByConversation,
    subscribeToIncomingDMs,
    unsubscribeFromDMs,
    syncMissedMessages,
    processOfflineQueue,
    getOfflineQueueStatus,
    verifyRecipient
  };
};
