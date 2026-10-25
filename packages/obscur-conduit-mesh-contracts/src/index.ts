/**
 * Prefer `@obscur/conduit-mesh-contracts/<module>` subpaths.
 * Root keeps envelope + conduit descriptor types only (hot path).
 */
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
  ConduitDialect,
  ConduitNetworkPolicy,
  ConduitTrustTier,
  ConduitCapability,
  ConduitHealth,
  ConduitUnderlay,
  SshTunnelParams,
  ConduitDescriptor,
  ConduitRuntimeState,
} from "./conduit";
