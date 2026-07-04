import type {
  ConduitDescriptor,
  ConduitDriverPort,
  ConduitHealth,
  ConduitRuntimeState,
  MeshEnvelope,
  MeshEvidenceRecord,
  MeshInboundEnvelopeHandler,
  MeshPort,
  MeshPublishOutcome,
  MeshRecoveryReasonCode,
} from "@obscur/conduit-mesh-contracts";
import type { MeshTorRuntimeState } from "@obscur/conduit-mesh-contracts";
import {
  DEFAULT_MESH_TOR_STATE,
  filterConduitsByTorPolicy,
  resolveCandidateConduits,
  resolveTorBlockedFailureReason,
  satisfiesEvidenceClass,
  sortConduitsByTorPreference,
  validateMeshEnvelope,
} from "@obscur/conduit-mesh-contracts";
import type { EngineScope } from "@obscur/engine-contracts";

import { applyTorPolicyToConduitRuntime } from "./apply-tor-policy-to-runtime";
import { buildMeshSnapshot } from "./build-mesh-snapshot";
import { createEvidenceLedger, type EvidenceLedger } from "./evidence-ledger";
import { createMockConduitDriver } from "./mock-conduit-driver";

export type ConduitMesh = MeshPort & Readonly<{
  /** Test and diagnostics — evidence ledger is in-memory for C2. */
  readonly evidenceLedger: EvidenceLedger;
}>;

export type CreateConduitMeshParams = Readonly<{
  scope: EngineScope;
  now?: () => number;
  /** Host-supplied Tor readiness (desktop `get_tor_status` in C4+). */
  getTorState?: () => MeshTorRuntimeState | Promise<MeshTorRuntimeState>;
  /** When omitted, mock drivers are created per descriptor (always accept). */
  createDriver?: (descriptor: ConduitDescriptor) => ConduitDriverPort;
}>;

type ConduitEntry = {
  descriptor: ConduitDescriptor;
  driver: ConduitDriverPort;
  runtime: ConduitRuntimeState;
};

const probeHealthToConduitHealth = (
  probe: Readonly<{ health: "healthy" | "degraded" | "offline" }>,
): ConduitHealth => {
  if (probe.health === "healthy") return "healthy";
  if (probe.health === "degraded") return "degraded";
  return "offline";
};

