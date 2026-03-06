/**
 * Enhanced Relay Pool with Health Monitoring
 * 
 * Extends the existing relay pool with:
 * - Connection health monitoring
 * - Exponential backoff retry
 * - Circuit breaker pattern
 * - Multi-relay publishing with failover
 * 
 * Requirements: 4.2, 4.3, 4.6, 7.7, 1.4, 1.5, 4.8
 */

import { useEffect, useMemo, useSyncExternalStore } from "react";
import type { NostrEvent } from "@dweb/nostr/nostr-event";
import { createRelayWebSocket } from "./create-relay-websocket";
import type { RelayConnection } from "./relay-connection";
import type { RelayConnectionStatus } from "./relay-connection-status";
import { relayHealthMonitor, type RelayHealthMetrics } from "./relay-health-monitor";
import { SubscriptionManager } from "./subscription-manager";
import type { NostrFilter } from "../types/nostr-filter";
import { PrivacySettingsService } from "@/app/features/settings/services/privacy-settings-service";
import { logWithRateLimit } from "@/app/shared/log-hygiene";
import { incrementReliabilityMetric } from "@/app/shared/reliability-observability";

type RelayPoolState = Readonly<{
  connections: ReadonlyArray<RelayConnection>;
  healthMetrics: ReadonlyArray<RelayHealthMetrics>;
}>;

export type EnhancedRelayPoolResult = Readonly<{
  connections: ReadonlyArray<RelayConnection>;
  healthMetrics: ReadonlyArray<RelayHealthMetrics>;
  sendToOpen: (payload: string) => void;
  publishToUrl: (url: string, payload: string) => Promise<PublishResult>;
  publishToUrls: (urls: ReadonlyArray<string>, payload: string) => Promise<MultiRelayPublishResult>;
  publishToRelay: (url: string, payload: string) => Promise<PublishResult>;
  publishToAll: (payload: string) => Promise<MultiRelayPublishResult>;
  broadcastEvent: (payload: string) => Promise<MultiRelayPublishResult>;
  subscribeToMessages: (handler: (params: Readonly<{ url: string; message: string }>) => void) => () => void;
  subscribe: (filters: ReadonlyArray<NostrFilter>, onEvent: (event: NostrEvent, url: string) => void) => string;
  unsubscribe: (id: string) => void;
  getRelayHealth: (url: string) => RelayHealthMetrics | undefined;
  canConnectToRelay: (url: string) => boolean;
  addTransientRelay: (url: string) => void;
  removeTransientRelay: (url: string) => void;
  isConnected: () => boolean;
  waitForConnection: (timeoutMs: number) => Promise<boolean>;
}>;

type RelayStatusByUrl = Readonly<Record<string, RelayConnection>>;
type SocketByUrl = Readonly<Record<string, WebSocket>>;
type MessageListener = (params: Readonly<{ url: string; message: string }>) => void;
type Unsubscribe = () => void;

const FALLBACK_RELAYS: ReadonlyArray<string> = [
  "wss://relay.damus.io",
  "wss://nos.lol",
  "wss://relay.primal.net"
];

/**
 * Result of publishing to a single relay
 */
export interface PublishResult {
  success: boolean;
  relayUrl: string;
  error?: string;
  latency?: number;
}

/**
 * Result of publishing to multiple relays
 */
export interface MultiRelayPublishResult {
  success: boolean;
  successCount: number;
  totalRelays: number;
  metQuorum?: boolean;
  quorumRequired?: number;
  results: PublishResult[];
  failures?: PublishResult[];
  overallError?: string;
}

export type RelayHealthScore = Readonly<{
  url: string;
  score: number;
  latencyScore: number;
  successRateScore: number;
  churnPenalty: number;
  connectionStatusScore: number;
}>;

export type RelaySelectionDecision = Readonly<{
  orderedUrls: ReadonlyArray<string>;
  scores: ReadonlyArray<RelayHealthScore>;
}>;

export type PublishQuorumResult = Readonly<{
  successCount: number;
  totalRelays: number;
  quorumRequired: number;
  metQuorum: boolean;
  failures: ReadonlyArray<PublishResult>;
}>;

