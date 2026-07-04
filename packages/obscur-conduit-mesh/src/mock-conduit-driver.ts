import type {
  ConduitDescriptor,
  ConduitDriverPort,
  ConduitDialect,
  MeshEnvelope,
  MeshEvidenceRecord,
  MeshInterest,
  MeshPublishOutcome,
} from "@obscur/conduit-mesh-contracts";

export type MockConduitPublishBehavior = "accept" | "fail" | "degraded_accept";

export type MockConduitDriverOptions = Readonly<{
  descriptor: ConduitDescriptor;
  publishBehavior?: MockConduitPublishBehavior;
  failureReason?: string;
  probeHealth?: "healthy" | "degraded" | "offline";
  now?: () => number;
  evidenceIdPrefix?: string;
}>;

let mockEvidenceCounter = 0;

const nextEvidenceId = (prefix: string): string => {
  mockEvidenceCounter += 1;
  return `${prefix}-${mockEvidenceCounter}`;
};

export const createMockConduitDriver = (
  options: MockConduitDriverOptions,
): ConduitDriverPort => {
  const {
    descriptor,
    publishBehavior = "accept",
    failureReason = "mock_publish_failed",
    probeHealth = "healthy",
    now = () => Date.now(),
    evidenceIdPrefix = descriptor.conduitId,
  } = options;

  const dialect: ConduitDialect = descriptor.dialect;

  const buildAcceptEvidence = (
    envelope: MeshEnvelope,
    kind: MeshEvidenceRecord["kind"],
  ): MeshEvidenceRecord => ({
    evidenceId: nextEvidenceId(evidenceIdPrefix),
    envelopeId: envelope.envelopeId,
    kind,
    atUnixMs: now(),
    conduitId: descriptor.conduitId,
    dialect,
    externalRef: `mock-ref-${envelope.envelopeId}`,
  });

  return {
    conduitId: descriptor.conduitId,
    dialect,
    publish: async (envelope): Promise<MeshPublishOutcome> => {
      const published = buildAcceptEvidence(envelope, "published_to_conduit");

      if (publishBehavior === "fail") {
        const failed: MeshEvidenceRecord = {
          evidenceId: nextEvidenceId(evidenceIdPrefix),
          envelopeId: envelope.envelopeId,
          kind: "publish_failed",
          atUnixMs: now(),
          conduitId: descriptor.conduitId,
          dialect,
          failureReason,
        };
        return {
          envelopeId: envelope.envelopeId,
          accepted: false,
          evidence: [published, failed],
          errorMessage: failureReason,
        };
      }

      const acceptKind: MeshEvidenceRecord["kind"] = publishBehavior === "degraded_accept"
        ? "stored_proof"
        : "accepted_by_operator";

      const accepted = buildAcceptEvidence(envelope, acceptKind);
      return {
        envelopeId: envelope.envelopeId,
        accepted: true,
        evidence: [published, accepted],
      };
    },
    subscribe: (_interests) => () => {},
    probe: async () => ({
      health: probeHealth,
      detail: probeHealth === "offline" ? "mock_offline" : undefined,
    }),
  };
};

/** Reset test-only evidence counter between test files if needed. */
export const resetMockConduitDriverCounters = (): void => {
  mockEvidenceCounter = 0;
};
