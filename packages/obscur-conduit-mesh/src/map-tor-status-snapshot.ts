import type { MeshTorRuntimeState } from "@obscur/conduit-mesh-contracts";

/**
 * Documentation flag: UI process must never open SOCKS sockets.
 * Host sets `ready` only when gateway owns HTTP dials (R4 Slice 4a).
 */
export const MESH_DIAL_VIA_UI_SOCKS_ALLOWED = false;

/** Maps desktop `TorStatusSnapshot` fields to mesh Tor state (host port — C4+). */
export const mapTorStatusSnapshotToMeshTorState = (
  snapshot: Readonly<{
    configured: boolean;
    ready: boolean;
    proxyUrl: string;
    /** Gateway Bootstrapped 100% — informational. */
    lifecycleReady?: boolean;
  }>,
): MeshTorRuntimeState => ({
  configured: snapshot.configured,
  // Trust host dial-ready. Host must keep UI SOCKS disarmed.
  ready: snapshot.ready && !MESH_DIAL_VIA_UI_SOCKS_ALLOWED,
  proxyUrl: snapshot.proxyUrl,
});