const getUnixMs = (): number => Date.now();

const createNextConnection = (params: Readonly<{
  url: string;
  status: RelayConnectionStatus;
  errorMessage?: string
}>): RelayConnection => ({
  url: params.url,
  status: params.status,
  updatedAtUnixMs: getUnixMs(),
  errorMessage: params.errorMessage
});

const upsertConnection = (current: RelayStatusByUrl, next: RelayConnection): RelayStatusByUrl => ({
  ...current,
  [next.url]: next
});

// Global state
let relayUrlsKey: string = "";
let statusByUrl: RelayStatusByUrl = {};

const hasAnyOpenSocket = (): boolean => {
  return Object.values(socketsByUrl).some((socket: WebSocket): boolean => socket.readyState === WebSocket.OPEN);
};

const activateFallbackIfOffline = (): void => {
  if (fallbackActivated) {
    return;
  }
  if (hasAnyOpenSocket()) {
    return;
  }
  const permanentUrls: ReadonlyArray<string> = relayUrlsKey ? relayUrlsKey.split("|") : [];
  const existing: Set<string> = new Set([...permanentUrls, ...Array.from(transientRelayUrls)]);
  const toAdd: ReadonlyArray<string> = FALLBACK_RELAYS.filter((url: string): boolean => !existing.has(url));
  if (toAdd.length === 0) {
    return;
  }
  fallbackActivated = true;
  toAdd.forEach((url: string) => addTransientRelay(url));
};
let socketsByUrl: SocketByUrl = {};
const transientRelayUrls: Set<string> = new Set();
const listeners: Set<() => void> = new Set();
const messageListeners: Set<MessageListener> = new Set();
let cachedSnapshot: RelayPoolState = { connections: [], healthMetrics: [] };
let notifyScheduled: boolean = false;
let fallbackActivated: boolean = false;

// Initialize Subscription Manager
const subscriptionManager = new SubscriptionManager(
  (payload) => {
    const urls = relayUrlsKey ? relayUrlsKey.split("|") : [];
    const preferredUrls = getPreferredOpenRelayUrls(urls);
    preferredUrls.forEach((url) => {
      const socket = socketsByUrl[url];
      if (socket && socket.readyState === WebSocket.OPEN) {
        socket.send(payload);
      }
    });
  },
  (handler) => {
    messageListeners.add(handler);
    return () => messageListeners.delete(handler);
  }
);

// Retry timers for reconnection
const retryTimers: Map<string, NodeJS.Timeout> = new Map();

/**
 * Pending OK response resolvers
 * Key: relayUrl:eventId
 */
const pendingOkResolvers: Map<string, {
  resolve: (result: PublishResult) => void;
  timer: NodeJS.Timeout;
  startTime: number;
}> = new Map();

const DEFAULT_PUBLISH_TIMEOUT_MS = 4000;
const RECONNECT_JITTER_FACTOR = 0.2;

const isReliabilityCoreEnabled = (): boolean => {
  try {
    return PrivacySettingsService.getSettings().reliabilityCoreV087;
  } catch {
    return true;
  }
};

const calculateQuorumRequired = (connectedRelayCount: number): number => {
  if (connectedRelayCount <= 0) return 1;
  if (connectedRelayCount >= 4) return 2;
  return 1;
};

const toRelayHealthScore = (url: string): RelayHealthScore => {
  const metrics = relayHealthMonitor.getMetrics(url);
  const connection = statusByUrl[url];
  const connectionStatusScore = connection?.status === "open" ? 1 : connection?.status === "connecting" ? 0.5 : 0;
  const successRate = typeof metrics?.successRate === "number" ? Math.max(0, Math.min(1, metrics.successRate)) : 0.5;
  const successRateScore = successRate;
  const latency = typeof metrics?.latency === "number" && Number.isFinite(metrics.latency) ? metrics.latency : 2_000;
  const latencyScore = Math.max(0, Math.min(1, 1 - (latency / 2_000)));
  const failedConnections = metrics?.failedConnections ?? 0;
  const successfulConnections = metrics?.successfulConnections ?? 0;
  const churnRatio = failedConnections > 0 ? failedConnections / Math.max(1, failedConnections + successfulConnections) : 0;
  const churnPenalty = Math.max(0, Math.min(1, churnRatio));
  const score = (successRateScore * 0.5) + (latencyScore * 0.3) + (connectionStatusScore * 0.2) - (churnPenalty * 0.4);
  return { url, score, latencyScore, successRateScore, churnPenalty, connectionStatusScore };
};

