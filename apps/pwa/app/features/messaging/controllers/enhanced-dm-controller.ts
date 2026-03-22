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
import type { ConnectionRequestStatusValue, RequestSendBlockReason, MessageActionFailureReason } from "@/app/features/messaging/types";
import type { Attachment } from "@/app/features/messaging/types";
import { errorHandler } from "../lib/error-handler";
import { offlineQueueManager, type QueueStatus } from "../lib/offline-queue-manager";
import { messageMemoryManager, webSocketOptimizer } from "../lib/performance-optimizer";
import { uiPerformanceMonitor, messageThrottler, loadingStateManager } from "../lib/ui-performance";
import type { NostrEvent } from "@dweb/nostr/nostr-event";
import type { PrivateKeyHex } from "@dweb/crypto/private-key-hex";
import type { PublicKeyHex } from "@dweb/crypto/public-key-hex";
import type { RelayConnection } from "@/app/features/relays/utils/relay-connection";
import { parsePublicKeyInput } from "@/app/features/profile/utils/parse-public-key-input";
import { normalizePublicKeyHex } from "@/app/features/profile/utils/normalize-public-key-hex";
import { NOSTR_SAFETY_LIMITS } from "@/app/features/relays/utils/nostr-safety-limits";
import { nip65Service } from "@/app/features/relays/utils/nip65-service";
import { logAppEvent } from "@/app/shared/log-app-event";
import type { RelaySnapshot } from "@dweb/core/security-foundation-contracts";
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
import { publishOutgoingDm, publishQueuedOutgoingMessage, queueOutgoingDmForRetry } from "./outgoing-dm-publisher";
import { prepareOutgoingDm } from "./outgoing-dm-send-preparer";
import { applyRecipientRelayHints } from "./recipient-relay-hints";
import { transitionMessageStatus } from "../state-machines/message-delivery-machine";
import { orchestrateOutgoingDm, resolveTargetRelayUrls } from "./outgoing-dm-orchestrator";
import { clearRequestCooldown, getRequestCooldownRemainingMs } from "../services/request-anti-abuse";
import { incrementAbuseMetric } from "@/app/shared/abuse-observability";
import { recordRequestSuppressedRisk } from "@/app/shared/sybil-risk-signals";
import { requestFlowEvidenceStore } from "../services/request-flow-evidence-store";
import { isRetryEligiblePendingOutgoingRequest } from "../services/request-status-projection";
import { failedIncomingEventStore } from "../services/failed-incoming-event-store";
import { buildInvitationSenderProfileTag } from "../services/invitation-sender-profile-tag";
import { useWindowRuntimeSnapshot } from "@/app/features/runtime/services/window-runtime-supervisor";
import { hasNativeRuntime } from "@/app/features/runtime/runtime-capabilities";
import { SessionApi } from "@/app/features/auth/services/session-api";
import { useAccountProjectionSnapshot } from "@/app/features/account-sync/hooks/use-account-projection-snapshot";
import { selectProjectionAcceptedPeers } from "@/app/features/account-sync/services/account-projection-selectors";
import {
  type OutboundTransportKind,
  type OutboundTransportQueueState,
  useProfileTransportQueue,
} from "../services/profile-transport-queue";
import { messagingTransportRuntime } from "../services/messaging-transport-runtime";
import {
  appendCanonicalContactEvent,
  appendCanonicalDmEvent,
} from "@/app/features/account-sync/services/account-event-ingest-bridge";

/**
 * Relay pool interface
 */
export type RelayPool = Readonly<{
  connections: ReadonlyArray<RelayConnection>;
  sendToOpen: (payload: string) => void;
  publishToUrls?: (urls: ReadonlyArray<string>, payload: string) => Promise<MultiRelayPublishResult>;
  publishToAll?: (payload: string) => Promise<MultiRelayPublishResult>;
  subscribeToMessages: (handler: (params: Readonly<{ url: string; message: string }>) => void) => () => void;
  subscribe: (filters: ReadonlyArray<NostrFilter>, onEvent: (event: NostrEvent, url: string) => void) => string;
  unsubscribe: (id: string) => void;
  addTransientRelay?: (url: string) => void;
  removeTransientRelay?: (url: string) => void;
  resubscribeAll?: () => void;
  getWritableRelaySnapshot?: (scopedRelayUrls?: ReadonlyArray<string>) => RelaySnapshot;
  isConnected?: () => boolean;
  waitForConnection: (timeoutMs: number) => Promise<boolean>;
  waitForScopedConnection?: (relayUrls: ReadonlyArray<string>, timeoutMs: number) => Promise<boolean>;
}>;

/**
 * Multi-relay publish result
 */
