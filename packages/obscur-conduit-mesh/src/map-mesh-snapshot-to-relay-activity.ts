import type { MeshSnapshot } from "@obscur/conduit-mesh-contracts";

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
}>;

export const mapMeshSnapshotToRelayActivitySnapshot = (
  snapshot: MeshSnapshot,
): MeshRelayActivitySnapshot => {
  const publishReady = snapshot.scopeReadiness.find((s) => s.messageScope === "dm");
  const readyCount = publishReady?.publishReadyCount ?? 0;
  const blockedCount = snapshot.blockedConduitIds.length;

  return {
    lastSuccessfulPublishAtUnixMs: snapshot.lastEvidenceAtUnixMs,
    writableRelayCount: readyCount,
    subscribableRelayCount: readyCount,
    writeBlockedRelayCount: blockedCount,
    coolingDownRelayCount: snapshot.degradedConduitIds.length,
    fallbackRelayUrls: snapshot.degradedConduitIds,
    fallbackWritableRelayCount: snapshot.degradedConduitIds.length > 0 ? 1 : 0,
  };
};
