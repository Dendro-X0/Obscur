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

import { useEffect, useMemo, useRef, useSyncExternalStore } from "react";
import type { NostrEvent } from "@dweb/nostr/nostr-event";
import { createRelayWebSocket } from "./create-relay-websocket";
import type { RelayConnection } from "./relay-connection";
import type { RelayConnectionStatus } from "./relay-connection-status";
import { RelayHealthMonitor, relayHealthMonitor, type RelayHealthMetrics } from "./relay-health-monitor";
import { SubscriptionManager } from "./subscription-manager";
import type { NostrFilter } from "../types/nostr-filter";
import { PrivacySettingsService } from "@/app/features/settings/services/privacy-settings-service";
import { logWithRateLimit } from "@/app/shared/log-hygiene";
import { incrementReliabilityMetric } from "@/app/shared/reliability-observability";
import type { RelaySnapshot } from "@dweb/core/security-foundation-contracts";
import { hasNativeRuntime } from "@/app/features/runtime/runtime-capabilities";
import { relayNativeAdapter } from "./relay-native-adapter";
import { reportDevRuntimeIssue } from "@/app/shared/dev-runtime-issue-reporter";
import { relayTransportJournal } from "../services/relay-transport-journal";
import { relayResilienceObservability } from "../services/relay-resilience-observability";

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
  getRelayCircuitState: (url: string) => RelayCircuitState;
  canConnectToRelay: (url: string) => boolean;
  addTransientRelay: (url: string) => void;
  removeTransientRelay: (url: string) => void;
  reconnectRelay: (url: string, options?: RelayReconnectOptions) => void;
  reconnectAll: (options?: RelayReconnectOptions) => void;
  resubscribeAll: () => void;
  recycle: () => Promise<void>;
  isConnected: () => boolean;
  waitForConnection: (timeoutMs: number) => Promise<boolean>;
  waitForScopedConnection: (relayUrls: ReadonlyArray<string>, timeoutMs: number) => Promise<boolean>;
  getWritableRelaySnapshot: (scopedRelayUrls?: ReadonlyArray<string>) => RelaySnapshot;
  getTransportActivitySnapshot: () => RelayTransportActivitySnapshot;
  getActiveSubscriptionCount: () => number;
  dispose: () => void;
}>;

type RelayStatusByUrl = Readonly<Record<string, RelayConnection>>;
type SocketByUrl = Readonly<Record<string, WebSocket>>;
type MessageListener = (params: Readonly<{ url: string; message: string }>) => void;
type Unsubscribe = () => void;
type StaleDisposableSocket = WebSocket & Readonly<{ disposeStaleHandle?: () => void }>;
type RelayReconnectOptions = Readonly<{
  force?: boolean;
}>;
type EnhancedRelayPoolRuntime = Readonly<{
  subscribe: (listener: () => void) => Unsubscribe;
  getStateSnapshot: () => RelayPoolState;
  recomputeSnapshot: () => void;
  setRelayUrls: (urls: ReadonlyArray<string>) => void;
  sendToOpen: (payload: string) => void;
  publishToUrl: (url: string, payload: string) => Promise<PublishResult>;
  publishToUrls: (urls: ReadonlyArray<string>, payload: string) => Promise<MultiRelayPublishResult>;
  publishToRelay: (url: string, payload: string) => Promise<PublishResult>;
  publishToAll: (payload: string) => Promise<MultiRelayPublishResult>;
  broadcastEvent: (payload: string) => Promise<MultiRelayPublishResult>;
  subscribeToMessages: (handler: MessageListener) => Unsubscribe;
  subscribeFilters: (filters: ReadonlyArray<NostrFilter>, onEvent: (event: NostrEvent, url: string) => void) => string;
  unsubscribeFilters: (id: string) => void;
  getRelayHealth: (url: string) => RelayHealthMetrics | undefined;
  getRelayCircuitState: (url: string) => RelayCircuitState;
  canConnectToRelay: (url: string) => boolean;
  addTransientRelay: (url: string) => void;
  removeTransientRelay: (url: string) => void;
  reconnectRelay: (url: string, options?: RelayReconnectOptions) => void;
  reconnectAll: (options?: RelayReconnectOptions) => void;
  resubscribeAll: () => void;
  recycle: () => Promise<void>;
  isConnected: () => boolean;
  waitForConnection: (timeoutMs: number) => Promise<boolean>;
  waitForScopedConnection: (relayUrls: ReadonlyArray<string>, timeoutMs: number) => Promise<boolean>;
  getWritableRelaySnapshot: (scopedRelayUrls?: ReadonlyArray<string>) => RelaySnapshot;
  getTransportActivitySnapshot: () => RelayTransportActivitySnapshot;
  getActiveSubscriptionCount: () => number;
  dispose: () => void;
}>;

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