export interface MultiRelayPublishResult {
  success: boolean;
  successCount: number;
  totalRelays: number;
  metQuorum?: boolean;
  quorumRequired?: number;
  results: Array<{
    relayUrl: string;
    success: boolean;
    error?: string;
    latency?: number;
  }>;
  failures?: Array<{
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
  deliveryStatus?: "sent_quorum" | "sent_partial" | "queued_retrying" | "failed";
  retryAtUnixMs?: number;
  messageId: string;
  relayResults: Array<{
    relayUrl: string;
    success: boolean;
    error?: string;
    latency?: number;
  }>;
  error?: string;
  failureReason?: MessageActionFailureReason;
  blockReason?: RequestSendBlockReason;
}

// buildDmEvent, countRelayFailures moved to helper modules

const getOpenRelaySignature = (connections: ReadonlyArray<RelayConnection>): string => (
  connections
    .filter((connection) => connection.status === "open")
    .map((connection) => connection.url)
    .sort()
    .join("|")
);

const RELAY_CHURN_RECOVERY_LOOKBACK_MS = 2 * 60 * 1000;
const RELAY_CHURN_RECOVERY_SYNC_COOLDOWN_MS = 15_000;
const RELAY_CHURN_DEFERRED_SYNC_RETRY_MS = 1_500;
const RELAY_CHURN_DEFERRED_SYNC_MAX_ATTEMPTS = 8;
const NATIVE_SESSION_CHECK_TTL_MS = 2_000;
const NATIVE_KEY_SENTINEL_VALUE = "native" as PrivateKeyHex;
const NATIVE_SESSION_MISMATCH_LOG_WINDOW_MS = 60_000;
const HARD_NATIVE_SESSION_MISMATCH_PHRASE = "does not match expected";

type NativeSessionCheckState = Readonly<{
  checkedAtUnixMs: number;
  mismatchReason: string | null;
}>;

const createInitialNativeSessionCheckState = (): NativeSessionCheckState => ({
  checkedAtUnixMs: 0,
  mismatchReason: null,
});

const verifyNativeSessionBinding = async (params: Readonly<{
  expectedPublicKeyHex: PublicKeyHex;
  privateKeyHex: PrivateKeyHex;
  cacheRef?: { current: NativeSessionCheckState };
  force?: boolean;
}>): Promise<string | null> => {
  if (params.privateKeyHex !== NATIVE_KEY_SENTINEL_VALUE || !hasNativeRuntime()) {
    return null;
  }
  const nowUnixMs = Date.now();
  if (!params.force && params.cacheRef) {
    const cached = params.cacheRef.current;
    if ((nowUnixMs - cached.checkedAtUnixMs) <= NATIVE_SESSION_CHECK_TTL_MS) {
      return cached.mismatchReason;
    }
  }

  let mismatchReason: string | null = null;
  try {
    const status = await SessionApi.getSessionStatus();
    const normalizedNativePubkey = normalizePublicKeyHex(status.npub ?? undefined);
    if (!status.isActive || !normalizedNativePubkey) {
      mismatchReason = "Native session is inactive for this profile window.";
    } else if (normalizedNativePubkey !== params.expectedPublicKeyHex) {
      mismatchReason = `Native session pubkey ${normalizedNativePubkey.slice(0, 16)}... does not match expected ${params.expectedPublicKeyHex.slice(0, 16)}...`;
    }
  } catch (error) {
    mismatchReason = error instanceof Error
      ? `Unable to verify native session identity: ${error.message}`
      : "Unable to verify native session identity.";
  }

  if (params.cacheRef) {
    params.cacheRef.current = {
      checkedAtUnixMs: nowUnixMs,
      mismatchReason,
    };
  }
  return mismatchReason;
};

const isHardNativeSessionMismatch = (reason: string): boolean => (
  reason.includes(HARD_NATIVE_SESSION_MISMATCH_PHRASE)
);

const createControllerInstanceId = (): string => {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `dm-controller-${Date.now()}-${Math.random().toString(16).slice(2)}`;
};

const INCOMING_EVENT_LOG_LEVEL: "info" | "debug" = (
  process.env.NODE_ENV === "production" ? "info" : "debug"
);
const INCOMING_EVENT_DEV_SAMPLE_EVERY = 25;

const shouldLogIncomingEventSeen = (seenCount: number): boolean => {
  if (process.env.NODE_ENV === "production") {
    return true;
  }
  return seenCount <= 3 || seenCount % INCOMING_EVENT_DEV_SAMPLE_EVERY === 0;
};

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
      observedAtUnixSeconds?: number;
      isRequest?: boolean;
      status?: ConnectionRequestStatusValue;
      eventId?: string;
      ingestSource?: "relay_live" | "relay_sync";
    }>) => void;
    getRequestStatus: (params: Readonly<{ peerPublicKeyHex: PublicKeyHex }>) => { status?: ConnectionRequestStatusValue; isOutgoing: boolean; lastReceivedAtUnixSeconds?: number } | null;
    setStatus: (params: Readonly<{ peerPublicKeyHex: PublicKeyHex; status: ConnectionRequestStatusValue; isOutgoing?: boolean }>) => void;
  };
  onNewMessage?: (message: Message) => void;
  onMessageDeleted?: (params: Readonly<{
    conversationId: string;
    messageId: string;
    deletedByPubkey: PublicKeyHex;
    deletionEventId: string;
  }>) => void;
  onConnectionCreated?: (pubkey: PublicKeyHex) => void;
  autoSubscribeIncoming?: boolean;
  /**
   * Canonical per-window transport owner switch.
   * When false, this controller stays send-capable but does not run incoming
   * subscriptions/sync pipelines that can race with the active owner.
   */
  enableIncomingTransport?: boolean;
  /**
   * Enables automatic background queue processing for this controller instance.
   * The runtime singleton owner should be the only caller that enables this.
   */
  enableAutoQueueProcessing?: boolean;
  /**
   * Optional owner identifier for transport diagnostics.
   */
  transportOwnerId?: string | null;
}>;

/**
 * Controller result
 */