const buildRelaySelectionDecision = (urls: ReadonlyArray<string>): RelaySelectionDecision => {
  const scores = urls.map((url) => toRelayHealthScore(url));
  const orderedUrls = [...scores]
    .sort((a, b) => b.score - a.score)
    .map((entry) => entry.url);
  return {
    orderedUrls,
    scores,
  };
};

const evaluatePublishQuorum = (
  params: Readonly<{
    results: ReadonlyArray<PublishResult>;
    totalRelays: number;
    reliabilityEnabled: boolean;
  }>
): PublishQuorumResult => {
  const successCount = params.results.filter((r) => r.success).length;
  const failures = params.results.filter((r) => !r.success);
  const quorumRequired = params.reliabilityEnabled
    ? calculateQuorumRequired(params.totalRelays)
    : 1;
  return {
    successCount,
    totalRelays: params.totalRelays,
    quorumRequired,
    metQuorum: successCount >= quorumRequired,
    failures,
  };
};

export const relayReliabilityInternals = {
  toRelayHealthScore,
  buildRelaySelectionDecision,
  calculateQuorumRequired,
  evaluatePublishQuorum,
};

const getPreferredOpenRelayUrls = (urls: ReadonlyArray<string>): ReadonlyArray<string> => {
  const openUrls = urls.filter((url) => {
    const socket = socketsByUrl[url];
    return !!socket && socket.readyState === WebSocket.OPEN;
  });
  return buildRelaySelectionDecision(openUrls).orderedUrls;
};

const notifyListeners = (): void => {
  if (notifyScheduled) {
    return;
  }
  notifyScheduled = true;
  queueMicrotask(() => {
    notifyScheduled = false;
    listeners.forEach((listener: () => void) => listener());
  });
};

const notifyMessageListeners = (params: Readonly<{ url: string; message: string }>): void => {
  messageListeners.forEach((listener: MessageListener) => listener(params));
};

const recomputeSnapshot = (): void => {
  const urls: ReadonlyArray<string> = relayUrlsKey ? relayUrlsKey.split("|") : [];
  const transientUrls = Array.from(transientRelayUrls);
  const allUrls = [...urls, ...transientUrls];

  // Get health metrics for all relays (permanent + transient)
  const healthMetrics: RelayHealthMetrics[] = [];
  allUrls.forEach(url => {
    const metrics = relayHealthMonitor.getMetrics(url);
    if (metrics) {
      healthMetrics.push(metrics);
    }
  });

  cachedSnapshot = {
    connections: allUrls.map(url => statusByUrl[url] || { url, status: "connecting", updatedAtUnixMs: 0 } as RelayConnection),
    healthMetrics
  };
};

const getStateSnapshot = (): RelayPoolState => {
  return cachedSnapshot;
};

const subscribe = (listener: () => void): Unsubscribe => {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
};

/**
 * Attempt to connect to a relay with health monitoring
 */
