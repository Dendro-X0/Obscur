import type {
  ConduitDescriptor,
  MeshEnvelope,
  MeshPublishOutcome,
} from "@obscur/conduit-mesh-contracts";
import { resolveCandidateConduits } from "@obscur/conduit-mesh-contracts";

import type { ConduitMesh } from "./create-conduit-mesh";
import { createConduitDriverFromDescriptor } from "./create-conduit-driver";
import type { ConduitMeshFetch } from "./conduit-http-utils";
import { createConduitMesh } from "./create-conduit-mesh";
import { createInMemoryConduitFetchRouter } from "./in-memory-conduit-fetch-router";

export type W53QuorumPublishResult = Readonly<{
  successCount: number;
  totalRelays: number;
  quorumRequired: number;
  metQuorum: boolean;
  outcomes: ReadonlyArray<MeshPublishOutcome>;
}>;

export const publishEnvelopeToAllCandidates = async (
  params: Readonly<{
    descriptors: ReadonlyArray<ConduitDescriptor>;
    envelope: MeshEnvelope;
    fetch: ConduitMeshFetch;
    quorumRequired?: number;
    now?: () => number;
  }>,
): Promise<W53QuorumPublishResult> => {
  const candidates = resolveCandidateConduits(params.descriptors, params.envelope);
  const quorumRequired = params.quorumRequired ?? 1;
  const outcomes: MeshPublishOutcome[] = [];
  let successCount = 0;

  for (const descriptor of candidates) {
    const driver = createConduitDriverFromDescriptor(descriptor, {
      fetch: params.fetch,
      now: params.now,
    });
    const outcome = await driver.publish(params.envelope);
    outcomes.push(outcome);
    if (outcome.accepted) {
      successCount += 1;
    }
  }

  return {
    successCount,
    totalRelays: candidates.length,
    quorumRequired,
    metQuorum: successCount >= quorumRequired,
    outcomes,
  };
};

export type W53SmokeParityReport = Readonly<{
  multiRelayQuorum: W53QuorumPublishResult;
  laneSwitchAccepted: boolean;
  meshReadiness: string;
}>;

/** Headless W53 smoke parity — no desktop, no legacy pool orchestrator. */
export const runW53SmokeParityHarness = async (
  params: Readonly<{ now?: () => number }> = {},
): Promise<W53SmokeParityReport> => {
  const now = params.now ?? (() => Date.now());
  const coordinationBase = "http://127.0.0.1:8787";
  const teamBase = "http://127.0.0.1:8788";
  const customBase = "http://127.0.0.1:8789";

  const quorumFetch = createInMemoryConduitFetchRouter({
    coordinationBaseUrl: coordinationBase,
    teamRelayBaseUrl: customBase,
  });

  const descriptors: ConduitDescriptor[] = [0, 1, 2].map((index) => ({
    conduitId: `custom-${index}`,
    dialect: "custom" as const,
    endpoints: [customBase],
    capabilities: ["publish"] as ConduitDescriptor["capabilities"],
    networkPolicy: "clearnet" as const,
    trustTier: "user_configured" as const,
    enabled: true,
    priority: index,
  }));

  const envelope: MeshEnvelope = {
    envelopeId: "w53-smoke-envelope",
    scope: { profileId: "w53-profile" },
    messageScope: "dm",
    audience: { kind: "dm", recipientPublicKeyHex: "w53" },
    ciphertext: new TextEncoder().encode("w53-smoke-payload"),
    evidenceClass: "at_least_one_conduit_accept",
    createdAtUnixMs: now(),
  };

  const multiRelayQuorum = await publishEnvelopeToAllCandidates({
    descriptors,
    envelope,
    fetch: quorumFetch,
    quorumRequired: 2,
    now,
  });

  const laneSwitchFetch = createInMemoryConduitFetchRouter({
    coordinationBaseUrl: coordinationBase,
    teamRelayBaseUrl: teamBase,
    teamPublishFails: true,
  });

  const mesh = createConduitMesh({
    scope: { profileId: "w53-profile" },
    now,
    createDriver: (descriptor) => {
      const fetchImpl = descriptor.conduitId === "custom-fallback"
        ? createInMemoryConduitFetchRouter({
          coordinationBaseUrl: coordinationBase,
          teamRelayBaseUrl: "http://127.0.0.1:8799",
        })
        : laneSwitchFetch;
      return createConduitDriverFromDescriptor(descriptor, { fetch: fetchImpl, now });
    },
  });

  await mesh.configureConduits([
    {
      conduitId: "team-primary",
      dialect: "team_relay",
      endpoints: ["wss://127.0.0.1:8788"],
      capabilities: ["publish"],
      networkPolicy: "clearnet",
      trustTier: "operator_attested",
      enabled: true,
      priority: 0,
    },
    {
      conduitId: "custom-fallback",
      dialect: "custom",
      endpoints: ["http://127.0.0.1:8799"],
      capabilities: ["publish"],
      networkPolicy: "clearnet",
      trustTier: "user_configured",
      enabled: true,
      priority: 1,
    },
  ]);

  const laneOutcome = await mesh.publishEnvelope(envelope);
  const snapshot = await mesh.getSnapshot({ profileId: "w53-profile" });

  return {
    multiRelayQuorum,
    laneSwitchAccepted: laneOutcome.accepted,
    meshReadiness: snapshot.readiness,
  };
};
