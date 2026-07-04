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

export const resolveTauriEngineInvokeCommand = (
  request: EngineInvokeRequest,
): "engine_invoke" | "engine_invoke_transport_publish_relay_event" => (
  shouldRouteTransportPublishToAsyncDesktopCommand(request)
    ? "engine_invoke_transport_publish_relay_event"
    : "engine_invoke"
);

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
