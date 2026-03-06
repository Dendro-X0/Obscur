import type { AdapterResult } from "./adapter-result";
import { failedResult, okResult, unsupportedResult } from "./adapter-result";
import { hasNativeRuntime } from "./runtime-capabilities";

export const invokeNativeCommand = async <T>(
  command: string,
  args?: Record<string, unknown>
): Promise<AdapterResult<T>> => {
  if (!hasNativeRuntime()) {
    return unsupportedResult(`Command ${command} is not supported in this runtime.`);
  }

  try {
    const { invoke } = await import("@tauri-apps/api/core");
    const value = await invoke<T>(command, args);
    return okResult(value);
  } catch (error) {
    return failedResult(error instanceof Error ? error.message : String(error));
  }
};
