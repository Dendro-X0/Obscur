import type {
  ConduitDescriptor,
  ConduitDriverPort,
  MeshEnvelope,
  MeshEvidenceRecord,
  MeshInterest,
  MeshPublishOutcome,
} from "@obscur/conduit-mesh-contracts";

import type { ConduitMeshFetch } from "./conduit-http-utils";
import { normalizeConduitBaseUrl } from "./conduit-http-utils";

export type CoordinationHttpConduitDriverOptions = Readonly<{
  descriptor: ConduitDescriptor;
  fetch: ConduitMeshFetch;
  now?: () => number;
}>;

type MembershipHeadResponse = Readonly<{
  ok: boolean;
  data?: Readonly<{
    communityId: string;
    seq: number;
    headHash: string;
    updatedAtUnixMs: number;
  }>;
}>;

let coordinationEvidenceCounter = 0;

const nextEvidenceId = (prefix: string): string => {
  coordinationEvidenceCounter += 1;
  return `${prefix}-${coordinationEvidenceCounter}`;
};

export const resetCoordinationHttpConduitDriverCounters = (): void => {
  coordinationEvidenceCounter = 0;
};

const resolveCommunityId = (envelope: MeshEnvelope): string | null => {
  if (envelope.audience.kind === "workspace") {
    return envelope.audience.communityId;
  }
  if (envelope.audience.kind === "control") {
    return envelope.audience.coordinationTopic;
  }
  return null;
};

export const createCoordinationHttpConduitDriver = (
  options: CoordinationHttpConduitDriverOptions,
): ConduitDriverPort => {
  const now = options.now ?? (() => Date.now());
  const baseUrl = normalizeConduitBaseUrl(options.descriptor.endpoints[0] ?? "");

  const buildEvidence = (
    envelope: MeshEnvelope,
    kind: MeshEvidenceRecord["kind"],
    extra?: Partial<MeshEvidenceRecord>,
  ): MeshEvidenceRecord => ({
    evidenceId: nextEvidenceId(options.descriptor.conduitId),
    envelopeId: envelope.envelopeId,
    kind,
    atUnixMs: now(),
    conduitId: options.descriptor.conduitId,
    dialect: "coordination_http",
    ...extra,
  });

  return {
    conduitId: options.descriptor.conduitId,
    dialect: "coordination_http",
    publish: async (envelope): Promise<MeshPublishOutcome> => {
      const published = buildEvidence(envelope, "published_to_conduit");

      if (!baseUrl) {
        const failed = buildEvidence(envelope, "publish_failed", { failureReason: "missing_endpoint" });
        return {
          envelopeId: envelope.envelopeId,
          accepted: false,
          evidence: [published, failed],
          errorMessage: "missing_endpoint",
        };
      }

      if (envelope.evidenceClass !== "coordination_head") {
        const failed = buildEvidence(envelope, "publish_failed", {
          failureReason: "coordination_driver_requires_coordination_head_evidence",
        });
        return {
          envelopeId: envelope.envelopeId,
          accepted: false,
          evidence: [published, failed],
          errorMessage: "coordination_driver_requires_coordination_head_evidence",
        };
      }

      const communityId = resolveCommunityId(envelope);
      if (!communityId) {
        const failed = buildEvidence(envelope, "publish_failed", {
          failureReason: "coordination_audience_invalid",
        });
        return {
          envelopeId: envelope.envelopeId,
          accepted: false,
          evidence: [published, failed],
          errorMessage: "coordination_audience_invalid",
        };
      }

      const response = await options.fetch(
        `${baseUrl}/communities/${encodeURIComponent(communityId)}/membership/head`,
      );

      let body: MembershipHeadResponse = { ok: false };
      try {
        body = await response.json() as MembershipHeadResponse;
      } catch {
        body = { ok: false };
      }

      if (!response.ok || !body.ok || !body.data) {
        const failed = buildEvidence(envelope, "publish_failed", {
          failureReason: "coordination_head_fetch_failed",
        });
        return {
          envelopeId: envelope.envelopeId,
          accepted: false,
          evidence: [published, failed],
          errorMessage: "coordination_head_fetch_failed",
        };
      }

      const headEvidence = buildEvidence(envelope, "coordination_head_seq", {
        coordinationHeadSeq: body.data.seq,
        externalRef: body.data.headHash || `seq:${body.data.seq}`,
      });

      return {
        envelopeId: envelope.envelopeId,
        accepted: true,
        evidence: [published, headEvidence],
      };
    },
    subscribe: (_interests: ReadonlyArray<MeshInterest>) => () => {},
    probe: async () => {
      if (!baseUrl) {
        return { health: "offline" as const, detail: "missing_endpoint" };
      }
      try {
        const response = await options.fetch(`${baseUrl}/health`);
        const body = await response.json() as { ok?: boolean };
        if (response.ok && body.ok) {
          return { health: "healthy" as const };
        }
        return { health: "degraded" as const, detail: "coordination_health_failed" };
      } catch {
        return { health: "offline" as const, detail: "coordination_unreachable" };
      }
    },
  };
};
