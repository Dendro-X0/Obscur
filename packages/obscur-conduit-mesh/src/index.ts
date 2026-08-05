/**
 * Production Conduit Mesh surface.
 * Test-only helpers → `@obscur/conduit-mesh/testing`
 * HTTP gateway server → `@obscur/conduit-mesh/gateway`
 */
export { createConduitMesh } from "./create-conduit-mesh";
export type { ConduitMesh, CreateConduitMeshParams, CreateConduitMeshDriverContext } from "./create-conduit-mesh";

export { createEvidenceLedger } from "./evidence-ledger";
export type { EvidenceLedger } from "./evidence-ledger";

export { buildMeshSnapshot } from "./build-mesh-snapshot";
export type { BuildMeshSnapshotParams } from "./build-mesh-snapshot";

export { classifyMeshReadiness } from "./classify-mesh-readiness";

export { createMockConduitDriver } from "./mock-conduit-driver";
export type {
  MockConduitDriverOptions,
  MockConduitPublishBehavior,
} from "./mock-conduit-driver";

export { mapTorStatusSnapshotToMeshTorState } from "./map-tor-status-snapshot";
export { applyTorPolicyToConduitRuntime, applyTorPolicyToAllRuntimes } from "./apply-tor-policy-to-runtime";
export {
  resolveConduitHttpTransportMode,
  isOnionMeshEndpoint,
} from "./resolve-conduit-http-transport";
export type { ConduitHttpTransportMode } from "./resolve-conduit-http-transport";
export { createRoutedConduitMeshFetch } from "./create-routed-conduit-mesh-fetch";
export type {
  ConduitSocksFetch,
  CreateRoutedConduitMeshFetchParams,
} from "./create-routed-conduit-mesh-fetch";

export { mapMeshSnapshotToRelayActivitySnapshot } from "./map-mesh-snapshot-to-relay-activity";
export type { MeshRelayActivitySnapshot } from "./map-mesh-snapshot-to-relay-activity";

export {
  createConduitMeshRelayPoolRuntime,
} from "./conduit-mesh-relay-pool-runtime";
export type {
  ConduitMeshRelayPoolRuntime,
  ConduitMeshRelayPoolMultiPublishResult,
  CreateConduitMeshRelayPoolRuntimeParams,
} from "./conduit-mesh-relay-pool-runtime";

export { createCustomHttpConduitDriver } from "./custom-http-conduit-driver";
export type { CustomHttpConduitDriverOptions } from "./custom-http-conduit-driver";

export { createTeamRelayConduitDriver, resolveTeamRelayHttpBaseUrl } from "./team-relay-conduit-driver";
export type { TeamRelayConduitDriverOptions } from "./team-relay-conduit-driver";

export {
  createCoordinationHttpConduitDriver,
} from "./coordination-http-conduit-driver";
export type { CoordinationHttpConduitDriverOptions } from "./coordination-http-conduit-driver";

export { createConduitDriverFromDescriptor } from "./create-conduit-driver";
export type { CreateConduitDriverOptions } from "./create-conduit-driver";

export { createNostrWsConduitDriver } from "./nostr-ws-conduit-driver";
export type { NostrWsConduitDriverOptions } from "./nostr-ws-conduit-driver";

export type { ConduitMeshFetch } from "./conduit-http-utils";
export { encodeCiphertextBase64, decodeCiphertextBase64, normalizeConduitBaseUrl } from "./conduit-http-utils";

export { resolveRelayPoolConduitDescriptors, prioritizeLocalDevWarmupUrls } from "./resolve-relay-pool-conduit-descriptors";

export type {
  ConduitMeshNostrConnectionSnapshot,
  ConduitMeshNostrEvent,
  ConduitMeshNostrFilter,
  ConduitMeshNostrSubscriptionPort,
} from "./conduit-mesh-nostr-subscription-port";

export type {
  NostrWsWirePort,
  NostrWsWirePublishResult,
} from "./nostr-ws-wire-port";

export {
  pullHttpMeshEnvelopes,
  longPollHttpMeshEnvelopes,
  openSseHttpMeshEnvelopeSession,
  pullItemMatchesInterests,
  pullItemToMeshEnvelope,
  isCustomHttpPullCapable,
  CUSTOM_HTTP_PULL_CONTRACT,
} from "./custom-http-pull";
export type {
  PullHttpMeshEnvelopesParams,
  LongPollHttpMeshEnvelopesParams,
  OpenSseHttpMeshEnvelopeSessionParams,
} from "./custom-http-pull";
