import type { EngineScope } from "@obscur/engine-contracts";

import type { ConduitDescriptor, ConduitDialect } from "./conduit";
import type { MeshEnvelope, MeshInterest } from "./envelope";
import type {
  MeshEvidenceHandler,
  MeshInboundEnvelopeHandler,
  MeshPublishOutcome,
  MeshUnsubscribe,
} from "./evidence";
import type { MeshSnapshot } from "./mesh-snapshot";

/**
 * Dialect driver — implements wire I/O for one conduit instance.
 * Runtime (C2) owns scheduling; drivers publish/subscribe only.
 */
export type ConduitDriverPort = Readonly<{
  readonly conduitId: string;
  readonly dialect: ConduitDialect;
  publish(envelope: MeshEnvelope): Promise<MeshPublishOutcome>;
  subscribe(interests: ReadonlyArray<MeshInterest>): MeshUnsubscribe;
  probe(): Promise<Readonly<{ health: "healthy" | "degraded" | "offline"; detail?: string }>>;
}>;

/**
 * Mesh orchestration surface — superset of legacy community-only TransportPort.
 * Kernel engines call this; conduits are user-configured and Nostr-optional.
 */
export type MeshPort = Readonly<{
  configureConduits(conduits: ReadonlyArray<ConduitDescriptor>): Promise<void>;
  getSnapshot(scope: EngineScope): Promise<MeshSnapshot>;
  publishEnvelope(envelope: MeshEnvelope): Promise<MeshPublishOutcome>;
  subscribeEvidence(handler: MeshEvidenceHandler): MeshUnsubscribe;
  subscribeInbound(handler: MeshInboundEnvelopeHandler): MeshUnsubscribe;
}>;
