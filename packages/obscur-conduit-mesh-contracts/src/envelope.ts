import type { EngineScope } from "@obscur/engine-contracts";

/** Kernel emission scope — what class of communication this envelope belongs to. */
export type MeshMessageScope = "dm" | "workspace" | "control";

/** Minimum durable proof required before the mesh marks an outbound envelope satisfied. */
export type MeshEvidenceClass =
  | "fire_and_forget"
  | "at_least_one_conduit_accept"
  | "recipient_ack"
  | "coordination_head";

/** Derived from user conduit configuration — not a runtime mandate. */
export type MeshDeploymentTier = "minimal_infra" | "private_trust" | "experimental";

export type MeshAudienceDm = Readonly<{
  kind: "dm";
  recipientPublicKeyHex: string;
}>;

export type MeshAudienceWorkspace = Readonly<{
  kind: "workspace";
  communityId: string;
}>;

export type MeshAudienceControl = Readonly<{
  kind: "control";
  coordinationTopic: string;
}>;

export type MeshAudience =
  | MeshAudienceDm
  | MeshAudienceWorkspace
  | MeshAudienceControl;

/**
 * Routing metadata + opaque ciphertext.
 * Conduits must treat `ciphertext` as an opaque blob — decryption is kernel-only.
 */
export type MeshEnvelope = Readonly<{
  envelopeId: string;
  correlationId?: string;
  scope: EngineScope;
  messageScope: MeshMessageScope;
  audience: MeshAudience;
  ciphertext: Uint8Array;
  evidenceClass: MeshEvidenceClass;
  /** If non-empty, only these conduit ids may be attempted. */
  allowedConduitIds?: ReadonlyArray<string>;
  /** Conduit ids that must never be used for this envelope. */
  forbiddenConduitIds?: ReadonlyArray<string>;
  deploymentTier?: MeshDeploymentTier;
  createdAtUnixMs: number;
  ttlMs?: number;
  priority?: "low" | "normal" | "high";
  retryBudget?: number;
}>;

export type MeshInterest = Readonly<{
  scope: EngineScope;
  messageScope: MeshMessageScope;
  audience: MeshAudience;
}>;
