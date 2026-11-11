import type {
  EngineId,
  EngineInvokeRequest,
  EngineInvokeResult,
  EngineScope,
  EngineSnapshot,
  HostEnginePort,
} from "@obscur/engine-contracts";

/**
 * Cut 4.3 — thin Tauri HostEnginePort for Vite desktop-ui.
 * Uses engine_invoke only (private-trust + dm). Avoids importing
 * @obscur/engine-host/tauri (Node `process` types) into the Vite tsc graph.
 */

type TauriInvoke = <T>(cmd: string, args?: Record<string, unknown>) => Promise<T>;

const resolveTauriInvoke = (): TauriInvoke => {
  const w = window as Window & {
    __TAURI_INTERNALS__?: { invoke?: TauriInvoke };
    __TAURI__?: { core?: { invoke?: TauriInvoke } };
  };
  const invoke = w.__TAURI_INTERNALS__?.invoke ?? w.__TAURI__?.core?.invoke;
  if (typeof invoke !== "function") {
    throw new Error("Tauri invoke unavailable");
  }
  return invoke;
};

export const createViteTauriEngineHost = (): HostEnginePort => {
  const invokeEngine = async (request: EngineInvokeRequest): Promise<EngineInvokeResult> => {
    const invoke = resolveTauriInvoke();
    return invoke<EngineInvokeResult>("engine_invoke", { request });
  };

  return {
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
    subscribe: () => () => undefined,
  };
};