const connectToRelay = (url: string): WebSocket | null => {
  // Check circuit breaker before attempting connection
  if (!relayHealthMonitor.canConnect(url)) {
    console.log(`Circuit breaker preventing connection to ${url}`);
    return null;
  }

  // Record connection attempt
  relayHealthMonitor.recordConnectionAttempt(url);

  const socket: WebSocket = createRelayWebSocket(url);

  // Track connection start time for latency measurement
  const connectionStartTime = Date.now();

  socket.addEventListener("open", () => {
    // Record successful connection
    relayHealthMonitor.recordConnectionSuccess(url);

    // Measure connection latency
    const latency = Date.now() - connectionStartTime;
    relayHealthMonitor.recordLatency(url, latency);

    // Update status
    statusByUrl = upsertConnection(statusByUrl, createNextConnection({ url, status: "open" }));
    recomputeSnapshot();
    notifyListeners();

    console.log(`Connected to relay ${url} (latency: ${latency}ms)`);
  });

  socket.addEventListener("error", () => {
    const errorMessage = "WebSocket error";

    // Record connection failure
    relayHealthMonitor.recordConnectionFailure(url, errorMessage);

    // Update status
    statusByUrl = upsertConnection(statusByUrl, createNextConnection({
      url,
      status: "error",
      errorMessage
    }));
    recomputeSnapshot();
    notifyListeners();

    console.warn(`Relay connection failed ${url}:`, errorMessage);

    // Schedule retry with exponential backoff
    scheduleReconnect(url);

    queueMicrotask(() => activateFallbackIfOffline());
  });

  socket.addEventListener("close", () => {
    // Record disconnection
    relayHealthMonitor.recordDisconnection(url);

    // Update status
    statusByUrl = upsertConnection(statusByUrl, createNextConnection({ url, status: "closed" }));
    recomputeSnapshot();
    notifyListeners();

    console.log(`Relay closed ${url}`);

    // Schedule retry with exponential backoff
    scheduleReconnect(url);

    queueMicrotask(() => activateFallbackIfOffline());
  });

  socket.addEventListener("message", (evt: MessageEvent) => {
    if (typeof evt.data !== "string") {
      return;
    }

    // Intercept OK messages for internal resolvers
    try {
      const parsed = JSON.parse(evt.data);
      if (Array.isArray(parsed) && parsed[0] === "OK") {
        const eventId = parsed[1];
        const ok = parsed[2];
        const message = parsed[3] || "";
        const resolverKey = `${url}:${eventId}`;
        const pending = pendingOkResolvers.get(resolverKey);

        if (pending) {
          clearTimeout(pending.timer);
          pendingOkResolvers.delete(resolverKey);

          const latency = Date.now() - pending.startTime;
          relayHealthMonitor.recordLatency(url, latency);

          pending.resolve({
            success: ok,
            relayUrl: url,
            error: ok ? undefined : message,
            latency
          });
        }
      }
    } catch {
      // Ignore parsing errors
    }

    notifyMessageListeners({ url, message: evt.data });
  });

  return socket;
};

/**
 * Schedule reconnection with exponential backoff
 * Implements Requirements 4.2, 4.3
 */
const scheduleReconnect = (url: string): void => {
  // Avoid reconnect thrash under relay flaps.
  const existingTimer = retryTimers.get(url);
  if (existingTimer && isReliabilityCoreEnabled()) {
    incrementReliabilityMetric("relay_reconnect_suppressed");
    logWithRateLimit("debug", "relay.reconnect_suppressed", [`Relay reconnect already scheduled for ${url}, suppressing duplicate.`], {
      windowMs: 15_000,
      maxPerWindow: 2,
      summaryEverySuppressed: 20,
    });
    return;
  }
  if (existingTimer) {
    clearTimeout(existingTimer);
  }

  // Check if we can reconnect (circuit breaker check)
  if (!relayHealthMonitor.canConnect(url)) {
    const metrics = relayHealthMonitor.getMetrics(url);
    if (metrics?.nextRetryAt) {
      const delay = metrics.nextRetryAt.getTime() - Date.now();
      if (delay > 0) {
        logWithRateLimit("info", "relay.reconnect_scheduled", [`Scheduling reconnect to ${url} in ${Math.round(delay / 1000)}s`], {
          windowMs: 10_000,
          maxPerWindow: 3,
        });
        const timer = setTimeout(() => {
          retryTimers.delete(url);
          attemptReconnect(url);
        }, delay);
        retryTimers.set(url, timer);
      }
    }
    return;
  }

  // Get backoff delay from health monitor
  const metrics = relayHealthMonitor.getMetrics(url);
  const baseDelay = metrics?.backoffDelay || 1000;
  const jitterFactor = isReliabilityCoreEnabled()
    ? ((Math.random() * 2 * RECONNECT_JITTER_FACTOR) - RECONNECT_JITTER_FACTOR)
    : 0;
  const delay = Math.max(200, Math.floor(baseDelay * (1 + jitterFactor)));

  logWithRateLimit("info", "relay.reconnect_scheduled", [`Scheduling reconnect to ${url} in ${Math.round(delay / 1000)}s`], {
    windowMs: 10_000,
    maxPerWindow: 3,
  });

  const timer = setTimeout(() => {
    retryTimers.delete(url);
    attemptReconnect(url);
  }, delay);

  retryTimers.set(url, timer);
};

