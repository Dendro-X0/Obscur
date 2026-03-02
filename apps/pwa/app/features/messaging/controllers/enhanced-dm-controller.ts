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
import { MessageQueue, type Message, type MessageStatus, type OutgoingMessage } from "../lib/message-queue";
import { extractAttachmentsFromContent } from "../utils/logic";
import { PrivacySettingsService } from "@/app/features/settings/services/privacy-settings-service";
import type { ConnectionRequestStatusValue } from "@/app/features/messaging/types";
import { errorHandler } from "../lib/error-handler";
import { offlineQueueManager, type QueueStatus } from "../lib/offline-queue-manager";
import { messageMemoryManager, webSocketOptimizer } from "../lib/performance-optimizer";
import { uiPerformanceMonitor, messageThrottler, loadingStateManager } from "../lib/ui-performance";
import type { NostrEvent } from "@dweb/nostr/nostr-event";
import type { PrivateKeyHex } from "@dweb/crypto/private-key-hex";
import type { PublicKeyHex } from "@dweb/crypto/public-key-hex";
import type { RelayConnection } from "@/app/features/relays/utils/relay-connection";
import { parsePublicKeyInput } from "@/app/features/profile/utils/parse-public-key-input";
import { NOSTR_SAFETY_LIMITS } from "@/app/features/relays/utils/nostr-safety-limits";
import { nip65Service } from "@/app/features/relays/utils/nip65-service";
import { logAppEvent } from "@/app/shared/log-app-event";
import { buildDmEvent, type DmEventBuildResult, type DmFormat } from "./dm-event-builder";
import {
  generateSubscriptionId,
  parseRelayEventMessage,
} from "./relay-utils";
import { handleRelayOkMessage } from "./relay-ok-message-handler";
import {
  createErrorState,
  createInitialState,
  createReadyState,
  isValidStatusTransition,
  type EnhancedDMControllerState,
  type NostrFilter,
  type Subscription
} from "./dm-controller-state";
import { handleIncomingDmEvent, type IncomingDmParams } from "./incoming-dm-event-handler";
import { publishOutgoingDm, publishOutgoingDmFireAndForget, publishQueuedOutgoingMessage, queueOutgoingDmForRetry } from "./outgoing-dm-publisher";
import { prepareOutgoingDm } from "./outgoing-dm-send-preparer";
import { applyRecipientRelayHints } from "./recipient-relay-hints";
import { transitionMessageStatus } from "../state-machines/message-delivery-machine";
import { orchestrateOutgoingDm } from "./outgoing-dm-orchestrator";

/**
 * Relay pool interface
 */
export type RelayPool = Readonly<{
  connections: ReadonlyArray<RelayConnection>;
  sendToOpen: (payload: string) => void;
  publishToAll?: (payload: string) => Promise<MultiRelayPublishResult>;
  subscribeToMessages: (handler: (params: Readonly<{ url: string; message: string }>) => void) => () => void;
  addTransientRelay?: (url: string) => void;
  removeTransientRelay?: (url: string) => void;
  isConnected?: () => boolean;
  waitForConnection: (timeoutMs: number) => Promise<boolean>;
}>;

/**
 * Multi-relay publish result
 */
export interface MultiRelayPublishResult {
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

// Subscription/NostrFilter/EnhancedDMControllerState moved to dm-controller-state

/**
 * Send result with detailed relay information
 */
export interface SendResult {
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

// buildDmEvent, countRelayFailures moved to helper modules

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
    acceptPeer: (params: Readonly<{ publicKeyHex: PublicKeyHex }>) => void;
  };
  requestsInbox?: {
    upsertIncoming: (params: Readonly<{
      peerPublicKeyHex: PublicKeyHex;
      plaintext: string;
      createdAtUnixSeconds: number;
      isRequest?: boolean;
      status?: ConnectionRequestStatusValue;
      eventId?: string;
    }>) => void;
    getRequestStatus: (params: Readonly<{ peerPublicKeyHex: PublicKeyHex }>) => { status?: ConnectionRequestStatusValue; isOutgoing: boolean } | null;
    setStatus: (params: Readonly<{ peerPublicKeyHex: PublicKeyHex; status: ConnectionRequestStatusValue; isOutgoing?: boolean }>) => void;
  };
  onNewMessage?: (message: Message) => void;
  onConnectionCreated?: (pubkey: PublicKeyHex) => void;
}>;