export const createConduitMesh = (params: CreateConduitMeshParams): ConduitMesh => {
  const now = params.now ?? (() => Date.now());
  const evidenceLedger = createEvidenceLedger();
  const inboundHandlers = new Set<MeshInboundEnvelopeHandler>();

  let revision = 0;
  let entries: ConduitEntry[] = [];
  let pendingOutboundCount = 0;
  let lastEvidenceAtUnixMs: number | undefined;
  let recoveryAttemptCount = 0;
  let recoveryReasonCode: MeshRecoveryReasonCode | undefined;
  let lastFailureReason: string | undefined;
  let cachedTorState: MeshTorRuntimeState = DEFAULT_MESH_TOR_STATE;

  const resolveTorState = async (): Promise<MeshTorRuntimeState> => {
    if (params.getTorState) {
      cachedTorState = await params.getTorState();
    }
    return cachedTorState;
  };

  const bumpRevision = (): void => {
    revision += 1;
  };

  const buildSnapshot = (torState: MeshTorRuntimeState) => buildMeshSnapshot({
    scope: params.scope,
    revision,
    conduits: entries.map((e) => e.runtime),
    torState,
    pendingOutboundCount,
    lastEvidenceAtUnixMs,
    recoveryAttemptCount,
    recoveryReasonCode,
    lastFailureReason,
    updatedAtUnixMs: now(),
  });

  const recordEvidence = (records: ReadonlyArray<MeshEvidenceRecord>): void => {
    if (records.length === 0) return;
    lastEvidenceAtUnixMs = records[records.length - 1]!.atUnixMs;
    evidenceLedger.appendMany(records);
  };

  const updateRuntimeFromProbe = async (entry: ConduitEntry): Promise<void> => {
    const probe = await entry.driver.probe();
    const health = probeHealthToConduitHealth(probe);
    entry.runtime = {
      ...entry.runtime,
      health,
      lastFailureReason: probe.detail,
    };
  };

  const createDriverForDescriptor = (descriptor: ConduitDescriptor): ConduitDriverPort => {
    if (params.createDriver) {
      return params.createDriver(descriptor);
    }
    return createMockConduitDriver({ descriptor, now });
  };

  return {
    evidenceLedger,

    configureConduits: async (conduits) => {
      const torState = await resolveTorState();
      entries = await Promise.all(conduits.map(async (descriptor) => {
        const driver = createDriverForDescriptor(descriptor);
        const runtime: ConduitRuntimeState = {
          descriptor,
          health: "unknown",
        };
        const entry: ConduitEntry = { descriptor, driver, runtime };
        await updateRuntimeFromProbe(entry);
        entry.runtime = applyTorPolicyToConduitRuntime(entry.runtime, torState);
        return entry;
      }));
      bumpRevision();
    },

    getSnapshot: async () => {
      const torState = await resolveTorState();
      for (const entry of entries) {
        entry.runtime = applyTorPolicyToConduitRuntime(entry.runtime, torState);
      }
      return buildSnapshot(torState);
    },

    publishEnvelope: async (envelope): Promise<MeshPublishOutcome> => {
      const validation = validateMeshEnvelope(envelope);
      if (!validation.ok) {
        return {
          envelopeId: envelope.envelopeId,
          accepted: false,
          evidence: [],
          errorMessage: validation.reason,
        };
      }

      const torState = await resolveTorState();

      const baseCandidates = resolveCandidateConduits(
        entries.map((e) => e.descriptor),
        envelope,
      );

      const { viable, torBlocked } = filterConduitsByTorPolicy(baseCandidates, torState);
      const candidates = sortConduitsByTorPreference(viable, torState);

      if (candidates.length === 0) {
        const failureReason = resolveTorBlockedFailureReason(torBlocked, torState);
        recoveryReasonCode = failureReason === "tor_unreachable"
          ? "tor_unreachable"
          : "no_viable_conduit";
        lastFailureReason = failureReason;
        bumpRevision();
        const failed: MeshEvidenceRecord = {
          evidenceId: `mesh-${envelope.envelopeId}-${failureReason}`,
          envelopeId: envelope.envelopeId,
          kind: "publish_failed",
          atUnixMs: now(),
          failureReason,
        };
        recordEvidence([failed]);
        return {
          envelopeId: envelope.envelopeId,
          accepted: false,
          evidence: [failed],
          errorMessage: failureReason,
        };
      }

      for (const blocked of torBlocked) {
        const entry = entries.find((e) => e.descriptor.conduitId === blocked.conduitId);
        if (entry) {
          entry.runtime = applyTorPolicyToConduitRuntime(entry.runtime, torState);
        }
      }

      pendingOutboundCount += 1;
      bumpRevision();

      const accumulatedEvidence: MeshEvidenceRecord[] = [];
      let lastError: string | undefined;

      for (const candidate of candidates) {
        const entry = entries.find((e) => e.descriptor.conduitId === candidate.conduitId);
        if (!entry) continue;

        recoveryAttemptCount += 1;
        const outcome = await entry.driver.publish(envelope);
        accumulatedEvidence.push(...outcome.evidence);
        recordEvidence(outcome.evidence);

        if (outcome.accepted && satisfiesEvidenceClass(envelope.evidenceClass, outcome.evidence)) {
          const satisfied: MeshEvidenceRecord = {
            evidenceId: `mesh-${envelope.envelopeId}-satisfied`,
            envelopeId: envelope.envelopeId,
            kind: "evidence_class_satisfied",
            atUnixMs: now(),
            conduitId: candidate.conduitId,
            dialect: candidate.dialect,
          };
          recordEvidence([satisfied]);
          accumulatedEvidence.push(satisfied);
          pendingOutboundCount = Math.max(0, pendingOutboundCount - 1);
          recoveryReasonCode = undefined;
          lastFailureReason = undefined;
          bumpRevision();
          return {
            envelopeId: envelope.envelopeId,
            accepted: true,
            evidence: accumulatedEvidence,
          };
        }

        lastError = outcome.errorMessage ?? "publish_not_satisfied";
        lastFailureReason = lastError;
        entry.runtime = {
          ...entry.runtime,
          health: "degraded",
          lastFailureReason: lastError,
          lastEvidenceAtUnixMs: now(),
        };
      }

      pendingOutboundCount = Math.max(0, pendingOutboundCount - 1);
      recoveryReasonCode = "publish_timeouts";
      bumpRevision();

      return {
        envelopeId: envelope.envelopeId,
        accepted: false,
        evidence: accumulatedEvidence,
        errorMessage: lastError ?? "all_conduits_exhausted",
      };
    },

    subscribeEvidence: (handler) => evidenceLedger.subscribe(handler),

    subscribeInbound: (handler) => {
      inboundHandlers.add(handler);
      return () => {
        inboundHandlers.delete(handler);
      };
    },
  };
};
