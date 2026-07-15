import type { MeshTorRuntimeState } from "@obscur/conduit-mesh-contracts";
import { DEFAULT_MESH_TOR_STATE } from "@obscur/conduit-mesh-contracts";
import { mapTorStatusSnapshotToMeshTorState } from "@obscur/conduit-mesh";

import { listenToNativeEvent } from "@/app/features/runtime/native-event-adapter";
import type { TorStatusSnapshot } from "@/app/features/relays/hooks/relay-native-adapter";
import { relayNativeAdapter } from "@/app/features/relays/hooks/relay-native-adapter";

export type ConduitMeshTorHostPort = Readonly<{
  getTorState: () => Promise<MeshTorRuntimeState>;
}>;

export const mapTorStatusToMeshTorState = (
  snapshot: TorStatusSnapshot,
): MeshTorRuntimeState => (
  mapTorStatusSnapshotToMeshTorState({
    configured: snapshot.configured,
    ready: snapshot.ready,
    proxyUrl: snapshot.proxyUrl,
  })
);

export const fetchConduitMeshTorHostState = async (
  fetchTorStatus: () => Promise<TorStatusSnapshot> = () => relayNativeAdapter.getTorStatus(),
): Promise<MeshTorRuntimeState> => {
  try {
    return mapTorStatusToMeshTorState(await fetchTorStatus());
  } catch {
    return DEFAULT_MESH_TOR_STATE;
  }
};

/** Supplies mesh `getTorState` from desktop host — refreshes on each call (C3 cadence). */
export const createConduitMeshTorHostPort = (
  fetchTorStatus: () => Promise<TorStatusSnapshot> = () => relayNativeAdapter.getTorStatus(),
): ConduitMeshTorHostPort => ({
  getTorState: () => fetchConduitMeshTorHostState(fetchTorStatus),
});

export const subscribeConduitMeshTorHostRefresh = (listener: () => void): (() => void) => {
  let active = true;
  let unlisten: (() => void) | undefined;

  void listenToNativeEvent("tor-status", listener).then((cleanup) => {
    if (!active) {
      cleanup();
      return;
    }
    unlisten = cleanup;
  });

  return () => {
    active = false;
    unlisten?.();
  };
};
