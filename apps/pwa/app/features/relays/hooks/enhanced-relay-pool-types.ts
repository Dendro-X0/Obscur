/**
 * Enhanced relay pool contracts — PWA adapter surface until transport-engine owns the pool.
 */
import type { NostrEvent } from "@dweb/nostr/nostr-event";
import type { RelaySnapshot } from "@dweb/core/security-foundation-contracts";

import type { RelayConnection } from "./relay-connection";
import type { RelayHealthMetrics } from "./relay-health-monitor";
import type { NostrFilter } from "../types/nostr-filter";

export type RelayReconnectOptions = Readonly<{
  force?: boolean;
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

/** Result of publishing to a single relay */
export interface PublishResult {
  success: boolean;
  relayUrl: string;
  error?: string;
  latency?: number;
}

/** Result of publishing to multiple relays */
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
  /** Conduit Mesh aggregate readiness when pool hook is mesh-backed. */
  meshReadiness?: "healthy" | "degraded" | "recovering" | "offline";
  configuredConduitCount?: number;
  /** Probe-backed endpoints that can publish in the active mesh snapshot. */
  publishReadyRelayUrls?: ReadonlyArray<string>;
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