export type RelayCircuitState = "healthy" | "degraded" | "cooling_down";
export type RelayTransportActivitySnapshot = Readonly<{
  lastInboundMessageAtUnixMs?: number;
  lastInboundEventAtUnixMs?: number;
  lastSuccessfulPublishAtUnixMs?: number;
  writableRelayCount: number;
  subscribableRelayCount: number;
  writeBlockedRelayCount: number;
  coolingDownRelayCount: number;
  fallbackRelayUrls: ReadonlyArray<string>;
  fallbackWritableRelayCount: number;
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

const HARD_RELAY_FAILURE_PATTERN = /(tor proxy connect failed|403 forbidden|cf-mitigated|challenge)/i;
const TRANSIENT_RELAY_FAILURE_PATTERN = /(http error:\s*5\d\d|5\d\d service unavailable|relay status error|cloudflare|connect timed out|timed out after)/i;
const RELAY_NOT_CONNECTED_PATTERN = /\b(not connected|send queue saturated|queue saturated)\b/i;
const MIN_RECONNECT_INTERVAL_MS = 1_500;
const HARD_FAILURE_COOLDOWN_MS = 120_000;
const HARD_FAILURE_OUTAGE_COOLDOWN_MS = 15_000;
const TRANSIENT_FAILURE_COOLDOWN_MS = 20_000;
const TRANSIENT_FAILURE_OUTAGE_COOLDOWN_MS = 7_500;
const RELAY_WRITE_BLOCK_WINDOW_MS = 5_000;
const FALLBACK_DEMOTION_STABLE_WINDOW_MS = 20_000;

type RelayErrorEvent = Event & Readonly<{
  detail?: Readonly<{
    message?: string;
  }>;
}>;

const readRelayErrorMessage = (event: Event): string => {
  const detailMessage = (event as RelayErrorEvent).detail?.message;
  if (typeof detailMessage === "string" && detailMessage.trim().length > 0) {
    return detailMessage.trim();
  }
  const errorEvent = event as ErrorEvent;
  if (typeof errorEvent.message === "string" && errorEvent.message.trim().length > 0) {
    return errorEvent.message.trim();
  }
  return "WebSocket error";
};

const isHardRelayFailure = (errorMessage: string): boolean => HARD_RELAY_FAILURE_PATTERN.test(errorMessage);
const isTransientRelayFailure = (errorMessage: string): boolean => TRANSIENT_RELAY_FAILURE_PATTERN.test(errorMessage);

const moduleResolveHardFailureCooldownMs = (params: Readonly<{ writableRelayCount: number }>): number => {
  return params.writableRelayCount === 0 ? HARD_FAILURE_OUTAGE_COOLDOWN_MS : HARD_FAILURE_COOLDOWN_MS;
};

const moduleResolveTransientFailureCooldownMs = (params: Readonly<{ writableRelayCount: number }>): number => {
  return params.writableRelayCount === 0 ? TRANSIENT_FAILURE_OUTAGE_COOLDOWN_MS : TRANSIENT_FAILURE_COOLDOWN_MS;
};

const moduleCalculateQuorumRequired = (connectedRelayCount: number): number => {
  if (connectedRelayCount <= 0) return 1;
  if (connectedRelayCount >= 4) return 2;
  return 1;
};

const moduleToRelayHealthScore = (url: string): RelayHealthScore => {
  const metrics = relayHealthMonitor.getMetrics(url);
  const connectionStatusScore = 0;
  const successRate = typeof metrics?.successRate === "number"
    ? Math.max(0, Math.min(1, metrics.successRate / 100))
    : 0.5;
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

const moduleClassifyRelayCircuitState = (metrics?: RelayHealthMetrics): RelayCircuitState => {
  if (!metrics) return "degraded";
  if (metrics.circuitBreakerState === "open") return "cooling_down";
  if (metrics.circuitBreakerState === "half-open") return "degraded";
  if (metrics.successRate >= 90 && metrics.status === "connected") return "healthy";
  return "degraded";
};

const moduleBuildRelaySelectionDecision = (urls: ReadonlyArray<string>): RelaySelectionDecision => {
  const scores = urls.map((url) => moduleToRelayHealthScore(url));
  const orderedUrls = [...scores]
    .sort((a, b) => b.score - a.score)
    .map((entry) => entry.url);
  return {
    orderedUrls,
    scores,
  };
};

const moduleEvaluatePublishQuorum = (
  params: Readonly<{
    results: ReadonlyArray<PublishResult>;
    totalRelays: number;
    reliabilityEnabled: boolean;
  }>
): PublishQuorumResult => {
  const successCount = params.results.filter((r) => r.success).length;
  const failures = params.results.filter((r) => !r.success);
  const quorumRequired = params.reliabilityEnabled
    ? moduleCalculateQuorumRequired(params.totalRelays)
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
  toRelayHealthScore: moduleToRelayHealthScore,
  buildRelaySelectionDecision: moduleBuildRelaySelectionDecision,
  calculateQuorumRequired: moduleCalculateQuorumRequired,
  evaluatePublishQuorum: moduleEvaluatePublishQuorum,
  classifyRelayCircuitState: moduleClassifyRelayCircuitState,
  readRelayErrorMessage,
  isHardRelayFailure,
  isTransientRelayFailure,
  resolveHardFailureCooldownMs: moduleResolveHardFailureCooldownMs,
  resolveTransientFailureCooldownMs: moduleResolveTransientFailureCooldownMs,
};

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

export const createEnhancedRelayPoolRuntime = (): EnhancedRelayPoolRuntime => {
let relayUrlsKey: string = "";
let statusByUrl: RelayStatusByUrl = {};
let lastInboundMessageAtUnixMs: number | undefined;
let lastInboundEventAtUnixMs: number | undefined;
let lastSuccessfulPublishAtUnixMs: number | undefined;
const healthMonitor = new RelayHealthMonitor();

const setConnectionStatus = (params: Readonly<{
  url: string;
  status: RelayConnectionStatus;
  errorMessage?: string;
}>): void => {
  const next = createNextConnection(params);
  statusByUrl = upsertConnection(statusByUrl, next);
  relayResilienceObservability.recordRelayConnectionStatus({
    url: params.url,
    status: params.status,
    atUnixMs: next.updatedAtUnixMs,
  });
};

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
  toAdd.forEach((url: string) => addTransientRelay(url, "fallback"));
};
let socketsByUrl: SocketByUrl = {};
const transientRelayUrls: Set<string> = new Set();
const fallbackRelayUrls: Set<string> = new Set();
const listeners: Set<() => void> = new Set();
const messageListeners: Set<MessageListener> = new Set();
let cachedSnapshot: RelayPoolState = { connections: [], healthMetrics: [] };
let notifyScheduled: boolean = false;
let fallbackActivated: boolean = false;
let configuredRelaysHealthySinceUnixMs: number | undefined;
let fallbackDemotionTimer: ReturnType<typeof setTimeout> | null = null;
const relayWriteBlockedUntilByUrl: Map<string, number> = new Map();
type TransientRelaySource = "manual" | "fallback";

const toRelayErrorMessage = (error: unknown): string => (
  error instanceof Error ? error.message : String(error)
);

const reportRelayRuntimeIssue = (params: Readonly<{
  operation: string;
  severity?: "warn" | "error";
  reasonCode?: string;
  message: string;
  retryable?: boolean;
  relayUrl?: string;
  context?: Readonly<Record<string, string | number | boolean | null>>;
  fingerprint?: string;
}>): void => {
  reportDevRuntimeIssue({
    domain: "relay",
    operation: params.operation,
    severity: params.severity ?? "error",
    reasonCode: params.reasonCode,
    message: params.message,
    retryable: params.retryable,
    source: "enhanced-relay-pool",
    context: {
      relayUrl: params.relayUrl ?? null,
      ...(params.context ?? {}),
    },
    fingerprint: params.fingerprint,
  });
};

const isRelayNotConnectedErrorMessage = (errorMessage: string): boolean => (
  RELAY_NOT_CONNECTED_PATTERN.test(errorMessage)
);

const isPromiseLike = (value: unknown): value is PromiseLike<unknown> => (
  typeof value === "object"
  && value !== null
  && "then" in value
  && typeof (value as { then?: unknown }).then === "function"
);

const canAttemptRelayWrite = (url: string): boolean => {
  const blockedUntil = relayWriteBlockedUntilByUrl.get(url);
  if (typeof blockedUntil !== "number") {
    return true;
  }
  if (blockedUntil <= Date.now()) {
    relayWriteBlockedUntilByUrl.delete(url);
    return true;
  }
  return false;
};

const blockRelayWritesTemporarily = (url: string): void => {
  relayWriteBlockedUntilByUrl.set(url, Date.now() + RELAY_WRITE_BLOCK_WINDOW_MS);
};

const getWritableRelayCount = (): number => (
  Object.values(statusByUrl)
    .filter((connection) => connection.status === "open" && canAttemptRelayWrite(connection.url))
    .length
);

const getHardFailureCooldownMs = (): number => (
  moduleResolveHardFailureCooldownMs({ writableRelayCount: getWritableRelayCount() })
);

const getTransientFailureCooldownMs = (): number => (
  moduleResolveTransientFailureCooldownMs({ writableRelayCount: getWritableRelayCount() })
);

const resolveManualCooldownUntilUnixMs = (url: string, nowUnixMs: number): number | undefined => {
  const manualCooldownUntilUnixMs = relayManualCooldownUntilByUrl.get(url);
  if (typeof manualCooldownUntilUnixMs !== "number") {
    return undefined;
  }
  if (manualCooldownUntilUnixMs <= nowUnixMs) {
    relayManualCooldownUntilByUrl.delete(url);
    return undefined;
  }
  if (getWritableRelayCount() > 0) {
    return manualCooldownUntilUnixMs;
  }
  const cappedCooldownUntilUnixMs = nowUnixMs + moduleResolveHardFailureCooldownMs({ writableRelayCount: 0 });
  if (manualCooldownUntilUnixMs > cappedCooldownUntilUnixMs) {
    relayManualCooldownUntilByUrl.set(url, cappedCooldownUntilUnixMs);
    return cappedCooldownUntilUnixMs;
  }
  return manualCooldownUntilUnixMs;
};

const normalizeRelayUrls = (urls: ReadonlyArray<string>): ReadonlyArray<string> => (
  Array.from(new Set(urls.map((url) => url.trim()).filter((url) => url.length > 0)))
);

const getConfiguredRelayUrls = (): ReadonlyArray<string> => (
  relayUrlsKey ? relayUrlsKey.split("|") : []
);

const getWriteBlockedRelayCount = (): number => (
  getConfiguredRelayUrls()
    .filter((url) => statusByUrl[url]?.status === "open" && !canAttemptRelayWrite(url))
    .length
);

const getCoolingDownRelayCount = (): number => {
  const nowUnixMs = Date.now();
  return getConfiguredRelayUrls().filter((url) => {
    const manualCooldownUntil = relayManualCooldownUntilByUrl.get(url);
    const hasManualCooldown = typeof manualCooldownUntil === "number" && manualCooldownUntil > nowUnixMs;
    const metrics = healthMonitor.getMetrics(url);
    const hasCircuitCooldown = metrics?.circuitBreakerState === "open"
      || ((metrics?.nextRetryAt?.getTime() ?? 0) > nowUnixMs && metrics?.status !== "connected");
    return hasManualCooldown || hasCircuitCooldown;
  }).length;
};

const clearFallbackDemotionTimer = (): void => {
  if (!fallbackDemotionTimer) {
    return;
  }
  clearTimeout(fallbackDemotionTimer);
  fallbackDemotionTimer = null;
};

const hasStableConfiguredRelayCoverage = (): boolean => {
  const configuredRelayUrls = getConfiguredRelayUrls();
  if (configuredRelayUrls.length === 0) {
    return false;
  }
  return configuredRelayUrls.every((url) => (
    statusByUrl[url]?.status === "open" && canAttemptRelayWrite(url)
  ));
};

const demoteFallbackRelays = (): void => {
  const configuredRelayUrls = new Set(getConfiguredRelayUrls());
  const fallbackUrls = Array.from(fallbackRelayUrls).filter((url) => (
    transientRelayUrls.has(url) && !configuredRelayUrls.has(url)
  ));
  if (fallbackUrls.length === 0) {
    fallbackRelayUrls.clear();
    fallbackActivated = false;
    return;
  }

  fallbackUrls.forEach((url) => {
    transientRelayUrls.delete(url);
    fallbackRelayUrls.delete(url);
    const socket = socketsByUrl[url];
    if (socket) {
      try {
        socket.close();
      } catch {
        // Ignore close failures during fallback demotion.
      }
      const { [url]: _unused, ...rest } = socketsByUrl;
      void _unused;
      socketsByUrl = rest as SocketByUrl;
    }
    clearRelayCoordinationState(url);
  });
  fallbackActivated = fallbackRelayUrls.size > 0;
  recomputeSnapshot();
  notifyListeners();
};

const scheduleFallbackDemotionIfStable = (): void => {
  if (fallbackRelayUrls.size === 0) {
    configuredRelaysHealthySinceUnixMs = undefined;
    fallbackActivated = false;
    clearFallbackDemotionTimer();
    return;
  }

  if (!hasStableConfiguredRelayCoverage()) {
    configuredRelaysHealthySinceUnixMs = undefined;
    clearFallbackDemotionTimer();
    return;
  }

  const nowUnixMs = Date.now();
  if (typeof configuredRelaysHealthySinceUnixMs !== "number") {
    configuredRelaysHealthySinceUnixMs = nowUnixMs;
  }
  const healthyDurationMs = nowUnixMs - configuredRelaysHealthySinceUnixMs;
  if (healthyDurationMs >= FALLBACK_DEMOTION_STABLE_WINDOW_MS) {
    configuredRelaysHealthySinceUnixMs = undefined;
    clearFallbackDemotionTimer();
    demoteFallbackRelays();
    return;
  }
  if (!fallbackDemotionTimer) {
    fallbackDemotionTimer = setTimeout(() => {
      fallbackDemotionTimer = null;
      scheduleFallbackDemotionIfStable();
    }, FALLBACK_DEMOTION_STABLE_WINDOW_MS - healthyDurationMs);
  }
};

const sendRelayPayload = async (url: string, socket: WebSocket, payload: string): Promise<void> => {
  const sendResult = (socket as unknown as Readonly<{ send: (data: string) => unknown }>).send(payload);
  if (isPromiseLike(sendResult)) {
    await sendResult;
  }
  if (socket.readyState !== WebSocket.OPEN) {
    blockRelayWritesTemporarily(url);
    throw new Error("Relay not connected");
  }
};

const handleRelayWriteFailure = (params: Readonly<{
  url: string;
  error: unknown;
  operation: "send_to_open" | "resubscribe_relay";
}>): void => {
  const errorMessage = toRelayErrorMessage(params.error);
  if (isRelayNotConnectedErrorMessage(errorMessage)) {
    setConnectionStatus({
      url: params.url,
      status: "error",
      errorMessage,
    });
    recomputeSnapshot();
    notifyListeners();
    queueMicrotask(() => attemptReconnect(params.url));
    return;
  }
  logWithRateLimit("warn", `${params.operation}.send_failed`, [`Failed ${params.operation} relay write ${params.url}: ${errorMessage}`], {
    windowMs: 10_000,
    maxPerWindow: 2,
    summaryEverySuppressed: 10,
  });
  reportRelayRuntimeIssue({
    operation: params.operation,
    severity: "warn",
    reasonCode: "send_failed",
    message: `Failed ${params.operation} relay write ${params.url}: ${errorMessage}`,
    retryable: true,
    relayUrl: params.url,
    fingerprint: ["relay", params.operation, params.url, errorMessage].join("|"),
  });
};

// Initialize Subscription Manager
const subscriptionManager = new SubscriptionManager(
  (payload: string) => {
    const urls = relayUrlsKey ? relayUrlsKey.split("|") : [];
    const transientUrls = Array.from(transientRelayUrls);
    const allUrls = Array.from(new Set([...urls, ...transientUrls]));
    const preferredUrls = getPreferredOpenRelayUrls(allUrls);
    preferredUrls.forEach((url) => {
      const socket = socketsByUrl[url];
      if (socket && socket.readyState === WebSocket.OPEN && canAttemptRelayWrite(url)) {
        void sendRelayPayload(url, socket, payload).catch((error) => {
          handleRelayWriteFailure({
            url,
            error,
            operation: "send_to_open",
          });
        });
      }
    });
  },
  (handler) => {
    messageListeners.add(handler);
    return () => messageListeners.delete(handler);
  }
);

const resubscribeActiveSubscriptionsForRelay = (url: string): void => {
  const socket = socketsByUrl[url];
  if (!socket || socket.readyState !== WebSocket.OPEN || !canAttemptRelayWrite(url)) {
    relayTransportJournal.markSubscriptionReplayAttempt({
      reasonCode: "relay_open",
      detail: `url=${url};active=0;reason=relay_not_writable`,
    });
    relayTransportJournal.markSubscriptionReplayResult({
      reasonCode: "relay_open",
      result: "skipped",
      detail: `url=${url};reason=relay_not_writable`,
    });
    return;
  }
  const activeSubscriptions = subscriptionManager.getActiveSubscriptions();
  relayTransportJournal.markSubscriptionReplayAttempt({
    reasonCode: "relay_open",
    detail: `url=${url};active=${activeSubscriptions.length}`,
  });
  if (activeSubscriptions.length === 0) {
    relayTransportJournal.markSubscriptionReplayResult({
      reasonCode: "relay_open",
      result: "skipped",
      detail: `url=${url};reason=no_active_subscriptions`,
    });
    return;
  }

  let sentCount = 0;
  let skippedEmptyFilterCount = 0;
  let failureCount = 0;
  const writeOperations: Promise<void>[] = [];

  activeSubscriptions.forEach((subscription) => {
    if (subscription.filters.length === 0) {
      skippedEmptyFilterCount += 1;
      return;
    }
    const payload = JSON.stringify(["REQ", subscription.id, ...subscription.filters]);
    sentCount += 1;
    writeOperations.push(
      sendRelayPayload(url, socket, payload).catch((error) => {
        failureCount += 1;
        handleRelayWriteFailure({
          url,
          error,
          operation: "resubscribe_relay",
        });
      })
    );
  });

  if (sentCount === 0) {
    relayTransportJournal.markSubscriptionReplayResult({
      reasonCode: "relay_open",
      result: "skipped",
      detail: `url=${url};reason=no_non_empty_filters`,
    });
    return;
  }

  void Promise.allSettled(writeOperations).then(() => {
    const succeededCount = Math.max(0, sentCount - failureCount);
    relayTransportJournal.markSubscriptionReplayResult({
      reasonCode: "relay_open",
      result: failureCount === 0
        ? (skippedEmptyFilterCount > 0 ? "partial" : "ok")
        : (succeededCount > 0 ? "partial" : "failed"),
      detail: `url=${url};sent=${sentCount};failed=${failureCount};skipped_empty=${skippedEmptyFilterCount}`,
    });
  });
};

// Retry timers for reconnection
const retryTimers: Map<string, NodeJS.Timeout> = new Map();
const connectionGenerationByUrl: Map<string, number> = new Map();
const reconnectAttemptInProgress: Set<string> = new Set();
const lastReconnectAttemptAtUnixMs: Map<string, number> = new Map();
const relayManualCooldownUntilByUrl: Map<string, number> = new Map();

/**
 * Pending OK response resolvers
 * Key: relayUrl:eventId
 */
const pendingOkResolvers: Map<string, {
  resolve: (result: PublishResult) => void;
  timer: NodeJS.Timeout;
  startTime: number;
}> = new Map();

const DEFAULT_PUBLISH_TIMEOUT_MS = 12000;
const RECONNECT_JITTER_FACTOR = 0.2;

const isReliabilityCoreEnabled = (): boolean => {
  try {
    return PrivacySettingsService.getSettings().reliabilityCoreV087;
  } catch {
    return true;
  }
};

const beginConnectionGeneration = (url: string): number => {
  const nextGeneration = (connectionGenerationByUrl.get(url) ?? 0) + 1;
  connectionGenerationByUrl.set(url, nextGeneration);
  return nextGeneration;
};

const isCurrentConnectionGeneration = (url: string, generation: number): boolean => {
  return connectionGenerationByUrl.get(url) === generation;
};

const clearRelayCoordinationState = (url: string): void => {
  const timer = retryTimers.get(url);
  if (timer) {
    clearTimeout(timer);
    retryTimers.delete(url);
  }
  connectionGenerationByUrl.delete(url);
  reconnectAttemptInProgress.delete(url);
  lastReconnectAttemptAtUnixMs.delete(url);
  relayManualCooldownUntilByUrl.delete(url);
  relayWriteBlockedUntilByUrl.delete(url);
};

const disposeSocketForStaleGeneration = (
  socket: WebSocket,
  preferNonDestructiveDispose: boolean,
): void => {
  const candidate = socket as StaleDisposableSocket;
  if (preferNonDestructiveDispose && typeof candidate.disposeStaleHandle === "function") {
    candidate.disposeStaleHandle();
    return;
  }
  try {
    socket.close();
  } catch {
    // Ignore stale socket close failures.
  }
};

const calculateQuorumRequired = (connectedRelayCount: number): number => {
  if (connectedRelayCount <= 0) return 1;
  if (connectedRelayCount >= 4) return 2;
  return 1;
};

const toRelayHealthScore = (url: string): RelayHealthScore => {
  const metrics = healthMonitor.getMetrics(url);
  const connection = statusByUrl[url];
  const connectionStatusScore = connection?.status === "open" ? 1 : connection?.status === "connecting" ? 0.5 : 0;
  const successRate = typeof metrics?.successRate === "number"
    ? Math.max(0, Math.min(1, metrics.successRate / 100))
    : 0.5;
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

const classifyRelayCircuitState = (metrics?: RelayHealthMetrics): RelayCircuitState => {
  if (!metrics) return "degraded";
  if (metrics.circuitBreakerState === "open") return "cooling_down";
  if (metrics.circuitBreakerState === "half-open") return "degraded";
  if (metrics.successRate >= 90 && metrics.status === "connected") return "healthy";
  return "degraded";
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

async function resolvePublishResultsProgressively(params: Readonly<{
  relayUrls: ReadonlyArray<string>;
  publishToRelay: (url: string) => Promise<PublishResult>;
  reliabilityEnabled: boolean;
  outwardTotalRelays: number;
}>): Promise<MultiRelayPublishResult> {
  if (params.relayUrls.length === 0) {
    return {
      success: false,
      successCount: 0,
      totalRelays: params.outwardTotalRelays,
      results: [],
      overallError: "No relays are currently connected",
    };
  }

  const results: PublishResult[] = [];
  const relayCount = params.relayUrls.length;
  const quorumRequired = params.reliabilityEnabled
    ? calculateQuorumRequired(relayCount)
    : 1;

  return new Promise<MultiRelayPublishResult>((resolve) => {
    let settled = 0;
    let resolved = false;

    const finalize = (): void => {
      if (resolved) {
        return;
      }
      resolved = true;
      const quorum = evaluatePublishQuorum({
        results,
        totalRelays: relayCount,
        reliabilityEnabled: params.reliabilityEnabled,
      });
      const overallError = quorum.metQuorum ? undefined : (results.find((entry) => !entry.success)?.error ?? "Unknown failure");
      resolve({
        success: quorum.metQuorum,
        successCount: quorum.successCount,
        totalRelays: params.outwardTotalRelays,
        metQuorum: quorum.metQuorum,
        quorumRequired,
        results: [...results],
        failures: [...quorum.failures],
        overallError,
      });
    };

    params.relayUrls.forEach((url) => {
      void params.publishToRelay(url)
        .then((result) => {
          results.push(result);
          settled += 1;
          const successCount = results.filter((entry) => entry.success).length;
          const remaining = relayCount - settled;
          if (successCount >= quorumRequired || successCount + remaining < quorumRequired || settled === relayCount) {
            finalize();
          }
        })
        .catch((error) => {
          results.push({
            success: false,
            relayUrl: url,
            error: error instanceof Error ? error.message : String(error),
          });
          settled += 1;
          const successCount = results.filter((entry) => entry.success).length;
          const remaining = relayCount - settled;
          if (successCount >= quorumRequired || successCount + remaining < quorumRequired || settled === relayCount) {
            finalize();
          }
        });
    });
  });
}

const getPreferredOpenRelayUrls = (urls: ReadonlyArray<string>): ReadonlyArray<string> => {
  const openUrls = urls.filter((url) => {
    const socket = socketsByUrl[url];
    return !!socket
      && socket.readyState === WebSocket.OPEN
      && statusByUrl[url]?.status === "open"
      && canAttemptRelayWrite(url);
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
  lastInboundMessageAtUnixMs = Date.now();
  messageListeners.forEach((listener: MessageListener) => listener(params));
};

const recomputeSnapshot = (): void => {
  const urls: ReadonlyArray<string> = relayUrlsKey ? relayUrlsKey.split("|") : [];
  const transientUrls = Array.from(transientRelayUrls);
  const allUrls = [...urls, ...transientUrls];

  // Get health metrics for all relays (permanent + transient)
  const healthMetrics: RelayHealthMetrics[] = [];
  allUrls.forEach(url => {
    const metrics = healthMonitor.getMetrics(url);
    if (metrics) {
      healthMetrics.push(metrics);
    }
  });

  cachedSnapshot = {
    connections: allUrls.map(url => statusByUrl[url] || { url, status: "connecting", updatedAtUnixMs: 0 } as RelayConnection),
    healthMetrics
  };
  scheduleFallbackDemotionIfStable();
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
const connectToRelay = (url: string, options?: RelayReconnectOptions): WebSocket | null => {
  const forceReconnect = options?.force === true;
  const nowUnixMs = Date.now();
  if (forceReconnect) {
    relayManualCooldownUntilByUrl.delete(url);
    relayWriteBlockedUntilByUrl.delete(url);
  } else {
    const manualCooldownUntilUnixMs = resolveManualCooldownUntilUnixMs(url, nowUnixMs);
    if (typeof manualCooldownUntilUnixMs === "number") {
      scheduleReconnect(url);
      return null;
    }
  }

  // Check circuit breaker before attempting connection
  if (!forceReconnect && !healthMonitor.canConnect(url)) {
    logWithRateLimit("debug", "relay.connect_blocked_by_circuit_breaker", [`Circuit breaker preventing connection to ${url}`], {
      windowMs: 10_000,
      maxPerWindow: 2,
    });
    return null;
  }

  // Record connection attempt
  healthMonitor.recordConnectionAttempt(url);
  setConnectionStatus({ url, status: "connecting" });
  recomputeSnapshot();
  notifyListeners();

  const socket: WebSocket = createRelayWebSocket(url);
  const generation = beginConnectionGeneration(url);
  let terminalHandled = false;

  // Track connection start time for latency measurement
  const connectionStartTime = Date.now();

  socket.addEventListener("open", () => {
    if (!isCurrentConnectionGeneration(url, generation)) {
      const trackedSocket = socketsByUrl[url];
      // Native relay handles share one underlying URL-scoped transport.
      // If another socket is already tracked for this URL, stale handles must
      // dispose listener state without issuing a disconnect for the live URL.
      const hasReplacementSocket = !!trackedSocket && trackedSocket !== socket;
      disposeSocketForStaleGeneration(socket, hasReplacementSocket);
      return;
    }
    // Record successful connection
    healthMonitor.recordConnectionSuccess(url);
    relayManualCooldownUntilByUrl.delete(url);
    relayWriteBlockedUntilByUrl.delete(url);

    // Measure connection latency
    const latency = Date.now() - connectionStartTime;
    healthMonitor.recordLatency(url, latency);

    if (socketsByUrl[url] !== socket) {
      socketsByUrl = { ...socketsByUrl, [url]: socket };
    }

    // Update status
    setConnectionStatus({ url, status: "open" });
    recomputeSnapshot();
    notifyListeners();

    logWithRateLimit("info", "relay.connected", [`Connected to relay ${url} (latency: ${latency}ms)`], {
      windowMs: 10_000,
      maxPerWindow: 4,
      summaryEverySuppressed: 20,
    });
    // Re-subscribe only on the relay that just opened to avoid all-relay REQ bursts
    // during reconnect storms, especially on native IPC transports.
    resubscribeActiveSubscriptionsForRelay(url);
  });

  socket.addEventListener("error", (event: Event) => {
    if (!isCurrentConnectionGeneration(url, generation)) {
      return;
    }
    if (terminalHandled) {
      return;
    }
    terminalHandled = true;
    const errorMessage = readRelayErrorMessage(event);
    if (isRelayNotConnectedErrorMessage(errorMessage)) {
      blockRelayWritesTemporarily(url);
    }

    if (socketsByUrl[url] === socket) {
      const { [url]: _unused, ...rest } = socketsByUrl;
      void _unused;
      socketsByUrl = rest as SocketByUrl;
    }

    // Record connection failure
    healthMonitor.recordConnectionFailure(url, errorMessage);

    // Update status
    setConnectionStatus({
      url,
      status: "error",
      errorMessage
    });
    recomputeSnapshot();
    notifyListeners();

    if (isHardRelayFailure(errorMessage)) {
      const cooldownMs = getHardFailureCooldownMs();
      relayManualCooldownUntilByUrl.set(url, Date.now() + cooldownMs);
      incrementReliabilityMetric("relay_hard_failure_cooldown");
      logWithRateLimit("warn", "relay.hard_failure_cooldown", [`Relay ${url} entered cooldown after hard failure: ${errorMessage}`], {
        windowMs: 30_000,
        maxPerWindow: 2,
        summaryEverySuppressed: 10,
      });
      reportRelayRuntimeIssue({
        operation: "connect",
        severity: "error",
        reasonCode: "hard_failure_cooldown",
        message: `Relay ${url} entered cooldown after hard failure: ${errorMessage}`,
        retryable: true,
        relayUrl: url,
        context: {
          cooldownMs,
        },
        fingerprint: ["relay", "connect_hard_failure", url, errorMessage].join("|"),
      });
    } else if (isTransientRelayFailure(errorMessage)) {
      const cooldownMs = getTransientFailureCooldownMs();
      relayManualCooldownUntilByUrl.set(url, Date.now() + cooldownMs);
      incrementReliabilityMetric("relay_cooling_down");
      logWithRateLimit("warn", "relay.transient_failure_cooldown", [`Relay ${url} entered cooldown after transient failure: ${errorMessage}`], {
        windowMs: 20_000,
        maxPerWindow: 3,
        summaryEverySuppressed: 10,
      });
      reportRelayRuntimeIssue({
        operation: "connect",
        severity: "warn",
        reasonCode: "transient_failure_cooldown",
        message: `Relay ${url} entered cooldown after transient failure: ${errorMessage}`,
        retryable: true,
        relayUrl: url,
        context: {
          cooldownMs,
        },
        fingerprint: ["relay", "connect_transient_failure", url, errorMessage].join("|"),
      });
    } else {
      logWithRateLimit("warn", "relay.connection_failed", [`Relay connection failed ${url}: ${errorMessage}`], {
        windowMs: 10_000,
        maxPerWindow: 3,
        summaryEverySuppressed: 10,
      });
      reportRelayRuntimeIssue({
        operation: "connect",
        severity: "error",
        reasonCode: "connection_failed",
        message: `Relay connection failed ${url}: ${errorMessage}`,
        retryable: true,
        relayUrl: url,
        fingerprint: ["relay", "connect_failed", url, errorMessage].join("|"),
      });
    }

    // Schedule retry with exponential backoff
    scheduleReconnect(url);

    queueMicrotask(() => activateFallbackIfOffline());
  });

  socket.addEventListener("close", () => {
    if (!isCurrentConnectionGeneration(url, generation)) {
      return;
    }
    if (terminalHandled) {
      return;
    }
    terminalHandled = true;

    if (socketsByUrl[url] === socket) {
      const { [url]: _unused, ...rest } = socketsByUrl;
      void _unused;
      socketsByUrl = rest as SocketByUrl;
    }

    // Record disconnection
    healthMonitor.recordDisconnection(url);

    // Update status
    setConnectionStatus({ url, status: "closed" });
    recomputeSnapshot();
    notifyListeners();

    logWithRateLimit("info", "relay.closed", [`Relay closed ${url}`], {
      windowMs: 10_000,
      maxPerWindow: 3,
      summaryEverySuppressed: 10,
    });

    // Schedule retry with exponential backoff
    scheduleReconnect(url);

    queueMicrotask(() => activateFallbackIfOffline());
  });

  socket.addEventListener("message", (evt: MessageEvent) => {
    if (!isCurrentConnectionGeneration(url, generation)) {
      return;
    }
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
          healthMonitor.recordLatency(url, latency);

          pending.resolve({
            success: ok,
            relayUrl: url,
            error: ok ? undefined : message,
            latency
          });
          if (ok) {
            lastSuccessfulPublishAtUnixMs = Date.now();
          }
        }
      } else if (Array.isArray(parsed) && parsed[0] === "EVENT") {
        lastInboundEventAtUnixMs = Date.now();
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
  const nowUnixMs = Date.now();
  const manualCooldownUntilUnixMs = resolveManualCooldownUntilUnixMs(url, nowUnixMs);
  if (typeof manualCooldownUntilUnixMs === "number") {
    const delay = manualCooldownUntilUnixMs - nowUnixMs;
    const existingTimer = retryTimers.get(url);
    if (existingTimer) {
      clearTimeout(existingTimer);
      retryTimers.delete(url);
    }
    logWithRateLimit("info", "relay.reconnect_manual_cooldown", [`Scheduling reconnect to ${url} in ${Math.round(delay / 1000)}s (manual cooldown)`], {
      windowMs: 20_000,
      maxPerWindow: 2,
      summaryEverySuppressed: 10,
    });
    const timer = setTimeout(() => {
      retryTimers.delete(url);
      attemptReconnect(url);
    }, delay);
    retryTimers.set(url, timer);
    return;
  }

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
  if (!healthMonitor.canConnect(url)) {
    const metrics = healthMonitor.getMetrics(url);
    if (metrics?.circuitBreakerState === "open") {
      incrementReliabilityMetric("relay_cooling_down");
    }
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
  const metrics = healthMonitor.getMetrics(url);
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
const attemptReconnect = (url: string, options?: RelayReconnectOptions): void => {
  const forceReconnect = options?.force === true;
  if (reconnectAttemptInProgress.has(url)) {
    logWithRateLimit("debug", "relay.reconnect_skip_in_progress", [`Relay ${url} reconnect already in progress, skipping.`], {
      windowMs: 10_000,
      maxPerWindow: 2,
    });
    return;
  }

  const nowUnixMs = Date.now();
  const lastAttemptAtUnixMs = lastReconnectAttemptAtUnixMs.get(url);
  if (
    !forceReconnect
    && isReliabilityCoreEnabled()
    && typeof lastAttemptAtUnixMs === "number"
    && (nowUnixMs - lastAttemptAtUnixMs) < MIN_RECONNECT_INTERVAL_MS
  ) {
    const remainingMs = MIN_RECONNECT_INTERVAL_MS - (nowUnixMs - lastAttemptAtUnixMs);
    logWithRateLimit("debug", "relay.reconnect_skip_min_interval", [`Relay ${url} reconnect suppressed (${remainingMs}ms remaining).`], {
      windowMs: 10_000,
      maxPerWindow: 2,
    });
    return;
  }

  reconnectAttemptInProgress.add(url);
  lastReconnectAttemptAtUnixMs.set(url, nowUnixMs);
  try {
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
    if (
      existingSocket
      && (
        existingSocket.readyState === WebSocket.OPEN
        || (!forceReconnect && existingSocket.readyState === WebSocket.CONNECTING)
      )
    ) {
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
      if (socketsByUrl[url] === existingSocket) {
        const { [url]: _unused, ...rest } = socketsByUrl;
        void _unused;
        socketsByUrl = rest as SocketByUrl;
      }
      try {
        existingSocket.close();
      } catch (error) {
        logWithRateLimit("warn", "relay.reconnect_close_error", [`Error closing socket for ${url}:`, error], {
          windowMs: 10_000,
          maxPerWindow: 2,
        });
      }
    }

    setConnectionStatus({ url, status: "connecting" });
    recomputeSnapshot();
    notifyListeners();

    // Attempt new connection
    const newSocket = connectToRelay(url, options);
    if (newSocket) {
      socketsByUrl = { ...socketsByUrl, [url]: newSocket };
    }
  } finally {
    reconnectAttemptInProgress.delete(url);
  }
};

/**
 * Set relay URLs and manage connections
 */
const setRelayUrls = (urls: ReadonlyArray<string>): void => {
  const previousConfiguredUrls = relayUrlsKey ? relayUrlsKey.split("|") : [];
  const nextKey: string = urls.join("|");
  if (nextKey === relayUrlsKey) {
    return;
  }

  relayUrlsKey = nextKey;
  const existingSockets: SocketByUrl = socketsByUrl;
  const nextSockets: Record<string, WebSocket> = {};

  urls.forEach((url: string) => {
    // Initialize health monitoring for new relays
    healthMonitor.initializeRelay(url);

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
    }
    if (!nextSockets[url] && !transientRelayUrls.has(url)) {
      clearRelayCoordinationState(url);
    }
  });
  previousConfiguredUrls.forEach((url) => {
    if (!urls.includes(url) && !transientRelayUrls.has(url)) {
      clearRelayCoordinationState(url);
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
const addTransientRelay = (url: string, source: TransientRelaySource = "manual"): void => {
  if (relayUrlsKey.split("|").includes(url)) return;
  if (transientRelayUrls.has(url)) {
    if (source === "fallback") {
      fallbackRelayUrls.add(url);
      fallbackActivated = true;
    }
    return;
  }

  transientRelayUrls.add(url);
  if (source === "fallback") {
    fallbackRelayUrls.add(url);
    fallbackActivated = true;
  }
  healthMonitor.initializeRelay(url);

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
  fallbackRelayUrls.delete(url);
  fallbackActivated = fallbackRelayUrls.size > 0;

  const permanentUrls = relayUrlsKey.split("|");
  if (!permanentUrls.includes(url)) {
    const socket = socketsByUrl[url];
    if (socket) {
      socket.close();
      const { [url]: _unused, ...rest } = socketsByUrl;
      void _unused;
      socketsByUrl = rest as SocketByUrl;
    }
    clearRelayCoordinationState(url);
  }

  recomputeSnapshot();
  notifyListeners();
};

const reconnectRelay = (url: string, options?: RelayReconnectOptions): void => {
  attemptReconnect(url, options);
};

const reconnectAll = (options?: RelayReconnectOptions): void => {
  const urls = Array.from(new Set([
    ...(relayUrlsKey ? relayUrlsKey.split("|") : []),
    ...Array.from(transientRelayUrls),
  ]));
  urls.forEach((url) => attemptReconnect(url, options));
};

const resubscribeAll = (): void => {
  subscriptionManager.resubscribeAll("manual");
};

const recycle = async (): Promise<void> => {
  if (hasNativeRuntime()) {
    try {
      await relayNativeAdapter.recycleRelays();
      setTimeout(() => {
        subscriptionManager.resubscribeAll("recycle");
      }, 750);
      return;
    } catch {
      // Fall back to JS-managed recycle below.
    }
  }

  const urls = Array.from(new Set([
    ...(relayUrlsKey ? relayUrlsKey.split("|") : []),
    ...Array.from(transientRelayUrls),
  ]));

  retryTimers.forEach((timer) => clearTimeout(timer));
  retryTimers.clear();
  reconnectAttemptInProgress.clear();
  lastReconnectAttemptAtUnixMs.clear();
  relayManualCooldownUntilByUrl.clear();
  relayWriteBlockedUntilByUrl.clear();
  connectionGenerationByUrl.clear();

  Object.values(socketsByUrl).forEach((socket) => {
    try {
      socket.close();
    } catch {
      // Ignore close failures during recycle.
    }
  });

  socketsByUrl = {};
  const recycledStatusByUrl: Record<string, RelayConnection> = {};
  urls.forEach((url) => {
    const next = createNextConnection({ url, status: "closed" });
    recycledStatusByUrl[url] = next;
    relayResilienceObservability.recordRelayConnectionStatus({
      url,
      status: "closed",
      atUnixMs: next.updatedAtUnixMs,
    });
  });
  statusByUrl = recycledStatusByUrl;
  recomputeSnapshot();
  notifyListeners();

  urls.forEach((url) => {
    const socket = connectToRelay(url, { force: true });
    if (socket) {
      socketsByUrl = { ...socketsByUrl, [url]: socket };
    }
  });

  recomputeSnapshot();
  notifyListeners();

  setTimeout(() => {
    subscriptionManager.resubscribeAll("recycle");
  }, 750);
};

/**
 * Publish to a specific relay and wait for NIP-20 OK response
 * Implements Requirements 1.4, 1.5, and reliable delivery
 */
const publishToRelay = async (url: string, payload: string): Promise<PublishResult> => {
  if (!canAttemptRelayWrite(url)) {
    return { success: false, relayUrl: url, error: "Relay temporarily unavailable" };
  }

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

  if (!socket || socket.readyState !== WebSocket.OPEN || statusByUrl[url]?.status !== "open") {
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
    // If not an EVENT payload (e.g. REQ), just send it.
    try {
      await sendRelayPayload(url, socket, payload);
      return { success: true, relayUrl: url };
    } catch (error) {
      const errorMessage = toRelayErrorMessage(error);
      if (isRelayNotConnectedErrorMessage(errorMessage)) {
        blockRelayWritesTemporarily(url);
      }
      healthMonitor.recordConnectionFailure(url, errorMessage);
      return {
        success: false,
        relayUrl: url,
        error: errorMessage,
      };
    }
  }

  const startTime = Date.now();
  const resolverKey = `${url}:${eventId}`;

  // If there's already a resolver for this, it might be a double-publish
  if (pendingOkResolvers.has(resolverKey)) {
    const existing = pendingOkResolvers.get(resolverKey);
    if (existing) {
      clearTimeout(existing.timer);
      pendingOkResolvers.delete(resolverKey);
    }
  }

  return new Promise<PublishResult>((resolve) => {
    let settled = false;

    const handleSocketError = (event: Event): void => {
      const errorMessage = readRelayErrorMessage(event);
      if (isRelayNotConnectedErrorMessage(errorMessage)) {
        blockRelayWritesTemporarily(url);
      }
      healthMonitor.recordConnectionFailure(url, errorMessage);
      finalize({
        success: false,
        relayUrl: url,
        error: errorMessage || "Relay send failed before OK response",
      });
    };

    const handleSocketClose = (): void => {
      blockRelayWritesTemporarily(url);
      healthMonitor.recordConnectionFailure(url, "Relay closed before OK response");
      finalize({
        success: false,
        relayUrl: url,
        error: "Relay closed before OK response",
      });
    };

    const finalize = (result: PublishResult): void => {
      if (settled) {
        return;
      }
      settled = true;
      socket.removeEventListener("error", handleSocketError);
      socket.removeEventListener("close", handleSocketClose);
      pendingOkResolvers.delete(resolverKey);
      resolve(result);
    };

    const timer = setTimeout(() => {
      const latency = Date.now() - startTime;
      healthMonitor.recordConnectionFailure(url, "Publish timeout (NIP-20 OK not received)");
      finalize({
        success: false,
        relayUrl: url,
        error: "Timeout waiting for OK response",
        latency
      });
    }, DEFAULT_PUBLISH_TIMEOUT_MS);

    pendingOkResolvers.set(resolverKey, {
      resolve: (result) => {
        clearTimeout(timer);
        finalize(result);
      },
      timer,
      startTime
    });
    socket.addEventListener("error", handleSocketError, { once: true });
    socket.addEventListener("close", handleSocketClose, { once: true });

    void sendRelayPayload(url, socket, payload).catch((error) => {
      const errorMessage = toRelayErrorMessage(error);
      if (isRelayNotConnectedErrorMessage(errorMessage)) {
        blockRelayWritesTemporarily(url);
      }
      healthMonitor.recordConnectionFailure(url, errorMessage);
      clearTimeout(timer);
      finalize({
        success: false,
        relayUrl: url,
        error: errorMessage,
      });
    });
  });
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
    reportRelayRuntimeIssue({
      operation: "publish_to_all",
      severity: "error",
      reasonCode: "no_connected_relays",
      message: "No relays are currently connected for publish_to_all.",
      retryable: true,
      context: {
        configuredRelayCount: urls.length,
      },
      fingerprint: ["relay", "publish_to_all", "no_connected_relays", String(urls.length)].join("|"),
    });
    return {
      success: false,
      successCount: 0,
      totalRelays: urls.length,
      results: [],
      overallError: 'No relays are currently connected'
    };
  }

  const publishResult = await resolvePublishResultsProgressively({
    relayUrls: sortedUrls,
    publishToRelay: (url) => publishToRelay(url, payload),
    reliabilityEnabled: isReliabilityCoreEnabled(),
    outwardTotalRelays: urls.length,
  });

  if ((publishResult.failures?.length ?? 0) > 0 && publishResult.successCount > 0) {
    incrementReliabilityMetric("relay_publish_partial");
  }
  if (!publishResult.success) {
    incrementReliabilityMetric("relay_publish_failed");
    reportRelayRuntimeIssue({
      operation: "publish_to_all",
      severity: "error",
      reasonCode: publishResult.overallError ? "publish_failed" : "publish_quorum_not_met",
      message: publishResult.overallError || "Relay publish_to_all failed without quorum evidence.",
      retryable: true,
      context: {
        successCount: publishResult.successCount,
        totalRelays: publishResult.totalRelays,
        failureCount: publishResult.failures?.length ?? 0,
      },
      fingerprint: [
        "relay",
        "publish_to_all_failed",
        publishResult.successCount,
        publishResult.totalRelays,
        publishResult.overallError || "none",
      ].join("|"),
    });
  }

  return publishResult;
};

const publishToUrl = async (url: string, payload: string): Promise<PublishResult> => {
  return publishToRelay(url, payload);
};

const publishToUrls = async (urls: ReadonlyArray<string>, payload: string): Promise<MultiRelayPublishResult> => {
  const normalized = normalizeRelayUrls(urls);
  let connected = getPreferredOpenRelayUrls(normalized);

  if (connected.length === 0) {
    normalized.forEach((url) => {
      if (!socketsByUrl[url]) {
        addTransientRelay(url);
        return;
      }
      attemptReconnect(url);
    });
    await waitForScopedConnection(normalized, 3000);
    connected = getPreferredOpenRelayUrls(normalized);
  }

  if (connected.length === 0) {
    relayResilienceObservability.recordScopedPublishReadiness({
      blockedByReadiness: true,
    });
    reportRelayRuntimeIssue({
      operation: "publish_to_urls",
      severity: "error",
      reasonCode: "no_connected_scoped_relays",
      message: "No scoped relays are currently connected for publish_to_urls.",
      retryable: true,
      context: {
        scopedRelayCount: normalized.length,
      },
      fingerprint: ["relay", "publish_to_urls", "no_connected_scoped_relays", String(normalized.length)].join("|"),
    });
    return {
      success: false,
      successCount: 0,
      totalRelays: normalized.length,
      results: [],
      overallError: "No scoped relays are currently connected"
    };
  }

  relayResilienceObservability.recordScopedPublishReadiness({
    blockedByReadiness: false,
  });

  return resolvePublishResultsProgressively({
    relayUrls: connected,
    publishToRelay: (url) => publishToRelay(url, payload),
    reliabilityEnabled: isReliabilityCoreEnabled(),
    outwardTotalRelays: normalized.length,
  });
};

/**
 * @deprecated Use broadcastEvent
 */
const sendToOpen = (payload: string): void => {
  const urls = relayUrlsKey ? relayUrlsKey.split("|") : [];
  const transientUrls = Array.from(transientRelayUrls);
  const allUrls = Array.from(new Set([...urls, ...transientUrls]));
  allUrls.forEach((url) => {
    const socket = socketsByUrl[url];
    if (socket && socket.readyState === WebSocket.OPEN && canAttemptRelayWrite(url)) {
      void sendRelayPayload(url, socket, payload).catch((error) => {
        const errorMessage = toRelayErrorMessage(error);
        if (isRelayNotConnectedErrorMessage(errorMessage)) {
          setConnectionStatus({
            url,
            status: "error",
            errorMessage,
          });
          recomputeSnapshot();
          notifyListeners();
          queueMicrotask(() => attemptReconnect(url));
          return;
        }
        logWithRateLimit("warn", "relay.send_failed", [`Failed to send payload to relay ${url}: ${errorMessage}`], {
          windowMs: 10_000,
          maxPerWindow: 2,
          summaryEverySuppressed: 10,
        });
        reportRelayRuntimeIssue({
          operation: "send_to_open",
          severity: "warn",
          reasonCode: "send_failed",
          message: `Failed to send payload to relay ${url}: ${errorMessage}`,
          retryable: true,
          relayUrl: url,
          fingerprint: ["relay", "send_failed", url, errorMessage].join("|"),
        });
      });
    }
  });
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
  return healthMonitor.getMetrics(url);
};

const getRelayCircuitState = (url: string): RelayCircuitState => {
  return classifyRelayCircuitState(healthMonitor.getMetrics(url));
};

/**
 * Check if can connect to relay (circuit breaker check)
 */
const canConnectToRelay = (url: string): boolean => {
  return healthMonitor.canConnect(url);
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

    unsubscribe = healthMonitor.subscribe((metricsMap) => {
      const metrics = Array.from(metricsMap.values());
      if (metrics.some(m => m.status === "connected")) {
        clearTimeout(timeoutId);
        unsubscribe();
        resolve(true);
      }
    });
  });
};

const waitForScopedConnection = (relayUrls: ReadonlyArray<string>, timeoutMs: number): Promise<boolean> => {
  const normalized = normalizeRelayUrls(relayUrls);
  if (normalized.length === 0) {
    return waitForConnection(timeoutMs);
  }

  const hasScopedConnection = (): boolean => (
    getWritableRelaySnapshot(normalized).writableRelayUrls.length > 0
  );

  if (hasScopedConnection()) {
    return Promise.resolve(true);
  }

  return new Promise((resolve) => {
    let healthUnsubscribe: () => void = () => { };
    let settled = false;
    const finalize = (value: boolean): void => {
      if (settled) {
        return;
      }
      settled = true;
      clearTimeout(timeoutId);
      clearInterval(pollId);
      healthUnsubscribe();
      resolve(value);
    };
    const timeoutId = setTimeout(() => finalize(false), timeoutMs);
    const pollId = setInterval(() => {
      if (hasScopedConnection()) {
        finalize(true);
      }
    }, 250);

    healthUnsubscribe = healthMonitor.subscribe(() => {
      if (hasScopedConnection()) {
        finalize(true);
      }
    });
  });
};

const getWritableRelaySnapshot = (scopedRelayUrls?: ReadonlyArray<string>): RelaySnapshot => {
  const configuredRelayUrls = Array.from(new Set(
    (scopedRelayUrls ?? (relayUrlsKey ? relayUrlsKey.split("|") : []))
      .map((url) => url.trim())
      .filter((url) => url.length > 0)
  ));
  const writableRelayUrls = Array.from(new Set(
    Object.values(statusByUrl)
      .filter((connection) => connection.status === "open" && canAttemptRelayWrite(connection.url))
      .map((connection) => connection.url)
      .filter((url) => configuredRelayUrls.length === 0 || configuredRelayUrls.includes(url))
  ));
  return {
    atUnixMs: Date.now(),
    configuredRelayUrls,
    writableRelayUrls,
    totalRelayCount: configuredRelayUrls.length,
    openRelayCount: writableRelayUrls.length,
    relayCircuitStates: Object.fromEntries(
      configuredRelayUrls.map((url) => [url, classifyRelayCircuitState(healthMonitor.getMetrics(url))])
    ),
  };
};

const getTransportActivitySnapshot = (): RelayTransportActivitySnapshot => {
  const writableSnapshot = getWritableRelaySnapshot();
  const fallbackWritableRelayCount = Array.from(fallbackRelayUrls).filter((url) => {
    const connection = statusByUrl[url];
    return connection?.status === "open" && canAttemptRelayWrite(url);
  }).length;
  return {
    lastInboundMessageAtUnixMs,
    lastInboundEventAtUnixMs,
    lastSuccessfulPublishAtUnixMs,
    writableRelayCount: writableSnapshot.writableRelayUrls.length,
    subscribableRelayCount: cachedSnapshot.connections.filter((connection) => connection.status === "open").length,
    writeBlockedRelayCount: getWriteBlockedRelayCount(),
    coolingDownRelayCount: getCoolingDownRelayCount(),
    fallbackRelayUrls: Array.from(fallbackRelayUrls),
    fallbackWritableRelayCount,
  };
};

const shutdownRelayPool = (): void => {
  clearFallbackDemotionTimer();
  retryTimers.forEach((timer) => clearTimeout(timer));
  retryTimers.clear();
  reconnectAttemptInProgress.clear();
  lastReconnectAttemptAtUnixMs.clear();
  relayManualCooldownUntilByUrl.clear();
  relayWriteBlockedUntilByUrl.clear();
  connectionGenerationByUrl.clear();

  pendingOkResolvers.forEach(({ timer }) => clearTimeout(timer));
  pendingOkResolvers.clear();

  Object.values(socketsByUrl).forEach((socket) => {
    try {
      socket.close();
    } catch {
      // Ignore close failures during teardown.
    }
  });

  socketsByUrl = {};
  statusByUrl = {};
  relayUrlsKey = "";
  lastInboundMessageAtUnixMs = undefined;
  lastInboundEventAtUnixMs = undefined;
  lastSuccessfulPublishAtUnixMs = undefined;
  fallbackActivated = false;
  configuredRelaysHealthySinceUnixMs = undefined;
  transientRelayUrls.clear();
  fallbackRelayUrls.clear();
  subscriptionManager.dispose();
  healthMonitor.clearAllMetrics();
  cachedSnapshot = { connections: [], healthMetrics: [] };
  notifyListeners();
};

  return {
    subscribe,
    getStateSnapshot,
    recomputeSnapshot: () => {
      recomputeSnapshot();
      notifyListeners();
    },
    setRelayUrls,
    sendToOpen,
    publishToUrl,
    publishToUrls,
    publishToRelay,
    publishToAll,
    broadcastEvent,
    subscribeToMessages,
    subscribeFilters: subscriptionManager.subscribe.bind(subscriptionManager),
    unsubscribeFilters: subscriptionManager.unsubscribe.bind(subscriptionManager),
    getRelayHealth,
    getRelayCircuitState,
    canConnectToRelay,
    addTransientRelay,
    removeTransientRelay,
    reconnectRelay,
    reconnectAll,
    resubscribeAll,
    recycle,
    isConnected,
    waitForConnection,
    waitForScopedConnection,
    getWritableRelaySnapshot,
    getTransportActivitySnapshot,
    getActiveSubscriptionCount: () => subscriptionManager.getActiveSubscriptions().length,
    dispose: shutdownRelayPool,
  };
};

const serverSnapshot: RelayPoolState = { connections: [], healthMetrics: [] };

/**
 * Enhanced Relay Pool Hook
 */
export const useEnhancedRelayPool = (urls: ReadonlyArray<string>): EnhancedRelayPoolResult => {
  const runtimeRef = useRef<EnhancedRelayPoolRuntime | null>(null);
  if (!runtimeRef.current) {
    runtimeRef.current = createEnhancedRelayPoolRuntime();
  }
  const runtime = runtimeRef.current;
  const urlsKey: string = urls.join("|");
  const urlsFromKey: ReadonlyArray<string> = useMemo(() => (urlsKey ? urlsKey.split("|") : []), [urlsKey]);

  useEffect(() => {
    runtime.setRelayUrls(urlsFromKey);
  }, [runtime, urlsKey, urlsFromKey]);

  useEffect(() => {
    return () => {
      runtime.dispose();
    };
  }, [runtime]);

  const snapshot: RelayPoolState = useSyncExternalStore(runtime.subscribe, runtime.getStateSnapshot, () => serverSnapshot);

  return useMemo(() => ({
    connections: snapshot.connections,
    healthMetrics: snapshot.healthMetrics,
    sendToOpen: runtime.sendToOpen,
    publishToUrl: runtime.publishToUrl,
    publishToUrls: runtime.publishToUrls,
    publishToRelay: runtime.publishToRelay,
    publishToAll: runtime.publishToAll,
    broadcastEvent: runtime.broadcastEvent,
    subscribeToMessages: runtime.subscribeToMessages,
    subscribe: runtime.subscribeFilters,
    unsubscribe: runtime.unsubscribeFilters,
    getRelayHealth: runtime.getRelayHealth,
    getRelayCircuitState: runtime.getRelayCircuitState,
    canConnectToRelay: runtime.canConnectToRelay,
    addTransientRelay: runtime.addTransientRelay,
    removeTransientRelay: runtime.removeTransientRelay,
    reconnectRelay: runtime.reconnectRelay,
    reconnectAll: runtime.reconnectAll,
    resubscribeAll: runtime.resubscribeAll,
    recycle: runtime.recycle,
    isConnected: runtime.isConnected,
    waitForConnection: runtime.waitForConnection,
    waitForScopedConnection: runtime.waitForScopedConnection,
    getWritableRelaySnapshot: runtime.getWritableRelaySnapshot,
    getTransportActivitySnapshot: runtime.getTransportActivitySnapshot,
    getActiveSubscriptionCount: runtime.getActiveSubscriptionCount,
    dispose: runtime.dispose,
  }), [runtime, snapshot]);
};

const withStandaloneRuntime = async <T,>(
  relayUrls: ReadonlyArray<string>,
  action: (runtime: EnhancedRelayPoolRuntime) => Promise<T>,
): Promise<T> => {
  const runtime = createEnhancedRelayPoolRuntime();
  runtime.setRelayUrls(relayUrls);
  try {
    return await action(runtime);
  } finally {
    runtime.dispose();
  }
};

/**
 * Standalone publish function for use outside of hooks.
 * This uses a short-lived runtime so non-React callers do not depend on hidden
 * module-level relay state.
 */
export const publishToRelayStandalone = async (url: string, payload: string): Promise<PublishResult> => {
  return withStandaloneRuntime([url], (runtime) => runtime.publishToRelay(url, payload));
};

/**
 * Standalone multi-publish function for use outside of hooks.
 * Target relay ownership stays explicit at the call site.
 */
export const publishToUrlsStandalone = async (
  urls: ReadonlyArray<string>,
  payload: string,
): Promise<MultiRelayPublishResult> => {
  const normalized = Array.from(new Set(urls.map((url) => url.trim()).filter((url) => url.length > 0)));
  return withStandaloneRuntime(normalized, (runtime) => runtime.publishToUrls(normalized, payload));
};