/**
 * Attempt to reconnect to a relay
 */
const attemptReconnect = (url: string): void => {
  // Check if relay is still in our list or transient list
  const urls = relayUrlsKey ? relayUrlsKey.split("|") : [];
  if (!urls.includes(url) && !transientRelayUrls.has(url)) {
  logWithRateLimit("debug", "relay.reconnect_skip_not_in_list", [`Relay ${url} no longer in list, skipping reconnect`], {
    windowMs: 10_000,
    maxPerWindow: 2,
  });
    return;
  }

  // Check if already connected
  const existingSocket = socketsByUrl[url];
  if (existingSocket && (existingSocket.readyState === WebSocket.OPEN || existingSocket.readyState === WebSocket.CONNECTING)) {
    logWithRateLimit("debug", "relay.reconnect_skip_already_connected", [`Relay ${url} already connected, skipping reconnect`], {
      windowMs: 10_000,
      maxPerWindow: 2,
    });
    return;
  }

  logWithRateLimit("info", "relay.reconnect_attempt", [`Attempting to reconnect to ${url}`], {
    windowMs: 10_000,
    maxPerWindow: 3,
  });

  // Close existing socket if any
  if (existingSocket) {
    try {
      existingSocket.close();
    } catch (error) {
      console.error(`Error closing socket for ${url}:`, error);
    }
  }

  // Attempt new connection
  const newSocket = connectToRelay(url);
  if (newSocket) {
    socketsByUrl = { ...socketsByUrl, [url]: newSocket };
  }
};

/**
 * Set relay URLs and manage connections
 */
const setRelayUrls = (urls: ReadonlyArray<string>): void => {
  const nextKey: string = urls.join("|");
  if (nextKey === relayUrlsKey) {
    return;
  }

  relayUrlsKey = nextKey;
  const existingSockets: SocketByUrl = socketsByUrl;
  const nextSockets: Record<string, WebSocket> = {};

  urls.forEach((url: string) => {
    // Initialize health monitoring for new relays
    relayHealthMonitor.initializeRelay(url);

    const existing: WebSocket | undefined = existingSockets[url];
    if (existing && (existing.readyState === WebSocket.OPEN || existing.readyState === WebSocket.CONNECTING)) {
      nextSockets[url] = existing;
      return;
    }

    // Attempt to connect
    const socket = connectToRelay(url);
    if (socket) {
      nextSockets[url] = socket;
    }
  });

  // Close sockets for removed relays
  Object.entries(existingSockets).forEach(([url, socket]: [string, WebSocket]) => {
    if (!nextSockets[url] && (socket.readyState === WebSocket.OPEN || socket.readyState === WebSocket.CONNECTING)) {
      socket.close();

      // Clear retry timer
      const timer = retryTimers.get(url);
      if (timer) {
        clearTimeout(timer);
        retryTimers.delete(url);
      }
    }
  });

  socketsByUrl = nextSockets;

  // Re-sync transient relays
  transientRelayUrls.forEach(url => {
    if (!socketsByUrl[url]) {
      const socket = connectToRelay(url);
      if (socket) {
        socketsByUrl = { ...socketsByUrl, [url]: socket };
      }
    }
  });

  recomputeSnapshot();
  notifyListeners();

  setTimeout(() => {
    activateFallbackIfOffline();
  }, 3000);
};

/**
 * Add a transient relay (not persisted but connected while app is running)
 */
