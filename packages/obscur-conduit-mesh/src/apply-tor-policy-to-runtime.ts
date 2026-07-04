import type { ConduitDescriptor, ConduitRuntimeState, MeshTorRuntimeState } from "@obscur/conduit-mesh-contracts";
import { isConduitBlockedByTorPolicy } from "@obscur/conduit-mesh-contracts";

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
