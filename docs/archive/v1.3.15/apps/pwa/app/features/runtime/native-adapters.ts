import type { AdapterResult } from "./adapter-result";
import { failedResult, okResult, unsupportedResult } from "./adapter-result";
import { hasNativeRuntime } from "./runtime-capabilities";

export type InvokeNativeCommandOptions = Readonly<{
  timeoutMs?: number;
}>;

const MIN_TIMEOUT_BY_COMMAND: Readonly<Record<string, number>> = {
  desktop_get_profile_isolation_snapshot: 25_000,
  init_native_session: 20_000,
};

const resolveEffectiveTimeoutMs = (command: string, requestedTimeoutMs?: number): number | null => {
  if (!requestedTimeoutMs || requestedTimeoutMs <= 0) {
    return null;
  }
  const commandMinimumTimeoutMs = MIN_TIMEOUT_BY_COMMAND[command];
  if (!commandMinimumTimeoutMs) {
    return requestedTimeoutMs;
  }
  return Math.max(requestedTimeoutMs, commandMinimumTimeoutMs);
};

export const invokeNativeCommand = async <T>(
  command: string,
  args?: Record<string, unknown>,
  options?: InvokeNativeCommandOptions
): Promise<AdapterResult<T>> => {
  if (!hasNativeRuntime()) {
    return unsupportedResult(`Command ${command} is not supported in this runtime.`);
  }

  try {
    const { invoke } = await import("@tauri-apps/api/core");
    const timeoutMs = resolveEffectiveTimeoutMs(command, options?.timeoutMs);
    const value = timeoutMs && timeoutMs > 0
      ? await (() => {
          let timeoutHandle: ReturnType<typeof setTimeout> | null = null;
          const timeoutPromise = new Promise<T>((_, reject) => {
            timeoutHandle = setTimeout(() => {
              reject(new Error(`Native command ${command} timed out after ${timeoutMs}ms`));
            }, timeoutMs);
          });
          return Promise.race<T>([
            invoke<T>(command, args),
            timeoutPromise,
          ]).finally(() => {
            if (timeoutHandle) {
              clearTimeout(timeoutHandle);
            }
          });
        })()
      : await invoke<T>(command, args);
    return okResult(value);
  } catch (error) {
    return failedResult(error instanceof Error ? error.message : String(error));
  }
};