const addTransientRelay = (url: string): void => {
  if (relayUrlsKey.split("|").includes(url)) return;
  if (transientRelayUrls.has(url)) return;

  transientRelayUrls.add(url);
  relayHealthMonitor.initializeRelay(url);

  if (!socketsByUrl[url]) {
    const socket = connectToRelay(url);
    if (socket) {
      socketsByUrl = { ...socketsByUrl, [url]: socket };
    }
  }

  recomputeSnapshot();
  notifyListeners();
};

/**
 * Remove a transient relay
 */
const removeTransientRelay = (url: string): void => {
  if (!transientRelayUrls.has(url)) return;

  transientRelayUrls.delete(url);

  const permanentUrls = relayUrlsKey.split("|");
  if (!permanentUrls.includes(url)) {
    const socket = socketsByUrl[url];
    if (socket) {
      socket.close();
      const { [url]: _unused, ...rest } = socketsByUrl;
      void _unused;
      socketsByUrl = rest as SocketByUrl;
    }
  }

  recomputeSnapshot();
  notifyListeners();
};

/**
 * Publish to a specific relay and wait for NIP-20 OK response
 * Implements Requirements 1.4, 1.5, and reliable delivery
 */
const publishToRelay = async (url: string, payload: string): Promise<PublishResult> => {
  if (!socketsByUrl[url]) {
    addTransientRelay(url);
  }

  let socket = socketsByUrl[url];

  if (!socket) {
    return { success: false, relayUrl: url, error: 'Relay not found' };
  }

  if (socket.readyState !== WebSocket.OPEN && socket.readyState !== WebSocket.CONNECTING) {
    attemptReconnect(url);
    socket = socketsByUrl[url];
  }

  if (socket && socket.readyState === WebSocket.CONNECTING) {
    await new Promise<void>(resolve => {
      const timeout = setTimeout(resolve, 2000);
      socket.addEventListener('open', () => {
        clearTimeout(timeout);
        resolve();
      }, { once: true });
    });
  }

  if (!socket || socket.readyState !== WebSocket.OPEN) {
    return { success: false, relayUrl: url, error: 'Relay not connected' };
  }

  // Extract event ID from payload if possible
  let eventId: string | undefined;
  try {
    const parsed = JSON.parse(payload);
    if (Array.isArray(parsed) && parsed[0] === "EVENT") {
      eventId = parsed[1]?.id;
    }
  } catch { }

  if (!eventId) {
    // If not an EVENT payload (e.g. REQ), just send it
    socket.send(payload);
    return { success: true, relayUrl: url };
  }

  const startTime = Date.now();
  const resolverKey = `${url}:${eventId}`;

  // If there's already a resolver for this, it might be a double-publish
  if (pendingOkResolvers.has(resolverKey)) {
    const existing = pendingOkResolvers.get(resolverKey);
    if (existing) clearTimeout(existing.timer);
  }

  return new Promise<PublishResult>((resolve) => {
    const timer = setTimeout(() => {
      pendingOkResolvers.delete(resolverKey);
      const latency = Date.now() - startTime;
      relayHealthMonitor.recordConnectionFailure(url, "Publish timeout (NIP-20 OK not received)");
      resolve({
        success: false,
        relayUrl: url,
        error: "Timeout waiting for OK response",
        latency
      });
    }, DEFAULT_PUBLISH_TIMEOUT_MS);

    pendingOkResolvers.set(resolverKey, {
      resolve,
      timer,
      startTime
    });

    try {
      socket.send(payload);
    } catch (error) {
      clearTimeout(timer);
      pendingOkResolvers.delete(resolverKey);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      relayHealthMonitor.recordConnectionFailure(url, errorMessage);
      resolve({
        success: false,
        relayUrl: url,
        error: errorMessage
      });
    }
  });
};

/**
 * Standalone publish function for use outside of hooks
 */
export const publishToRelayStandalone = async (url: string, payload: string): Promise<PublishResult> => {
  return publishToRelay(url, payload);
};

/**
 * Standalone multi-publish function for use outside of hooks
 */
