/**
 * Test / harness helpers — do not import from production client bundles.
 */
export {
  createMockConduitDriver,
  resetMockConduitDriverCounters,
} from "./mock-conduit-driver";
export type {
  MockConduitDriverOptions,
  MockConduitPublishBehavior,
} from "./mock-conduit-driver";

export { resetCustomHttpConduitDriverCounters } from "./custom-http-conduit-driver";
export { resetCoordinationHttpConduitDriverCounters } from "./coordination-http-conduit-driver";
export { resetNostrWsConduitDriverCounters } from "./nostr-ws-conduit-driver";

export { runW53SmokeParityHarness, publishEnvelopeToAllCandidates } from "./w53-smoke-parity-harness";
export type { W53QuorumPublishResult, W53SmokeParityReport } from "./w53-smoke-parity-harness";

export { createInMemoryConduitFetchRouter } from "./in-memory-conduit-fetch-router";
export type { InMemoryConduitFetchRouterOptions } from "./in-memory-conduit-fetch-router";

export { createInMemoryNostrWsWire } from "./nostr-ws-wire-port";
export type {
  NostrWsWirePort,
  NostrWsWirePublishResult,
  InMemoryNostrWsWireOptions,
} from "./nostr-ws-wire-port";

export { createLiveNostrWsWire } from "./create-live-nostr-ws-wire";
export type { CreateLiveNostrWsWireParams } from "./create-live-nostr-ws-wire";

export {
  createInMemoryNostrWsClient,
  resetInMemoryNostrWsClientCounters,
} from "./create-in-memory-nostr-ws-client";
export type { InMemoryNostrWsClientOptions } from "./create-in-memory-nostr-ws-client";

export {
  createMeshHttpGatewayStore,
  createMeshHttpGatewayFetch,
  handleMeshHttpGatewayRequest,
  handleMeshHttpGatewayStreamRequest,
} from "./mesh-http-gateway-handler";
export type {
  MeshHttpGatewayRequest,
  MeshHttpGatewayResponse,
  MeshHttpGatewayStore,
} from "./mesh-http-gateway-handler";
