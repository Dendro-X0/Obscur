import type { EngineId, EngineScope } from "./engine-ids";

/**
 * Sole boundary between UI (host) and runnable engines (backend).
 *
 * Host (apps/shell, apps/pwa chrome) may only call engines through this port.
 * Engines live in packages/* + libobscur + apps/coordination — not in React features.
 */
export type EngineInvokeRequest = Readonly<{
  engine: EngineId;
  method: string;
  scope: EngineScope;
  payload?: unknown;
}>;

export type EngineInvokeResult = Readonly<{
  ok: boolean;
  data?: unknown;
  errorCode?: string;
  errorMessage?: string;
}>;

export type EngineSnapshot = Readonly<{
  engine: EngineId;
  scope: EngineScope;
  phase: "cold" | "ready" | "degraded" | "offline";
  revision: number;
  detail?: Record<string, unknown>;
}>;

export type HostEnginePort = Readonly<{
  invoke(request: EngineInvokeRequest): Promise<EngineInvokeResult>;
  getSnapshot(engine: EngineId, scope: EngineScope): Promise<EngineSnapshot>;
  subscribe(
    engine: EngineId,
    scope: EngineScope,
    listener: (snapshot: EngineSnapshot) => void,
  ): () => void;
}>;