export const publishToUrlsStandalone = async (urls: ReadonlyArray<string>, payload: string): Promise<MultiRelayPublishResult> => {
  const normalized = Array.from(new Set(urls.map((url) => url.trim()).filter((url) => url.length > 0)));
  const connected = getPreferredOpenRelayUrls(normalized);

  if (connected.length === 0) {
    // Attempt connecting to them if they are in the list but not connected
    const results = await Promise.all(normalized.map(async (url) => {
      return publishToRelay(url, payload);
    }));
    const quorum = evaluatePublishQuorum({
      results,
      totalRelays: normalized.length,
      reliabilityEnabled: isReliabilityCoreEnabled(),
    });
    return {
      success: quorum.metQuorum,
      successCount: quorum.successCount,
      totalRelays: normalized.length,
      metQuorum: quorum.metQuorum,
      quorumRequired: quorum.quorumRequired,
      results,
      failures: [...quorum.failures],
      overallError: quorum.metQuorum ? undefined : "No relays connected"
    };
  }

  const results = await Promise.all(connected.map((url) => publishToRelay(url, payload)));
  const quorum = evaluatePublishQuorum({
    results,
    totalRelays: normalized.length,
    reliabilityEnabled: isReliabilityCoreEnabled(),
  });
  return {
    success: quorum.metQuorum,
    successCount: quorum.successCount,
    totalRelays: normalized.length,
    metQuorum: quorum.metQuorum,
    quorumRequired: quorum.quorumRequired,
    results,
    failures: [...quorum.failures],
    overallError: quorum.metQuorum ? undefined : (results[0]?.error ?? "Unknown failure")
  };
};

/**
 * Publish to all connected relays and return success if AT LEAST ONE relay accepts
 * Implements Requirements 1.4, 1.5, 4.8
 */
const publishToAll = async (payload: string): Promise<MultiRelayPublishResult> => {
  const urls = relayUrlsKey ? relayUrlsKey.split("|") : [];

  // Get all open relays and sort by adaptive health scoring
  let sortedUrls = getPreferredOpenRelayUrls(urls);

  if (sortedUrls.length === 0) {
    urls.forEach((url) => attemptReconnect(url));
    const reconnected = await waitForConnection(3000);
    if (reconnected) {
      sortedUrls = getPreferredOpenRelayUrls(urls);
    }
  }

  if (sortedUrls.length === 0) {
    return {
      success: false,
      successCount: 0,
      totalRelays: urls.length,
      results: [],
      overallError: 'No relays are currently connected'
    };
  }

  // Publish to all selected relays and wait for their OKs.
  const results = await Promise.all(sortedUrls.map(url => publishToRelay(url, payload)));

  const quorum = evaluatePublishQuorum({
    results,
    totalRelays: sortedUrls.length,
    reliabilityEnabled: isReliabilityCoreEnabled(),
  });
  const success = quorum.metQuorum;

  if (quorum.failures.length > 0 && quorum.successCount > 0) {
    incrementReliabilityMetric("relay_publish_partial");
  }
  if (!success) {
    incrementReliabilityMetric("relay_publish_failed");
  }

  let overallError: string | undefined;
  if (!success) {
    overallError = results.length > 0 ? results[0].error : "Unknown failure";
  }

  return {
    success,
    successCount: quorum.successCount,
    totalRelays: urls.length,
    metQuorum: quorum.metQuorum,
    quorumRequired: quorum.quorumRequired,
    results,
    failures: [...quorum.failures],
    overallError
  };
};

const publishToUrl = async (url: string, payload: string): Promise<PublishResult> => {
  return publishToRelay(url, payload);
};