export type UseEnhancedDMControllerResult = Readonly<{
  state: EnhancedDMControllerState;
  sendDm: (params: Readonly<{
    peerPublicKeyInput: string;
    plaintext: string;
    attachments?: ReadonlyArray<Attachment>;
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

const createRequestGuardFailure = (error: string, blockReason: RequestSendBlockReason): SendResult => ({
  success: false,
  deliveryStatus: "failed",
  messageId: "",
  relayResults: [],
  error,
  blockReason
});

const createGuardFailureWithRisk = (error: string, blockReason: RequestSendBlockReason): SendResult => {
  incrementAbuseMetric("request_send_suppressed");
  recordRequestSuppressedRisk();
  return createRequestGuardFailure(error, blockReason);
};

const PENDING_REQUEST_STALE_MS = 3 * 60 * 1000;

type RequestStatusSnapshot = Readonly<{
  status?: ConnectionRequestStatusValue;
  isOutgoing: boolean;
  lastReceivedAtUnixSeconds?: number;
}>;

const isStaleOutgoingPendingRequestState = (
  requestState: RequestStatusSnapshot | null | undefined,
  peerPublicKeyHex?: PublicKeyHex,
  nowUnixMs = Date.now(),
  staleAfterMs = PENDING_REQUEST_STALE_MS
): boolean => {
  return isRetryEligiblePendingOutgoingRequest({
    requestStatus: requestState ?? null,
    evidence: peerPublicKeyHex ? requestFlowEvidenceStore.get(peerPublicKeyHex) : undefined,
    nowUnixMs,
    resendGraceMs: staleAfterMs,
  });
};

const hasRequestDeliveryEvidence = (result: SendResult): boolean => {
  if (result.deliveryStatus === "sent_quorum" || result.deliveryStatus === "sent_partial") {
    return true;
  }
  return result.relayResults.some((entry) => entry.success);
};

const resolveTransportKind = (customTags?: ReadonlyArray<ReadonlyArray<string>>): OutboundTransportKind => {
  const requestTag = customTags?.find((tag) => tag[0] === "t")?.[1];
  if (requestTag === "connection-request") return "request";
  if (requestTag === "connection-accept") return "request_accept";
  if (requestTag === "connection-decline") return "request_decline";
  if (requestTag === "connection-cancel") return "request_cancel";
  return "dm";
};

const mapSendResultToQueueState = (result: SendResult): OutboundTransportQueueState => {
  if (result.deliveryStatus === "queued_retrying") {
    return "queued";
  }
  if (result.deliveryStatus === "sent_partial") {
    return "partial";
  }
  if (result.deliveryStatus === "sent_quorum") {
    return "published";
  }
  const relaySuccessCount = result.relayResults.filter((entry) => entry.success).length;
  if (relaySuccessCount <= 0) {
    return "terminal_failed";
  }
  if (relaySuccessCount < result.relayResults.length) {
    return "partial";
  }
  return "published";
};


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
import { deliveryDiagnosticsStore } from "../services/delivery-diagnostics-store";
import { peerRelayEvidenceStore } from "../services/peer-relay-evidence-store";

/**
 * Enhanced DM Controller Hook
 */
export const useEnhancedDMController = (
  params: UseEnhancedDMControllerParams
): UseEnhancedDMControllerResult => {
  const incomingTransportEnabled = params.enableIncomingTransport !== false;
  const autoQueueProcessingEnabled = params.enableAutoQueueProcessing === true;
  const transportOwnerId = params.transportOwnerId ?? null;
  const controllerInstanceIdRef = useRef<string>(createControllerInstanceId());
  const controllerInstanceId = controllerInstanceIdRef.current;
  const runtimeSnapshot = useWindowRuntimeSnapshot();
  const projectionRuntimeSnapshot = useAccountProjectionSnapshot();
  const projectionAcceptedPeerSet = useMemo(() => {
    if (!params.myPublicKeyHex || projectionRuntimeSnapshot.accountPublicKeyHex !== params.myPublicKeyHex) {
      return new Set<PublicKeyHex>();
    }
    return new Set<PublicKeyHex>(
      selectProjectionAcceptedPeers(projectionRuntimeSnapshot.projection)
    );
  }, [
    params.myPublicKeyHex,
    projectionRuntimeSnapshot.accountPublicKeyHex,
    projectionRuntimeSnapshot.projection,
  ]);
  const isProjectionAcceptedPeer = useCallback((value: Readonly<{ publicKeyHex: PublicKeyHex }>): boolean => (
    projectionAcceptedPeerSet.has(value.publicKeyHex)
  ), [projectionAcceptedPeerSet]);
  const transportScopeKey = useMemo(() => {
    if (!params.myPublicKeyHex) {
      return null;
    }
    const profileId = runtimeSnapshot.session.profileId?.trim();
    const windowLabel = runtimeSnapshot.session.windowLabel?.trim();
    if (!profileId || !windowLabel) {
      return null;
    }
    return `${windowLabel}:${profileId}:${params.myPublicKeyHex}`;
  }, [params.myPublicKeyHex, runtimeSnapshot.session.profileId, runtimeSnapshot.session.windowLabel]);
  const transportQueue = useProfileTransportQueue(transportScopeKey);
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
  const lastOpenRelaySignatureRef = useRef<string>("");
  const syncStateRef = useRef<{
    isSyncing: boolean;
    lastSyncAt?: Date;
    conversationTimestamps: Map<string, Date>;
  }>({
    isSyncing: false,
    conversationTimestamps: new Map()
  });
  const processingEvents = useRef<Set<string>>(new Set());
  const failedDecryptEvents = useRef<Set<string>>(new Set());
  const handledIncomingEventIds = useRef<Set<string>>(new Set());
  const loggedIncomingEventIds = useRef<Set<string>>(new Set());
  const incomingEventSeenCountRef = useRef<number>(0);
  const recipientRelayCheckCache = useRef<Set<string>>(new Set());
  const recipientRelayResolutionCache = useRef<Map<string, ReadonlyArray<string>>>(new Map());
  const closedSubscriptionIdsRef = useRef<Set<string>>(new Set());
  const nativeSessionCheckRef = useRef<NativeSessionCheckState>(createInitialNativeSessionCheckState());
  const nativeSessionMismatchLogRef = useRef<{
    reason: string | null;
    lastLoggedAtUnixMs: number;
  }>({
    reason: null,
    lastLoggedAtUnixMs: 0,
  });
  const handleIncomingEventRef = useRef<(
    event: NostrEvent,
    url?: string,
    ingestSource?: "relay_live" | "relay_sync",
  ) => Promise<void>>(async () => {});
  const initialSyncTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const hasTriggeredInitialSync = useRef(false);
  const lastRelayChurnRecoverySyncAtUnixMsRef = useRef<number>(0);
  const relayChurnDeferredSyncSinceRef = useRef<Date | null>(null);
  const relayChurnDeferredSyncAttemptCountRef = useRef<number>(0);
  const relayChurnDeferredSyncTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Use a ref for params to avoid stale closures
  const paramsRef = useRef(params);
  useEffect(() => {
    paramsRef.current = params;
  }, [params]);

  useEffect(() => {
    if (!incomingTransportEnabled || !params.myPublicKeyHex) {
      messagingTransportRuntime.unregisterIncomingOwner(controllerInstanceId);
      return;
    }
    messagingTransportRuntime.registerIncomingOwner({
      controllerInstanceId,
      transportOwnerId,
    });
    return () => {
      messagingTransportRuntime.unregisterIncomingOwner(controllerInstanceId);
    };
  }, [controllerInstanceId, incomingTransportEnabled, params.myPublicKeyHex, transportOwnerId]);

  useEffect(() => {
    nativeSessionCheckRef.current = createInitialNativeSessionCheckState();
    processingEvents.current.clear();
    failedDecryptEvents.current.clear();
    handledIncomingEventIds.current.clear();
    loggedIncomingEventIds.current.clear();
    incomingEventSeenCountRef.current = 0;
  }, [params.myPublicKeyHex, params.myPrivateKeyHex]);

  useEffect(() => {
    deliveryDiagnosticsStore.setIdentity({
      myPublicKeyHex: params.myPublicKeyHex,
      hasPrivateKey: Boolean(params.myPrivateKeyHex),
    });
  }, [params.myPrivateKeyHex, params.myPublicKeyHex]);

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
        setState(prev => createErrorState('Failed to load local message history. Try refreshing the app.', [], errorHandler.handleUnknownError(error as Error)));
      }
    };
    void loadMessages();
  }, [messageQueue, params.myPublicKeyHex]);

  /**
   * Orchestrate sync on mount/network change.
   * Backfill events are routed through the same handler as live subscriptions.
   */
  const syncMissedMessages = useCallback(async (since?: Date): Promise<void> => {
    if (!incomingTransportEnabled) {
      return;
    }
    await syncMissedMessagesImpl({
      myPublicKeyHex: params.myPublicKeyHex,
      messageQueue,
      pool: params.pool,
      syncStateRef,
      setState,
      onIncomingEvent: (event, url, ingestSource) => handleIncomingEventRef.current(event, url, ingestSource),
      diagnostics: {
        transportOwnerId,
        controllerInstanceId,
      },
    }, since);
  }, [controllerInstanceId, incomingTransportEnabled, params.myPublicKeyHex, params.pool, messageQueue, transportOwnerId]);

  /**
   * Monitor network state changes
   */
  useEffect(() => {
    if (!incomingTransportEnabled) {
      return;
    }
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
  }, [incomingTransportEnabled, syncMissedMessages]);

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
    if (!autoQueueProcessingEnabled) {
      messagingTransportRuntime.unregisterQueueProcessor(controllerInstanceId);
      return;
    }
    if (!messageQueue || !params.myPublicKeyHex) {
      return;
    }
    messagingTransportRuntime.registerQueueProcessor({
      controllerInstanceId,
      transportOwnerId,
    });
    logAppEvent({
      name: "messaging.transport.queue_processor_started",
      level: "info",
      scope: { feature: "messaging", action: "queue_processing" },
      context: {
        controllerInstanceId,
        transportOwnerId: transportOwnerId ?? "none",
      },
    });
    const teardown = setupAutoQueueProcessing({
      messageQueue,
      pool: params.pool,
      getPool: () => paramsRef.current.pool,
      setState,
      diagnostics: {
        transportOwnerId,
        controllerInstanceId,
      },
    });
    return () => {
      teardown();
      messagingTransportRuntime.unregisterQueueProcessor(controllerInstanceId);
      logAppEvent({
        name: "messaging.transport.queue_processor_stopped",
        level: "info",
        scope: { feature: "messaging", action: "queue_processing" },
        context: {
          controllerInstanceId,
          transportOwnerId: transportOwnerId ?? "none",
        },
      });
    };
  }, [
    autoQueueProcessingEnabled,
    controllerInstanceId,
    messageQueue,
    params.myPublicKeyHex,
    setState,
    transportOwnerId,
  ]);

  const sendConnectionReceiptAck = useCallback(async (ackParams: Readonly<{
    peerPublicKeyHex: PublicKeyHex;
    requestEventId: string;
  }>): Promise<void> => {
    if (!params.myPrivateKeyHex || !params.myPublicKeyHex) {
      return;
    }
    try {
      const discoveredRecipientRelayUrls = await ensureConnectedToRecipientRelays({
        pool: params.pool,
        recipientRelayCheckCache,
        recipientRelayResolutionCache,
      }, ackParams.peerPublicKeyHex);
      const openRelayUrls = params.pool.connections
        .filter((connection) => connection.status === "open")
        .map((connection) => connection.url);
      const relayTargeting = resolveTargetRelayUrls({
        customTags: [["t", "connection-received"]],
        discoveredRecipientRelayUrls,
        senderOpenRelayUrls: openRelayUrls,
        senderWriteRelayUrls: nip65Service.getWriteRelays(params.myPublicKeyHex),
        recipientWriteRelayUrls: nip65Service.getWriteRelays(ackParams.peerPublicKeyHex),
        recipientInboundRelayUrls: peerRelayEvidenceStore.getRelayUrls(ackParams.peerPublicKeyHex),
      });
      const targetRelayUrls = relayTargeting.targetRelayUrls;
      if (targetRelayUrls.length === 0 && openRelayUrls.length === 0) {
        return;
      }
      const ackTags: ReadonlyArray<ReadonlyArray<string>> = [
        ["p", ackParams.peerPublicKeyHex],
        ["t", "connection-received"],
        ["e", ackParams.requestEventId],
      ];
      const createdAtUnixSeconds = Math.floor(Date.now() / 1000);
      let builtAck: DmEventBuildResult;
      try {
        builtAck = await buildDmEvent({
          format: "nip17",
          plaintext: "Connection request received.",
          recipientPubkey: ackParams.peerPublicKeyHex,
          senderPubkey: params.myPublicKeyHex,
          senderPrivateKeyHex: params.myPrivateKeyHex,
          createdAtUnixSeconds,
          tags: ackTags,
        });
      } catch {
        builtAck = await buildDmEvent({
          format: "nip04",
          plaintext: "Connection request received.",
          recipientPubkey: ackParams.peerPublicKeyHex,
          senderPubkey: params.myPublicKeyHex,
          senderPrivateKeyHex: params.myPrivateKeyHex,
          createdAtUnixSeconds,
          tags: ackTags,
        });
      }
      const payload = JSON.stringify(["EVENT", builtAck.signedEvent]);
      if (params.pool.publishToUrls) {
        await params.pool.publishToUrls(
          targetRelayUrls.length > 0 ? targetRelayUrls : openRelayUrls,
          payload
        );
        return;
      }
      if (params.pool.publishToAll) {
        await params.pool.publishToAll(payload);
        return;
      }
      params.pool.sendToOpen(payload);
    } catch (error) {
      logAppEvent({
        name: "messaging.request.receipt_ack.failed",
        level: "warn",
        scope: { feature: "messaging", action: "send_connection_request_ack" },
        context: {
          peerPubkey: ackParams.peerPublicKeyHex.slice(0, 16),
          eventId: ackParams.requestEventId,
          error: error instanceof Error ? error.message : "unknown",
        },
      });
    }
  }, [
    params.myPrivateKeyHex,
    params.myPublicKeyHex,
    params.pool,
    recipientRelayCheckCache,
    recipientRelayResolutionCache,
  ]);

  /**
   * Subscription and Message handling
   */
  const handleIncomingEvent = useCallback(async (
    event: NostrEvent,
    relayUrl?: string,
    ingestSource: "relay_live" | "relay_sync" = "relay_live",
  ): Promise<void> => {
    if (!incomingTransportEnabled) {
      return;
    }
    const p = paramsRef.current;
    if (!p.myPrivateKeyHex || !p.myPublicKeyHex) return;
    const nativeMismatchReason = await verifyNativeSessionBinding({
      expectedPublicKeyHex: p.myPublicKeyHex,
      privateKeyHex: p.myPrivateKeyHex,
      cacheRef: nativeSessionCheckRef,
    });
    if (nativeMismatchReason) {
      const hardMismatch = isHardNativeSessionMismatch(nativeMismatchReason);
      const nowUnixMs = Date.now();
      const previousMismatch = nativeSessionMismatchLogRef.current;
      const shouldLogMismatch = previousMismatch.reason !== nativeMismatchReason
        || (nowUnixMs - previousMismatch.lastLoggedAtUnixMs) >= NATIVE_SESSION_MISMATCH_LOG_WINDOW_MS;
      if (shouldLogMismatch) {
        nativeSessionMismatchLogRef.current = {
          reason: nativeMismatchReason,
          lastLoggedAtUnixMs: nowUnixMs,
        };
        logAppEvent({
          name: "messaging.native_session.identity_mismatch_receive",
          level: hardMismatch ? "error" : "warn",
          scope: { feature: "messaging", action: "receive_dm" },
          context: {
            expectedPubkey: p.myPublicKeyHex.slice(0, 16),
            eventId: event.id.slice(0, 16),
            reason: nativeMismatchReason,
            enforcement: hardMismatch ? "drop_event" : "continue_processing",
          },
        });
      }
      if (hardMismatch) {
        deliveryDiagnosticsStore.markIncoming({
          eventId: event.id,
          kind: event.kind,
          senderPubkey: event.pubkey,
          recipientPubkey: p.myPublicKeyHex,
          relayUrl,
          action: "ignored",
          reason: "native_session_identity_mismatch",
        });
        return;
      }
    }
    if (!nativeMismatchReason && nativeSessionMismatchLogRef.current.reason) {
      nativeSessionMismatchLogRef.current = {
        reason: null,
        lastLoggedAtUnixMs: Date.now(),
      };
    }
    if (nativeMismatchReason && !isHardNativeSessionMismatch(nativeMismatchReason)) {
      deliveryDiagnosticsStore.markIncoming({
        eventId: event.id,
        kind: event.kind,
        senderPubkey: event.pubkey,
        recipientPubkey: p.myPublicKeyHex,
        relayUrl,
        action: "seen",
        reason: "native_session_identity_unverified",
      });
    }
    if (failedIncomingEventStore.isSuppressed(event.id)) return;
    if (!loggedIncomingEventIds.current.has(event.id)) {
      loggedIncomingEventIds.current.add(event.id);
      if (loggedIncomingEventIds.current.size > 4000) {
        loggedIncomingEventIds.current.clear();
      }
      incomingEventSeenCountRef.current += 1;
      const shouldLog = shouldLogIncomingEventSeen(incomingEventSeenCountRef.current);
      if (shouldLog) {
        logAppEvent({
          name: "messaging.transport.incoming_event_seen",
          level: INCOMING_EVENT_LOG_LEVEL,
          scope: { feature: "messaging", action: "receive_dm" },
          context: {
            eventId: event.id.slice(0, 16),
            kind: event.kind,
            senderPubkey: event.pubkey.slice(0, 16),
            recipientPubkey: p.myPublicKeyHex.slice(0, 16),
            relayUrl: relayUrl?.slice(0, 64) ?? null,
            hasPTag: event.tags.some((tag) => tag[0] === "p"),
            hasConnectionTag: event.tags.some((tag) => tag[0] === "t" && tag[1].startsWith("connection-")),
            transportOwnerId: transportOwnerId ?? "none",
            controllerInstanceId,
            seenCount: incomingEventSeenCountRef.current,
          }
        });
      }
    }
    await handleIncomingDmEvent({
      event,
      relayUrl,
      currentParams: {
        myPrivateKeyHex: p.myPrivateKeyHex,
        myPublicKeyHex: p.myPublicKeyHex,
        blocklist: p.blocklist,
        peerTrust: p.peerTrust,
        isProjectionAcceptedPeer,
        requestsInbox: p.requestsInbox,
        onNewMessage: p.onNewMessage,
        onMessageDeleted: p.onMessageDeleted,
        onConnectionCreated: p.onConnectionCreated,
        sendConnectionReceiptAck,
        ingestSource,
        transportOwnerId,
        controllerInstanceId,
      },
      messageQueue,
      processingEvents: processingEvents.current,
      failedDecryptEvents: failedDecryptEvents.current,
      handledIncomingEventIds: handledIncomingEventIds.current,
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
  }, [controllerInstanceId, incomingTransportEnabled, isProjectionAcceptedPeer, messageQueue, sendConnectionReceiptAck, state.messages, transportOwnerId]);
  handleIncomingEventRef.current = handleIncomingEvent;

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
      if (incomingEvent?.kind === 10002) {
        void nip65Service.ingestVerifiedEvent(incomingEvent).catch(() => {
          // Ignore invalid or unverifiable relay-hint events to keep the relay path non-throwing.
        });
      }
    });
  }, [params.pool, messageQueue]);

  /**
   * Controller API Implementation
   */
  /**
   * Controller API Implementation
   */
  const subscribeToIncomingDMsImpl = useCallback((): void => {
    if (!incomingTransportEnabled) {
      return;
    }
    subscribeToIncomingDMs({
      myPublicKeyHex: params.myPublicKeyHex,
      pool: params.pool,
      hasSubscribedRef,
      activeSubscriptions,
      closedSubscriptionIdsRef,
      setState,
      onEvent: (event, url) => {
        void handleIncomingEvent(event, url, "relay_live");
      },
    });
  }, [incomingTransportEnabled, handleIncomingEvent, params.myPublicKeyHex, params.pool]);

  const unsubscribeFromDMsImpl = useCallback((): void => {
    unsubscribeFromDMs({
      pool: params.pool,
      activeSubscriptions,
      closedSubscriptionIdsRef,
      hasSubscribedRef,
      setState
    });
  }, [params.pool]);

  useEffect(() => {
    if (!incomingTransportEnabled || !params.myPublicKeyHex) {
      unsubscribeFromDMsImpl();
      if (initialSyncTimeoutRef.current) {
        clearTimeout(initialSyncTimeoutRef.current);
        initialSyncTimeoutRef.current = null;
      }
      if (relayChurnDeferredSyncTimerRef.current) {
        clearTimeout(relayChurnDeferredSyncTimerRef.current);
        relayChurnDeferredSyncTimerRef.current = null;
      }
      relayChurnDeferredSyncSinceRef.current = null;
      relayChurnDeferredSyncAttemptCountRef.current = 0;
      hasTriggeredInitialSync.current = false;
      return;
    }

    return () => {
      unsubscribeFromDMsImpl();
      if (initialSyncTimeoutRef.current) {
        clearTimeout(initialSyncTimeoutRef.current);
        initialSyncTimeoutRef.current = null;
      }
      if (relayChurnDeferredSyncTimerRef.current) {
        clearTimeout(relayChurnDeferredSyncTimerRef.current);
        relayChurnDeferredSyncTimerRef.current = null;
      }
      relayChurnDeferredSyncSinceRef.current = null;
      relayChurnDeferredSyncAttemptCountRef.current = 0;
      hasTriggeredInitialSync.current = false;
    };
  }, [incomingTransportEnabled, params.myPublicKeyHex, unsubscribeFromDMsImpl]);

  // Handle auto-subscribe on connection
  useEffect(() => {
    if (!incomingTransportEnabled) return;
    if (params.autoSubscribeIncoming === false) return;
    if (!params.myPublicKeyHex) return;
    if (!hasSubscribedRef.current) {
      subscribeToIncomingDMsImpl();
    }
  }, [incomingTransportEnabled, params.autoSubscribeIncoming, params.myPublicKeyHex, subscribeToIncomingDMsImpl]);

  useEffect(() => {
    if (!incomingTransportEnabled) {
      return;
    }
    if (!params.myPublicKeyHex) {
      lastOpenRelaySignatureRef.current = "";
      return;
    }

    const openRelaySignature = getOpenRelaySignature(params.pool.connections);
    if (!openRelaySignature) {
      lastOpenRelaySignatureRef.current = "";
      return;
    }

    const previousOpenRelaySignature = lastOpenRelaySignatureRef.current;
    const relaySetChanged = openRelaySignature !== previousOpenRelaySignature;
    lastOpenRelaySignatureRef.current = openRelaySignature;

    if (!previousOpenRelaySignature || !hasSubscribedRef.current || activeSubscriptions.current.size === 0 || !relaySetChanged) {
      return;
    }

    params.pool.resubscribeAll?.();

    const nowUnixMs = Date.now();
    const cooldownElapsedMs = nowUnixMs - lastRelayChurnRecoverySyncAtUnixMsRef.current;
    let forcedSyncTriggered = false;
    let deferredSyncScheduled = false;
    let forcedSyncSinceUnixSeconds: number | null = null;
    let skippedReason: "cooldown" | "sync_in_progress" | null = null;

    if (cooldownElapsedMs < RELAY_CHURN_RECOVERY_SYNC_COOLDOWN_MS) {
      skippedReason = "cooldown";
    } else {
      const baseSinceUnixMs = syncStateRef.current.lastSyncAt?.getTime() ?? nowUnixMs;
      const forcedSince = new Date(Math.max(0, baseSinceUnixMs - RELAY_CHURN_RECOVERY_LOOKBACK_MS));
      forcedSyncSinceUnixSeconds = Math.floor(forcedSince.getTime() / 1000);
      if (syncStateRef.current.isSyncing) {
        skippedReason = "sync_in_progress";
        deferredSyncScheduled = true;
        relayChurnDeferredSyncSinceRef.current = forcedSince;
        relayChurnDeferredSyncAttemptCountRef.current = 0;

        if (!relayChurnDeferredSyncTimerRef.current) {
          const attemptDeferredSync = (): void => {
            if (!incomingTransportEnabled || !params.myPublicKeyHex) {
              relayChurnDeferredSyncSinceRef.current = null;
              relayChurnDeferredSyncAttemptCountRef.current = 0;
              relayChurnDeferredSyncTimerRef.current = null;
              return;
            }
            if (syncStateRef.current.isSyncing) {
              relayChurnDeferredSyncAttemptCountRef.current += 1;
              if (relayChurnDeferredSyncAttemptCountRef.current >= RELAY_CHURN_DEFERRED_SYNC_MAX_ATTEMPTS) {
                relayChurnDeferredSyncSinceRef.current = null;
                relayChurnDeferredSyncAttemptCountRef.current = 0;
                relayChurnDeferredSyncTimerRef.current = null;
                return;
              }
              relayChurnDeferredSyncTimerRef.current = setTimeout(attemptDeferredSync, RELAY_CHURN_DEFERRED_SYNC_RETRY_MS);
              return;
            }
            const deferredSince = relayChurnDeferredSyncSinceRef.current;
            relayChurnDeferredSyncSinceRef.current = null;
            relayChurnDeferredSyncAttemptCountRef.current = 0;
            relayChurnDeferredSyncTimerRef.current = null;
            if (!deferredSince) {
              return;
            }
            lastRelayChurnRecoverySyncAtUnixMsRef.current = Date.now();
            void syncMissedMessages(deferredSince);
          };
          relayChurnDeferredSyncTimerRef.current = setTimeout(attemptDeferredSync, RELAY_CHURN_DEFERRED_SYNC_RETRY_MS);
        }
      } else {
        lastRelayChurnRecoverySyncAtUnixMsRef.current = nowUnixMs;
        forcedSyncTriggered = true;
        void syncMissedMessages(forcedSince);
      }
    }

    logAppEvent({
      name: "messaging.transport.relay_set_churn_recovery",
      level: "info",
      scope: { feature: "messaging", action: "transport_runtime" },
      context: {
        previousOpenRelaySignature: previousOpenRelaySignature || null,
        openRelaySignature,
        openRelayCount: openRelaySignature.split("|").filter(Boolean).length,
        resubscribeTriggered: typeof params.pool.resubscribeAll === "function",
        forcedSyncTriggered,
        deferredSyncScheduled,
        forcedSyncSinceUnixSeconds,
        skippedReason,
        transportOwnerId: transportOwnerId ?? "none",
        controllerInstanceId,
      },
    });
  }, [controllerInstanceId, incomingTransportEnabled, params.myPublicKeyHex, params.pool, params.pool.connections, syncMissedMessages, transportOwnerId]);

  // Handle initial sync on connection
  useEffect(() => {
    if (!incomingTransportEnabled) {
      if (initialSyncTimeoutRef.current) {
        clearTimeout(initialSyncTimeoutRef.current);
        initialSyncTimeoutRef.current = null;
      }
      return;
    }
    if (!params.myPublicKeyHex) return;
    recipientRelayCheckCache.current.clear();
    recipientRelayResolutionCache.current.clear();
    closedSubscriptionIdsRef.current.clear();
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
  }, [incomingTransportEnabled, params.pool.connections, params.myPublicKeyHex, syncMissedMessages]);

  const sendDmDirect = useCallback(async (sendParams: Readonly<{
    peerPublicKeyInput: string;
    plaintext: string;
    attachments?: ReadonlyArray<Attachment>;
    replyTo?: string;
    customTags?: string[][];
  }>): Promise<SendResult> => {
    if (!params.myPrivateKeyHex || !params.myPublicKeyHex) {
      const error = 'Identity must be unlocked to send messages';
      setState(prev => createErrorState(error, prev.messages, errorHandler.handleInvalidInput(error)));
      return { success: false, messageId: '', relayResults: [], error };
    }
    const nativeMismatchReason = await verifyNativeSessionBinding({
      expectedPublicKeyHex: params.myPublicKeyHex,
      privateKeyHex: params.myPrivateKeyHex,
      cacheRef: nativeSessionCheckRef,
      force: true,
    });
    if (nativeMismatchReason) {
      const hardMismatch = isHardNativeSessionMismatch(nativeMismatchReason);
      const error = `Native session/profile mismatch detected. ${nativeMismatchReason} Lock and unlock this profile window, then retry.`;
      logAppEvent({
        name: "messaging.native_session.identity_mismatch_send",
        level: hardMismatch ? "error" : "warn",
        scope: { feature: "messaging", action: "send_dm" },
        context: {
          expectedPubkey: params.myPublicKeyHex.slice(0, 16),
          reason: nativeMismatchReason,
          enforcement: hardMismatch ? "reject_send" : "continue_send",
        },
      });
      if (hardMismatch) {
        setState(prev => createErrorState(error, prev.messages, errorHandler.handleInvalidInput(error)));
        return { success: false, deliveryStatus: "failed", messageId: "", relayResults: [], error, failureReason: "unknown" };
      }
    }

    return orchestrateOutgoingDm({
      ...sendParams,
      myPublicKeyHex: params.myPublicKeyHex,
      myPrivateKeyHex: params.myPrivateKeyHex,
      pool: params.pool,
      messageQueue,
      recipientRelayCheckCache,
      recipientRelayResolutionCache,
      pendingMessages,
      relayRequestTimes,
      maxMessagesInMemory: MAX_MESSAGES_IN_MEMORY,
      setState,
      createReadyState,
      createErrorState
    });
  }, [params.myPrivateKeyHex, params.myPublicKeyHex, params.pool, messageQueue]);

  const sendDm = useCallback(async (sendParams: Readonly<{
    peerPublicKeyInput: string;
    plaintext: string;
    attachments?: ReadonlyArray<Attachment>;
    replyTo?: string;
    customTags?: string[][];
  }>): Promise<SendResult> => {
    const normalizedPeer = normalizePublicKeyHex(sendParams.peerPublicKeyInput);
    const transportKind = resolveTransportKind(sendParams.customTags);
    const result = await transportQueue.enqueue({
      kind: transportKind,
      peerPublicKeyHex: normalizedPeer ?? undefined,
      requiredScope: normalizedPeer ? "recipient_scope" : "default",
      processor: async () => {
        const result = await sendDmDirect(sendParams);
        return {
          queueState: mapSendResultToQueueState(result),
          eventId: result.messageId || undefined,
          targetRelayUrls: result.relayResults.map((entry) => entry.relayUrl),
          output: result,
        };
      },
    });
    if (
      transportKind === "dm"
      && params.myPublicKeyHex
      && normalizedPeer
      && result.messageId
      && (result.deliveryStatus === "sent_quorum" || result.deliveryStatus === "sent_partial")
    ) {
      const conversationId = [params.myPublicKeyHex, normalizedPeer].sort().join(":");
      void appendCanonicalDmEvent({
        accountPublicKeyHex: params.myPublicKeyHex,
        peerPublicKeyHex: normalizedPeer,
        type: "DM_SENT_CONFIRMED",
        conversationId,
        messageId: result.messageId,
        eventCreatedAtUnixSeconds: Math.floor(Date.now() / 1000),
        plaintextPreview: sendParams.plaintext,
        idempotencySuffix: result.messageId,
        source: "legacy_bridge",
      });
    }
    return result;
  }, [sendDmDirect, transportQueue]);

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
      await sendDm({ peerPublicKeyInput: m.recipientPubkey, plaintext: m.content, attachments: m.attachments, replyTo: m.replyTo?.messageId });
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
      const normalizedPeer = normalizePublicKeyHex(req.peerPublicKeyHex);
      if (!normalizedPeer) {
        return createGuardFailureWithRisk("Invalid recipient public key.", "invalid_peer_key");
      }

      const normalizedSelf = normalizePublicKeyHex(params.myPublicKeyHex);
      if (!normalizedSelf) {
        return createGuardFailureWithRisk("Identity must be unlocked to send a connection request.", "identity_locked");
      }

      if (normalizedPeer === normalizedSelf) {
        return createGuardFailureWithRisk("You cannot send a connection request to yourself.", "self_request");
      }

      if (params.blocklist?.isBlocked({ publicKeyHex: normalizedPeer })) {
        return createGuardFailureWithRisk("Cannot send a request to a blocked user.", "peer_blocked");
      }

      if (params.peerTrust?.isAccepted({ publicKeyHex: normalizedPeer })) {
        return createGuardFailureWithRisk("You are already connected to this user.", "already_connected");
      }

      const requestState = params.requestsInbox?.getRequestStatus({ peerPublicKeyHex: normalizedPeer });
      const requestEvidence = requestFlowEvidenceStore.get(normalizedPeer);
      const hasPendingOutgoing = !!(
        requestState?.isOutgoing &&
        (requestState.status === "pending" || !requestState.status)
      );
      const hasPendingIncoming = !!(
        requestState &&
        !requestState.isOutgoing &&
        requestState.status === "pending"
      );
      const stalePendingOutgoing = isStaleOutgoingPendingRequestState(requestState, normalizedPeer);
      const recipientHasSeenPendingOutgoing = hasPendingOutgoing && requestEvidence.receiptAckSeen;
      if (hasPendingIncoming) {
        return createGuardFailureWithRisk("A connection request is already pending for this user.", "pending_request_exists");
      }
      if (hasPendingOutgoing && !recipientHasSeenPendingOutgoing) {
        logAppEvent({
          name: stalePendingOutgoing
            ? "messaging.request.guard.stale_pending_bypass"
            : "messaging.request.guard.sender_pending_retry_allowed",
          level: stalePendingOutgoing ? "warn" : "info",
          scope: { feature: "messaging", action: "send_connection_request" },
          context: {
            peerPubkey: normalizedPeer.slice(0, 16),
            staleAfterMs: PENDING_REQUEST_STALE_MS,
            lastReceivedAtUnixSeconds: requestState?.lastReceivedAtUnixSeconds ?? null,
            receiptAckSeen: requestEvidence.receiptAckSeen,
          }
        });
      }

      if (requestState?.status === "accepted") {
        return createGuardFailureWithRisk("This connection request is already accepted.", "already_accepted");
      }

      const cooldownRemainingMs = getRequestCooldownRemainingMs({
        myPublicKeyHex: normalizedSelf,
        peerPublicKeyHex: normalizedPeer
      });
      if (cooldownRemainingMs > 0) {
        clearRequestCooldown({
          myPublicKeyHex: normalizedSelf,
          peerPublicKeyHex: normalizedPeer
        });
      }

      const writeRelays = params.myPublicKeyHex ? nip65Service.getWriteRelays(params.myPublicKeyHex) : [];
      const tags = [['t', 'connection-request']];
      if (writeRelays.length > 0) tags.push(['relays', ...writeRelays]);
      const senderProfileTag = buildInvitationSenderProfileTag();
      if (senderProfileTag) {
        tags.push(senderProfileTag);
      }

      // Reset stale evidence so the UI tracks the NEW send attempt
      requestFlowEvidenceStore.reset(normalizedPeer);

      const res = await sendDm({ peerPublicKeyInput: normalizedPeer, plaintext: req.introMessage || "Hello!", customTags: tags });
      if (params.myPublicKeyHex && hasRequestDeliveryEvidence(res)) {
        requestFlowEvidenceStore.markRequestPublished({
          peerPublicKeyHex: normalizedPeer,
          requestEventId: res.messageId || undefined,
        });
        params.requestsInbox?.setStatus({ peerPublicKeyHex: normalizedPeer, status: "pending", isOutgoing: true });
        void appendCanonicalContactEvent({
          accountPublicKeyHex: params.myPublicKeyHex,
          peerPublicKeyHex: normalizedPeer,
          type: "CONTACT_REQUEST_SENT",
          direction: "outgoing",
          requestEventId: res.messageId || undefined,
          idempotencySuffix: res.messageId || normalizedPeer,
          source: "legacy_bridge",
        });
      }
      return res;
    },
    watchConversation: async (peer) => {
      await ensureConnectedToRecipientRelays({
        pool: params.pool,
        recipientRelayCheckCache,
        recipientRelayResolutionCache,
      }, peer);
      if (hasSubscribedRef.current) activeSubscriptions.current.forEach(sub => params.pool.sendToOpen(JSON.stringify(['REQ', sub.id, sub.filter])));
    }
  }), [state, sendDm, messageQueue, syncMissedMessages, subscribeToIncomingDMsImpl, unsubscribeFromDMsImpl, params.pool, params.myPublicKeyHex, params.requestsInbox]);
};

export const enhancedDmControllerInternals = {
  isStaleOutgoingPendingRequestState,
  PENDING_REQUEST_STALE_MS,
  hasRequestDeliveryEvidence,
};
