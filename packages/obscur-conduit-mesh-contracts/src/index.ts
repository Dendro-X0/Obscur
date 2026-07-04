export type {
  MeshMessageScope,
  MeshEvidenceClass,
  MeshDeploymentTier,
  MeshAudience,
  MeshAudienceDm,
  MeshAudienceWorkspace,
  MeshAudienceControl,
  MeshEnvelope,
  MeshInterest,
} from "./envelope";

export type {
  MeshEvidenceKind,
  MeshEvidenceRecord,
  MeshPublishOutcome,
  MeshEvidenceHandler,
  MeshInboundEnvelopeHandler,
  MeshUnsubscribe,
} from "./evidence";
export { satisfiesEvidenceClass } from "./evidence";

export type {
  ConduitDialect,
  ConduitNetworkPolicy,
  ConduitTrustTier,
  ConduitCapability,
  ConduitHealth,
  ConduitDescriptor,
  ConduitRuntimeState,
} from "./conduit";

export type {
  MeshReadiness,
  MeshPhase,
  MeshRecoveryReasonCode,
  MeshScopeReadiness,
  MeshSnapshot,
} from "./mesh-snapshot";

export type { ConduitDriverPort, MeshPort } from "./mesh-port";

export {
  CUSTOM_CONDUIT_HTTP_V1,
  CUSTOM_CONDUIT_HTTP_PATHS,
} from "./custom-conduit-contract";
export type {
  CustomConduitPublishBody,
  CustomConduitPublishResponse,
  CustomConduitPullItem,
  CustomConduitPullResponse,
  CustomConduitHealthResponse,
} from "./custom-conduit-contract";

export {
  NOSTR_WS_CONDUIT_WIRE_V1,
  OBSCUR_MESH_NOSTR_EVENT_KIND,
  buildNostrWsEventFromMeshEnvelope,
  buildNostrWsWirePayload,
  deriveHeadlessNostrEventId,
  deriveHeadlessNostrPubkey,
  extractEventIdFromNostrWirePayload,
  parseNostrWsOkMessage,
} from "./nostr-ws-wire-contract";
export type {
  NostrWsWireEvent,
  NostrWsOkParseResult,
} from "./nostr-ws-wire-contract";

export { resolveCandidateConduits } from "./resolve-candidate-conduits";
export { validateMeshEnvelope } from "./validate-envelope";
export type { MeshEnvelopeValidationResult } from "./validate-envelope";

export {
  DEFAULT_MESH_TOR_STATE,
  deriveEffectiveNetworkPolicy,
  filterConduitsByTorPolicy,
  isConduitBlockedByTorPolicy,
  isTorPolicyConduit,
  resolveTorBlockedFailureReason,
  sortConduitsByTorPreference,
} from "./tor-policy";
export type {
  FilterConduitsByTorPolicyResult,
  MeshTorRuntimeState,
} from "./tor-policy";
