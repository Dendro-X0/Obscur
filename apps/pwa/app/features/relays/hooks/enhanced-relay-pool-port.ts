"use client";

/**
 * Relay pool port — product UI uses conduit mesh; standalone publish stays explicit.
 * RUST-4c: no legacy product orchestrator.
 */

export { useConduitMeshRelayPool as useLegacyEnhancedRelayPool } from "./use-conduit-mesh-relay-pool";

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
