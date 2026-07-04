import type { MeshTorRuntimeState } from "@obscur/conduit-mesh-contracts";

/** Maps desktop `TorStatusSnapshot` fields to mesh Tor state (host port — C4+). */
export const mapTorStatusSnapshotToMeshTorState = (
  snapshot: Readonly<{
    configured: boolean;
    ready: boolean;
    proxyUrl: string;
  }>,
): MeshTorRuntimeState => ({
  configured: snapshot.configured,
  ready: snapshot.ready,
  proxyUrl: snapshot.proxyUrl,
});
