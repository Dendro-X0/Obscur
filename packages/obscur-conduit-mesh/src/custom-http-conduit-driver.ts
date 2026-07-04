import type {
  ConduitDescriptor,
  ConduitDriverPort,
  MeshEnvelope,
  MeshEvidenceRecord,
  MeshInterest,
  MeshPublishOutcome,
} from "@obscur/conduit-mesh-contracts";
import {
  CUSTOM_CONDUIT_HTTP_PATHS,
  CUSTOM_CONDUIT_HTTP_V1,
} from "@obscur/conduit-mesh-contracts";
import type { CustomConduitHealthResponse, CustomConduitPublishResponse } from "@obscur/conduit-mesh-contracts";

import type { ConduitMeshFetch } from "./conduit-http-utils";
import { encodeCiphertextBase64, normalizeConduitBaseUrl } from "./conduit-http-utils";

export type CustomHttpConduitDriverOptions = Readonly<{
  descriptor: ConduitDescriptor;
  fetch: ConduitMeshFetch;
  now?: () => number;
}>;

let customHttpEvidenceCounter = 0;

const nextEvidenceId = (prefix: string): string => {
  customHttpEvidenceCounter += 1;
  return `${prefix}-${customHttpEvidenceCounter}`;
};

export const resetCustomHttpConduitDriverCounters = (): void => {
  customHttpEvidenceCounter = 0;
};

const buildEvidence = (
  params: Readonly<{
    envelope: MeshEnvelope;
    kind: MeshEvidenceRecord["kind"];
    descriptor: ConduitDescriptor;
    now: () => number;
    externalRef?: string;
    failureReason?: string;
  }>,
): MeshEvidenceRecord => ({
  evidenceId: nextEvidenceId(params.descriptor.conduitId),
  envelopeId: params.envelope.envelopeId,
  kind: params.kind,
  atUnixMs: params.now(),
  conduitId: params.descriptor.conduitId,
  dialect: params.descriptor.dialect,
  externalRef: params.externalRef,
  failureReason: params.failureReason,
});

export const createCustomHttpConduitDriver = (
  options: CustomHttpConduitDriverOptions,
): ConduitDriverPort => {
  const now = options.now ?? (() => Date.now());
  const baseUrl = normalizeConduitBaseUrl(options.descriptor.endpoints[0] ?? "");

  return {
    conduitId: options.descriptor.conduitId,
    dialect: options.descriptor.dialect,
    publish: async (envelope): Promise<MeshPublishOutcome> => {
      const published = buildEvidence({
        envelope,
        kind: "published_to_conduit",
        descriptor: options.descriptor,
        now,
      });

      if (!baseUrl) {
        const failed = buildEvidence({
          envelope,
          kind: "publish_failed",
          descriptor: options.descriptor,
          now,
          failureReason: "missing_endpoint",
        });
        return {
          envelopeId: envelope.envelopeId,
          accepted: false,
          evidence: [published, failed],
          errorMessage: "missing_endpoint",
        };
      }

      const response = await options.fetch(`${baseUrl}${CUSTOM_CONDUIT_HTTP_PATHS.publish}`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          contractVersion: CUSTOM_CONDUIT_HTTP_V1,
          envelopeId: envelope.envelopeId,
          correlationId: envelope.correlationId,
          messageScope: envelope.messageScope,
          audience: envelope.audience,
          ciphertextBase64: encodeCiphertextBase64(envelope.ciphertext),
          createdAtUnixMs: envelope.createdAtUnixMs,
        }),
      });

      let body: CustomConduitPublishResponse = { accepted: false };
      try {
        body = await response.json() as CustomConduitPublishResponse;
      } catch {
        body = { accepted: false, errorMessage: "invalid_publish_response" };
      }

      if (!response.ok || !body.accepted) {
        const failed = buildEvidence({
          envelope,
          kind: "publish_failed",
          descriptor: options.descriptor,
          now,
          failureReason: body.errorMessage ?? `http_${response.status}`,
        });
        return {
          envelopeId: envelope.envelopeId,
          accepted: false,
          evidence: [published, failed],
          errorMessage: body.errorMessage ?? `http_${response.status}`,
        };
      }

      const accepted = buildEvidence({
        envelope,
        kind: "accepted_by_operator",
        descriptor: options.descriptor,
        now,
        externalRef: body.storedRef,
      });

      return {
        envelopeId: envelope.envelopeId,
        accepted: true,
        evidence: [published, accepted],
      };
    },
    subscribe: (_interests: ReadonlyArray<MeshInterest>) => () => {},
    probe: async () => {
      if (!baseUrl) {
        return { health: "offline" as const, detail: "missing_endpoint" };
      }
      try {
        const response = await options.fetch(`${baseUrl}${CUSTOM_CONDUIT_HTTP_PATHS.health}`);
        const body = await response.json() as CustomConduitHealthResponse;
        if (response.ok && body.ok && body.contractVersion === CUSTOM_CONDUIT_HTTP_V1) {
          return { health: "healthy" as const };
        }
        return { health: "degraded" as const, detail: "health_check_failed" };
      } catch {
        return { health: "offline" as const, detail: "health_unreachable" };
      }
    },
  };
};
