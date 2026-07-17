import type { ConduitRuntimeState, MeshSnapshot } from "@obscur/conduit-mesh-contracts";

/** Subset of PWA `RelayTransportActivitySnapshot` for supervisor/UI badge parity. */
export type MeshRelayActivitySnapshot = Readonly<{
  lastInboundMessageAtUnixMs?: number;
  lastInboundEventAtUnixMs?: number;
  lastSuccessfulPublishAtUnixMs?: number;
  writableRelayCount: number;
  subscribableRelayCount: number;
  writeBlockedRelayCount: number;
  coolingDownRelayCount: number;
  fallbackRelayUrls: ReadonlyArray<string>;
  fallbackWritableRelayCount: number;
  meshReadiness: MeshSnapshot["readiness"];
  configuredConduitCount: number;
  publishReadyRelayUrls: ReadonlyArray<string>;
}>;

const isPublishReadyConduit = (conduit: ConduitRuntimeState): boolean => (
  conduit.descriptor.enabled
  && conduit.descriptor.capabilities.includes("publish")
  && (conduit.health === "healthy" || conduit.health === "degraded")
);

const isSubscribeReadyConduit = (conduit: ConduitRuntimeState): boolean => (
  conduit.descriptor.enabled
  && conduit.descriptor.capabilities.includes("subscribe")
  && (conduit.health === "healthy" || conduit.health === "degraded")
);

export const resolvePublishReadyRelayUrls = (
  snapshot: MeshSnapshot,
): ReadonlyArray<string> => {
  const urls: string[] = [];
  for (const conduit of snapshot.activeConduits) {
    if (!isPublishReadyConduit(conduit)) {
      continue;
    }
    urls.push(...conduit.descriptor.endpoints);
  }
  return Array.from(new Set(urls));
};

const resolveLatestEvidenceAtUnixMs = (snapshot: MeshSnapshot): number | undefined => {
  const conduitEvidence = snapshot.activeConduits
    .map((conduit) => conduit.lastEvidenceAtUnixMs)
    .filter((value): value is number => typeof value === "number");
  const candidates = [
    snapshot.lastEvidenceAtUnixMs,
    ...conduitEvidence,
  ].filter((value): value is number => typeof value === "number");
  if (candidates.length === 0) {
    return undefined;
  }
  return Math.max(...candidates);
};

export const mapMeshSnapshotToRelayActivitySnapshot = (
  snapshot: MeshSnapshot,
): MeshRelayActivitySnapshot => {
  const publishReady = snapshot.scopeReadiness.find((scope) => scope.messageScope === "dm");
  const publishReadyCount = publishReady?.publishReadyCount ?? 0;
  const subscribableRelayCount = snapshot.activeConduits.filter(isSubscribeReadyConduit).length;
  const publishReadyRelayUrls = resolvePublishReadyRelayUrls(snapshot);
  const evidenceAtUnixMs = resolveLatestEvidenceAtUnixMs(snapshot);

  return {
    lastInboundEventAtUnixMs: evidenceAtUnixMs,
    lastSuccessfulPublishAtUnixMs: evidenceAtUnixMs,
    writableRelayCount: publishReadyCount,
    subscribableRelayCount: Math.max(subscribableRelayCount, publishReadyCount),
    writeBlockedRelayCount: snapshot.blockedConduitIds.length,
    coolingDownRelayCount: snapshot.degradedConduitIds.length,
    fallbackRelayUrls: [],
    fallbackWritableRelayCount: 0,
    meshReadiness: snapshot.readiness,
    configuredConduitCount: snapshot.configuredConduitCount,
    publishReadyRelayUrls,
  };
};
