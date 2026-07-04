"use client";

/** Legacy WebSocket relay pool — features import this port until transport-engine owns the pool runtime. */
export {
  useLegacyEnhancedRelayPool,
} from "./enhanced-relay-pool-legacy";

export {
  publishToRelayStandalone,
  publishToUrlsStandalone,
} from "./relay-standalone-publish-port";

export type {
  EnhancedRelayPoolResult,
  MultiRelayPublishResult,
  PublishQuorumResult,
  PublishResult,
  RelayCircuitState,
  RelayHealthScore,
  RelayReconnectOptions,
  RelaySelectionDecision,
  RelayTransportActivitySnapshot,
} from "./enhanced-relay-pool-types";