const publishToUrls = async (urls: ReadonlyArray<string>, payload: string): Promise<MultiRelayPublishResult> => {
  const normalized = Array.from(new Set(urls.map((url) => url.trim()).filter((url) => url.length > 0)));
  let connected = getPreferredOpenRelayUrls(normalized);

  if (connected.length === 0) {
    normalized.forEach((url) => {
      if (!socketsByUrl[url]) {
        addTransientRelay(url);
        return;
      }
      attemptReconnect(url);
    });
    await waitForConnection(3000);
    connected = getPreferredOpenRelayUrls(normalized);
  }

  if (connected.length === 0) {
    return {
      success: false,
      successCount: 0,
      totalRelays: normalized.length,
      results: [],
      overallError: "No scoped relays are currently connected"
    };
  }

  const results = await Promise.all(connected.map((url) => publishToRelay(url, payload)));
  const quorum = evaluatePublishQuorum({
    results,
    totalRelays: connected.length,
    reliabilityEnabled: isReliabilityCoreEnabled(),
  });
  const overallError = quorum.metQuorum ? undefined : (results[0]?.error ?? "Unknown failure");

  return {
    success: quorum.metQuorum,
    successCount: quorum.successCount,
    totalRelays: normalized.length,
    metQuorum: quorum.metQuorum,
    quorumRequired: quorum.quorumRequired,
    results,
    failures: [...quorum.failures],
    overallError
  };
};

/**
 * @deprecated Use broadcastEvent
 */
const sendToOpen = (payload: string): void => {
  void broadcastEvent(payload);
};

/**
 * Modern alias for publishToAll
 */
const broadcastEvent = (payload: string): Promise<MultiRelayPublishResult> => {
  return publishToAll(payload);
};

/**
 * Subscribe to relay messages
 */
const subscribeToMessages = (handler: MessageListener): Unsubscribe => {
  messageListeners.add(handler);
  return () => {
    messageListeners.delete(handler);
  };
};

/**
 * Get relay health metrics
 */
const getRelayHealth = (url: string): RelayHealthMetrics | undefined => {
  return relayHealthMonitor.getMetrics(url);
};

/**
 * Check if can connect to relay (circuit breaker check)
 */
const canConnectToRelay = (url: string): boolean => {
  return relayHealthMonitor.canConnect(url);
};

const isConnected = (): boolean => {
  return cachedSnapshot.connections.some(c => c.status === "open");
};

const waitForConnection = (timeoutMs: number): Promise<boolean> => {
  if (isConnected()) return Promise.resolve(true);

  return new Promise((resolve) => {
    let unsubscribe: () => void = () => { };

    const timeoutId = setTimeout(() => {
      unsubscribe();
      resolve(false);
    }, timeoutMs);

    unsubscribe = relayHealthMonitor.subscribe((metricsMap) => {
      const metrics = Array.from(metricsMap.values());
      if (metrics.some(m => m.status === "connected")) {
        clearTimeout(timeoutId);
        unsubscribe();
        resolve(true);
      }
    });
  });
};

const serverSnapshot: RelayPoolState = { connections: [], healthMetrics: [] };

/**
 * Enhanced Relay Pool Hook
 */
export const useEnhancedRelayPool = (urls: ReadonlyArray<string>): EnhancedRelayPoolResult => {
  const urlsKey: string = urls.join("|");
  const urlsFromKey: ReadonlyArray<string> = useMemo(() => (urlsKey ? urlsKey.split("|") : []), [urlsKey]);

  useEffect(() => {
    setRelayUrls(urlsFromKey);
  }, [urlsKey, urlsFromKey]);

  // Subscribe to health monitor changes
  useEffect(() => {
    const unsubscribe = relayHealthMonitor.subscribe(() => {
      recomputeSnapshot();
      notifyListeners();
    });

    return unsubscribe;
  }, []);

  const snapshot: RelayPoolState = useSyncExternalStore(subscribe, getStateSnapshot, () => serverSnapshot);

  return useMemo(() => ({
    connections: snapshot.connections,
    healthMetrics: snapshot.healthMetrics,
    sendToOpen,
    publishToUrl,
    publishToUrls,
    publishToRelay,
    publishToAll,
    broadcastEvent,
    subscribeToMessages,
    subscribe: subscriptionManager.subscribe.bind(subscriptionManager),
    unsubscribe: subscriptionManager.unsubscribe.bind(subscriptionManager),
    getRelayHealth,
    canConnectToRelay,
    addTransientRelay,
    removeTransientRelay,
    isConnected,
    waitForConnection
  }), [snapshot]);
};
