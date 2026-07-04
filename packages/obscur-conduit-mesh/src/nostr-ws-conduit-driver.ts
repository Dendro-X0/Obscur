import type {
  ConduitDescriptor,
  ConduitDriverPort,
  MeshEnvelope,
  MeshEvidenceRecord,
  MeshInterest,
  MeshPublishOutcome,
} from "@obscur/conduit-mesh-contracts";
import { buildNostrWsWirePayload } from "@obscur/conduit-mesh-contracts";

import type { NostrWsWirePort } from "./nostr-ws-wire-port";

export type NostrWsConduitDriverOptions = Readonly<{
  descriptor: ConduitDescriptor;
  wire: NostrWsWirePort;
  now?: () => number;
  signerPublicKeyHex?: string;
}>;

let nostrWsEvidenceCounter = 0;

const nextEvidenceId = (prefix: string): string => {
  nostrWsEvidenceCounter += 1;
  return `${prefix}-${nostrWsEvidenceCounter}`;
};

export const resetNostrWsConduitDriverCounters = (): void => {
  nostrWsEvidenceCounter = 0;
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

const resolveRelayUrl = (descriptor: ConduitDescriptor): string => (
  (descriptor.endpoints[0] ?? "").trim()
);

export const createNostrWsConduitDriver = (
  options: NostrWsConduitDriverOptions,
): ConduitDriverPort => {
  const now = options.now ?? (() => Date.now());
  const relayUrl = resolveRelayUrl(options.descriptor);

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

      if (!relayUrl) {
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

      const wirePayload = buildNostrWsWirePayload(envelope, {
        signerPublicKeyHex: options.signerPublicKeyHex,
      });

      const result = await options.wire.publish(relayUrl, wirePayload);

      if (!result.accepted) {
        const failed = buildEvidence({
          envelope,
          kind: "publish_failed",
          descriptor: options.descriptor,
          now,
          failureReason: result.errorMessage ?? "nostr_relay_rejected",
        });
        return {
          envelopeId: envelope.envelopeId,
          accepted: false,
          evidence: [published, failed],
          errorMessage: result.errorMessage ?? "nostr_relay_rejected",
        };
      }

      const stored = buildEvidence({
        envelope,
        kind: "stored_proof",
        descriptor: options.descriptor,
        now,
        externalRef: result.eventId,
      });

      return {
        envelopeId: envelope.envelopeId,
        accepted: true,
        evidence: [published, stored],
      };
    },
    subscribe: (_interests: ReadonlyArray<MeshInterest>) => () => {},
    probe: async () => {
      if (!relayUrl) {
        return { health: "offline" as const, detail: "missing_endpoint" };
      }
      if (!options.wire.probe) {
        return { health: "healthy" as const };
      }
      try {
        const probeResult = await options.wire.probe(relayUrl);
        if (probeResult.healthy) {
          return { health: "healthy" as const };
        }
        return { health: "degraded" as const, detail: probeResult.detail ?? "probe_failed" };
      } catch {
        return { health: "offline" as const, detail: "probe_unreachable" };
      }
    },
  };
};
