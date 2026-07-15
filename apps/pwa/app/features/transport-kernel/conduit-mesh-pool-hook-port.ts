import { isTransportKernelPoolHookOwner } from "@/app/features/transport-kernel/transport-kernel-pool-hook-port";

/**
 * C7b: Conduit Mesh is the default relay pool when transport-kernel owns the hook.
 * Set `NEXT_PUBLIC_OBSCUR_CONDUIT_MESH_POOL=0` to fall back to transport-kernel enhanced pool.
 * Legacy web (no transport-kernel authority) continues using the legacy WebSocket pool.
 */
export const isConduitMeshPoolExplicitlyDisabled = (): boolean => (
  process.env.NEXT_PUBLIC_OBSCUR_CONDUIT_MESH_POOL === "0"
);

export const isConduitMeshPoolHookOwner = (): boolean => (
  isTransportKernelPoolHookOwner()
  && !isConduitMeshPoolExplicitlyDisabled()
);

export const shouldUseConduitMeshRelayPoolHook = (): boolean => isConduitMeshPoolHookOwner();