/**
 * Controller result
 */
export type UseEnhancedDMControllerResult = Readonly<{
  state: EnhancedDMControllerState;
  sendDm: (params: Readonly<{
    peerPublicKeyInput: string;
    plaintext: string;
    replyTo?: string;
    customTags?: string[][];
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
  sendConnectionRequest: (params: Readonly<{
    peerPublicKeyHex: PublicKeyHex;
    introMessage?: string;
  }>) => Promise<SendResult>;
  watchConversation: (peerPubkey: string) => Promise<void>;
}>;

/**
 * Maximum messages to keep in memory
 * Requirement 8.5: Limit memory usage by unloading old messages from active memory
 */
const MAX_MESSAGES_IN_MEMORY = 200;

// isValidStatusTransition/create*State moved to dm-controller-state


/**
 * Generate unique subscription ID
 */
// generateSubscriptionId, parseRelayOkMessage moved to helper modules

/**
 * Enhanced DM Controller Hook
 */
import { subscribeToIncomingDMs, unsubscribeFromDMs } from "./dm-subscription-manager";
import { syncMissedMessages as syncMissedMessagesImpl } from "./dm-sync-orchestrator";
import {
  verifyRecipient as verifyRecipientImpl,
  ensureConnectedToRecipientRelays
} from "./recipient-discovery-service";
import {
  processOfflineQueue as processOfflineQueueImpl,
  getOfflineQueueStatus as getOfflineQueueStatusImpl,
  setupAutoQueueProcessing
} from "./dm-queue-orchestrator";

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

  // Track shared controller refs
  const pendingMessages = useRef<Map<string, Message>>(new Map());
  const relayRequestTimes = useRef<Map<string, number>>(new Map());
  const activeSubscriptions = useRef<Map<string, Subscription>>(new Map());
  const hasSubscribedRef = useRef<boolean>(false);
  const syncStateRef = useRef<{
    isSyncing: boolean;
    lastSyncAt?: Date;
    conversationTimestamps: Map<string, Date>;
  }>({
    isSyncing: false,
    conversationTimestamps: new Map()
  });
  const processingEvents = useRef<Set<string>>(new Set());
  const recipientRelayCheckCache = useRef<Set<string>>(new Set());
  const initialSyncTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const hasTriggeredInitialSync = useRef(false);

  // Use a ref for params to avoid stale closures
  const paramsRef = useRef(params);
  useEffect(() => {
    paramsRef.current = params;
  }, [params]);

  /**
   * Load messages from storage on mount
   */
  useEffect(() => {
    if (!messageQueue || !params.myPublicKeyHex) return;
    const loadMessages = async () => {
      try {
        const storedMessages = await messageQueue.getAllMessages();
        setState(createReadyState(storedMessages));
      } catch (error) {
        console.error('Failed to load messages:', error);
        setState(prev => createErrorState('Failed to load messages', [], errorHandler.handleUnknownError(error as Error)));
      }
    };
    void loadMessages();
  }, [messageQueue, params.myPublicKeyHex]);

  /**
   * Orchestrate sync on mount/network change
   */
  const syncMissedMessages = useCallback(async (since?: Date): Promise<void> => {
    await syncMissedMessagesImpl({
      myPublicKeyHex: params.myPublicKeyHex,
      messageQueue,
      pool: params.pool,
      syncStateRef,
      setState
    }, since);
  }, [params.myPublicKeyHex, params.pool, messageQueue]);

  /**
   * Monitor network state changes
   */
  useEffect(() => {
    const unsubscribe = errorHandler.subscribeToNetworkChanges((networkState) => {
      setState(prev => ({ ...prev, networkState }));
      if (networkState.isOnline && networkState.hasRelayConnection && networkState.lastOnlineAt) {
        if (Date.now() - networkState.lastOnlineAt.getTime() < 2000) {
          void syncMissedMessages();
        }
      }
      if (!networkState.isOnline) errorHandler.handleNetworkOffline();
    });
    return unsubscribe;
  }, [syncMissedMessages]);

  /**
   * WebSocket efficiency and activity optimization
   */
  useEffect(() => {
    const hasOpenRelay = params.pool.connections.some(c => c.status === 'open');
    errorHandler.updateRelayConnectionStatus(hasOpenRelay);
    params.pool.connections.forEach(connection => {
      if (connection.status === 'open') {
        webSocketOptimizer.registerActivity(connection.url);
        webSocketOptimizer.startHeartbeat(connection.url, () => console.debug(`Sending heartbeat to ${connection.url}`));
      } else {
        webSocketOptimizer.cleanup(connection.url);
      }
    });
    return () => params.pool.connections.forEach(c => webSocketOptimizer.cleanup(c.url));
  }, [params.pool.connections]);

  /**
   * Automatic offline queue processing
   */
  useEffect(() => {
    return setupAutoQueueProcessing({ messageQueue, pool: params.pool, setState });
  }, [messageQueue, params.pool]);

  /**
   * Subscription and Message handling
   */
  const handleIncomingEvent = useCallback(async (event: NostrEvent): Promise<void> => {
    const p = paramsRef.current;
    if (!p.myPrivateKeyHex || !p.myPublicKeyHex) return;
    await handleIncomingDmEvent({
      event,
      currentParams: {
        myPrivateKeyHex: p.myPrivateKeyHex,
        myPublicKeyHex: p.myPublicKeyHex,
        blocklist: p.blocklist,
        peerTrust: p.peerTrust,
        requestsInbox: p.requestsInbox,
        onNewMessage: p.onNewMessage,
        onConnectionCreated: p.onConnectionCreated
      },
      messageQueue,
      processingEvents: processingEvents.current,
      existingMessages: state.messages,
      maxMessagesInMemory: MAX_MESSAGES_IN_MEMORY,
      syncConversationTimestamps: syncStateRef.current.conversationTimestamps,
      activeSubscriptions: activeSubscriptions.current,
      scheduleUiUpdate: (fn) => messageThrottler.scheduleUpdate(fn),
      setState,
      createReadyState,
      messageMemoryManager,
      uiPerformanceMonitor
    });
  }, [messageQueue, state.messages]);

  useEffect(() => {
    if (!params.pool) return;
    return params.pool.subscribeToMessages((evt) => {
      const openRelayCount = params.pool.connections.filter(c => c.status === 'open').length;
      if (handleRelayOkMessage({
        evt, openRelayCount, pendingMessages: pendingMessages.current,
        relayRequestTimes: relayRequestTimes.current, messageQueue, setState,
        createReadyState, isValidStatusTransition
      })) return;
      const incomingEvent = parseRelayEventMessage(evt.message);
      if (incomingEvent) {
        if (incomingEvent.kind === 4 || incomingEvent.kind === 1059) {
          void handleIncomingEvent(incomingEvent);
        } else if (incomingEvent.kind === 10002) {
          nip65Service.updateFromEvent(incomingEvent);
        }
      }
    });
  }, [params.pool, messageQueue, handleIncomingEvent]);

  /**
   * Controller API Implementation
   */
  /**
   * Controller API Implementation
   */
  const subscribeToIncomingDMsImpl = useCallback((): void => {
    subscribeToIncomingDMs({
      myPublicKeyHex: params.myPublicKeyHex,
      pool: params.pool,
      hasSubscribedRef,
      activeSubscriptions,
      setState
    });
  }, [params.myPublicKeyHex, params.pool]);

  const unsubscribeFromDMsImpl = useCallback((): void => {
    unsubscribeFromDMs({
      pool: params.pool,
      activeSubscriptions,
      hasSubscribedRef,
      setState
    });
  }, [params.pool]);

  // Handle auto-subscribe on connection
  useEffect(() => {
    if (!params.myPublicKeyHex) return;
    if (params.pool.connections.some(c => c.status === 'open') && !hasSubscribedRef.current) {
      subscribeToIncomingDMsImpl();
    }
  }, [params.myPublicKeyHex, params.pool.connections, subscribeToIncomingDMsImpl]);

  // Handle initial sync on connection
  useEffect(() => {
    if (!params.myPublicKeyHex) return;
    recipientRelayCheckCache.current.clear();
    const hasOpenRelay = params.pool.connections.some(c => c.status === 'open');
    if (hasOpenRelay && !syncStateRef.current.lastSyncAt && !hasTriggeredInitialSync.current && !syncStateRef.current.isSyncing) {
      if (initialSyncTimeoutRef.current) clearTimeout(initialSyncTimeoutRef.current);
      initialSyncTimeoutRef.current = setTimeout(() => {
        if (!hasTriggeredInitialSync.current) {
          hasTriggeredInitialSync.current = true;
          void syncMissedMessages();
        }
      }, 2000);
    }
    return () => { if (initialSyncTimeoutRef.current) clearTimeout(initialSyncTimeoutRef.current); };
  }, [params.pool.connections, params.myPublicKeyHex, syncMissedMessages]);

  const sendDm = useCallback(async (sendParams: Readonly<{
    peerPublicKeyInput: string;
    plaintext: string;
    replyTo?: string;
    customTags?: string[][];
  }>): Promise<SendResult> => {
    if (!params.myPrivateKeyHex || !params.myPublicKeyHex) {
      const error = 'Identity must be unlocked to send messages';
      setState(prev => createErrorState(error, prev.messages, errorHandler.handleInvalidInput(error)));
      return { success: false, messageId: '', relayResults: [], error };
    }

    return orchestrateOutgoingDm({
      ...sendParams,
      myPublicKeyHex: params.myPublicKeyHex,
      myPrivateKeyHex: params.myPrivateKeyHex,
      pool: params.pool,
      messageQueue,
      recipientRelayCheckCache,
      pendingMessages,
      relayRequestTimes,
      maxMessagesInMemory: MAX_MESSAGES_IN_MEMORY,
      setState,
      createReadyState,
      createErrorState
    });
  }, [params.myPrivateKeyHex, params.myPublicKeyHex, params.pool, messageQueue]);

  return useMemo(() => ({
    state,
    sendDm,
    retryFailedMessage: async (id) => {
      if (!messageQueue) return;
      const m = await messageQueue.getMessage(id);
      if (!m || (m.status !== 'rejected' && m.status !== 'failed' && m.status !== 'queued')) return;

      const nextStatus = transitionMessageStatus(m.status, { type: "START_SEND" });
      await messageQueue.updateMessageStatus(id, nextStatus);
      setState(prev => createReadyState(prev.messages.map(msg => msg.id === id ? { ...msg, status: nextStatus } : msg)));
      await sendDm({ peerPublicKeyInput: m.recipientPubkey, plaintext: m.content, replyTo: m.replyTo?.messageId });
    },
    getMessageStatus: (id) => state.messages.find(m => m.id === id || m.eventId === id)?.status || null,
    getMessagesByConversation: (cid) => messageMemoryManager.getMessages(cid) || state.messages.filter(m => m.conversationId === cid),
    subscribeToIncomingDMs: subscribeToIncomingDMsImpl,
    unsubscribeFromDMs: unsubscribeFromDMsImpl,
    syncMissedMessages,
    processOfflineQueue: () => processOfflineQueueImpl({ messageQueue, pool: params.pool, setState }),
    getOfflineQueueStatus: () => getOfflineQueueStatusImpl(messageQueue),
    verifyRecipient: (pubkey) => verifyRecipientImpl({ pool: params.pool }, pubkey),
    sendConnectionRequest: async (req) => {
      const writeRelays = params.myPublicKeyHex ? nip65Service.getWriteRelays(params.myPublicKeyHex) : [];
      const tags = [['t', 'connection-request']];
      if (writeRelays.length > 0) tags.push(['relays', ...writeRelays]);
      const res = await sendDm({ peerPublicKeyInput: req.peerPublicKeyHex, plaintext: req.introMessage || "Hello!", customTags: tags });
      if (params.myPublicKeyHex && res.success) params.requestsInbox?.setStatus({ peerPublicKeyHex: req.peerPublicKeyHex, status: "pending", isOutgoing: true });
      return res;
    },
    watchConversation: async (peer) => {
      await ensureConnectedToRecipientRelays({ pool: params.pool, recipientRelayCheckCache }, peer);
      if (hasSubscribedRef.current) activeSubscriptions.current.forEach(sub => params.pool.sendToOpen(JSON.stringify(['REQ', sub.id, sub.filter])));
    }
  }), [state, sendDm, messageQueue, syncMissedMessages, subscribeToIncomingDMsImpl, unsubscribeFromDMsImpl, params.pool, params.myPublicKeyHex, params.requestsInbox]);
};
