import type { TransportSnapshot } from "@obscur/transport-engine";
import type { RelayRuntimePhase } from "@/app/features/relays/services/relay-runtime-contracts";
import { readTransportEvidencePhase } from "@/app/features/relays/services/transport-relay-supervisor-evidence";
import { isTransportKernelAuthority } from "./transport-kernel-policy";

/** Transport-engine snapshot is runtime phase owner when transport-kernel authority is active. */
export const isTransportKernelSnapshotOwner = (): boolean => isTransportKernelAuthority();

export const resolveRelayRuntimePhaseForTransportKernel = (params: Readonly<{
  legacyPhase: RelayRuntimePhase;
  transportSnapshot: TransportSnapshot | null;
}>): RelayRuntimePhase => {
  if (!isTransportKernelSnapshotOwner() || !params.transportSnapshot) {
    return params.legacyPhase;
  }
  return readTransportEvidencePhase(params.transportSnapshot);
};
