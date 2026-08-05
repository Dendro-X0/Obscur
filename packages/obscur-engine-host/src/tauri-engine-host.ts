import { invoke } from "@tauri-apps/api/core";
import type {
  EngineId,
  EngineInvokeRequest,
  EngineInvokeResult,
  EngineScope,
  EngineSnapshot,
  HostEnginePort,
} from "@obscur/engine-contracts";

export const isTransportHostPublishNetworkEnvEnabled = (): boolean => (
  typeof process !== "undefined"
  && process.env.NEXT_PUBLIC_OBSCUR_TRANSPORT_HOST_PUBLISH_NETWORK === "1"
);

/** W46: async desktop command when network lab gate is on. */
export const shouldRouteTransportPublishToAsyncDesktopCommand = (
  request: EngineInvokeRequest,
): boolean => (
  request.engine === "transport"
  && request.method === "publishRelayEvent"
  && isTransportHostPublishNetworkEnvEnabled()
);

/** R-RELAY-RUST-1b/1c: mesh configure + snapshot use async desktop commands. */
export const shouldRouteTransportConfigureMeshToAsyncDesktopCommand = (
  request: EngineInvokeRequest,
): boolean => (
  request.engine === "transport"
  && request.method === "configureMeshConduits"
);

export const shouldRouteTransportGetMeshSnapshotToAsyncDesktopCommand = (
  request: EngineInvokeRequest,
): boolean => (
  request.engine === "transport"
  && request.method === "getMeshSnapshot"
);

export const shouldRouteTransportPublishMeshEnvelopeToAsyncDesktopCommand = (
  request: EngineInvokeRequest,
): boolean => (
  request.engine === "transport"
  && request.method === "publishMeshEnvelope"
);

export const shouldRouteTransportExportOfflinePackToAsyncDesktopCommand = (
  request: EngineInvokeRequest,
): boolean => (
  request.engine === "transport"
  && request.method === "exportOfflinePack"
);

export const shouldRouteTransportImportOfflinePackToAsyncDesktopCommand = (
  request: EngineInvokeRequest,
): boolean => (
  request.engine === "transport"
  && request.method === "importOfflinePack"
);

export type TauriEngineInvokeCommand =
  | "engine_invoke"
  | "engine_invoke_transport_publish_relay_event"
  | "engine_invoke_transport_configure_mesh_conduits"
  | "engine_invoke_transport_get_mesh_snapshot"
  | "engine_invoke_transport_publish_mesh_envelope"
  | "engine_invoke_transport_export_offline_pack"
  | "engine_invoke_transport_import_offline_pack";

export const resolveTauriEngineInvokeCommand = (
  request: EngineInvokeRequest,
): TauriEngineInvokeCommand => {
  if (shouldRouteTransportConfigureMeshToAsyncDesktopCommand(request)) {
    return "engine_invoke_transport_configure_mesh_conduits";
  }
  if (shouldRouteTransportGetMeshSnapshotToAsyncDesktopCommand(request)) {
    return "engine_invoke_transport_get_mesh_snapshot";
  }
  if (shouldRouteTransportPublishMeshEnvelopeToAsyncDesktopCommand(request)) {
    return "engine_invoke_transport_publish_mesh_envelope";
  }
  if (shouldRouteTransportExportOfflinePackToAsyncDesktopCommand(request)) {
    return "engine_invoke_transport_export_offline_pack";
  }
  if (shouldRouteTransportImportOfflinePackToAsyncDesktopCommand(request)) {
    return "engine_invoke_transport_import_offline_pack";
  }
  if (shouldRouteTransportPublishToAsyncDesktopCommand(request)) {
    return "engine_invoke_transport_publish_relay_event";
  }
  return "engine_invoke";
};

export const isTauriEngineHostAvailable = (): boolean => {
  if (typeof window === "undefined") {
    return false;
  }
  const w = window as Window & {
    __TAURI_INTERNALS__?: { invoke?: unknown };
    __TAURI__?: { core?: { invoke?: unknown } };
  };
  return (
    typeof w.__TAURI_INTERNALS__?.invoke === "function"
    || typeof w.__TAURI__?.core?.invoke === "function"
  );
};

const invokeEngine = async (request: EngineInvokeRequest): Promise<EngineInvokeResult> => (
  invoke<EngineInvokeResult>(resolveTauriEngineInvokeCommand(request), { request })
);

export const createTauriEngineHost = (): HostEnginePort => ({
  invoke: invokeEngine,
  getSnapshot: async (engine: EngineId, scope: EngineScope): Promise<EngineSnapshot> => {
    const result = await invokeEngine({
      engine,
      method: "getSnapshot",
      scope,
    });
    if (!result.ok || !result.data) {
      return {
        engine,
        scope,
        phase: "offline",
        revision: 0,
        detail: { errorMessage: result.errorMessage },
      };
    }
    return result.data as EngineSnapshot;
  },
  subscribe: () => () => {},
});
