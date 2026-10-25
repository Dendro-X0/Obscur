import type { ConduitDescriptor, ConduitRuntimeState } from "@obscur/conduit-mesh-contracts/conduit";
import type { MeshTorRuntimeState } from "@obscur/conduit-mesh-contracts/tor-policy";
import { isConduitBlockedByTorPolicy } from "@obscur/conduit-mesh-contracts/tor-policy";

export const applyTorPolicyToConduitRuntime = (
  runtime: ConduitRuntimeState,
  torState: MeshTorRuntimeState,
): ConduitRuntimeState => {
  if (!isConduitBlockedByTorPolicy(runtime.descriptor, torState)) {
    return runtime;
  }

  return {
    ...runtime,
    health: "blocked",
    lastFailureReason: "tor_unreachable",
  };
};

export const applyTorPolicyToAllRuntimes = (
  descriptors: ReadonlyArray<ConduitDescriptor>,
  runtimes: ReadonlyArray<ConduitRuntimeState>,
  torState: MeshTorRuntimeState,
): ReadonlyArray<ConduitRuntimeState> => runtimes.map((runtime) => (
  applyTorPolicyToConduitRuntime(runtime, torState)
));
