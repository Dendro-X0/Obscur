/**
 * Prefer `@obscur/engine-host/tauri` | `/memory` | `/subprocess`.
 * Root re-exports thin factories for engine-lab harnesses only.
 */
export {
  createTauriEngineHost,
  isTauriEngineHostAvailable,
  resolveTauriEngineInvokeCommand,
  isTransportHostPublishNetworkEnvEnabled,
  shouldRouteTransportPublishToAsyncDesktopCommand,
} from "./tauri-engine-host";
export type { TauriEngineInvokeCommand } from "./tauri-engine-host";
export { createMemoryEngineHost } from "./memory-engine-host";
export type { CreateMemoryEngineHostParams, MemoryEngineHandler } from "./memory-engine-host";
