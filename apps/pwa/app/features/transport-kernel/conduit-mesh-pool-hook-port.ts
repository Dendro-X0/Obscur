import { isTransportKernelPoolHookOwner } from "@/app/features/transport-kernel/transport-kernel-pool-hook-port";

/** Conduit Mesh replaces enhanced-relay-pool orchestrator when this flag is set (strict kernel). */
export const isConduitMeshPoolHookOwner = (): boolean => (
  process.env.NEXT_PUBLIC_OBSCUR_CONDUIT_MESH_POOL === "1"
  && isTransportKernelPoolHookOwner()
);

export const shouldUseConduitMeshRelayPoolHook = (): boolean => isConduitMeshPoolHookOwner();
