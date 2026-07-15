"use client";

import { useEffect, useState } from "react";
import type { MeshTorRuntimeState } from "@obscur/conduit-mesh-contracts";
import { DEFAULT_MESH_TOR_STATE } from "@obscur/conduit-mesh-contracts";

import {
  fetchConduitMeshTorHostState,
  subscribeConduitMeshTorHostRefresh,
} from "@/app/features/transport-kernel/conduit-mesh-tor-host-port";

export const useConduitMeshTorSettingsState = (): MeshTorRuntimeState => {
  const [torState, setTorState] = useState<MeshTorRuntimeState>(DEFAULT_MESH_TOR_STATE);

  useEffect(() => {
    const refresh = (): void => {
      void fetchConduitMeshTorHostState().then(setTorState);
    };
    refresh();
    return subscribeConduitMeshTorHostRefresh(refresh);
  }, []);

  return torState;
};
