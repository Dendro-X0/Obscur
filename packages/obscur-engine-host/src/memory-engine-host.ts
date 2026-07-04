import type {
  EngineId,
  EngineInvokeRequest,
  EngineInvokeResult,
  EngineScope,
  HostEnginePort,
} from "@obscur/engine-contracts";

export type MemoryEngineHandler = (
  request: EngineInvokeRequest,
) => EngineInvokeResult | Promise<EngineInvokeResult>;

export type CreateMemoryEngineHostParams = Readonly<{
  handlers?: Partial<Record<EngineId, MemoryEngineHandler>>;
  defaultHandler?: MemoryEngineHandler;
}>;

/**
 * In-process HostEnginePort for headless engine-lab tests — no Tauri or WebView.
 */
export const createMemoryEngineHost = (
  params: CreateMemoryEngineHostParams = {},
): HostEnginePort => ({
  invoke: async (request) => {
    const handler = params.handlers?.[request.engine] ?? params.defaultHandler;
    if (!handler) {
      return {
        ok: false,
        errorCode: "unsupported_engine",
        errorMessage: `No memory handler for engine "${request.engine}"`,
      };
    }
    return handler(request);
  },
  getSnapshot: async (engine, scope) => ({
    engine,
    scope,
    phase: "offline",
    revision: 0,
  }),
  subscribe: () => () => {},
});
