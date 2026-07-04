import { spawnSync } from "node:child_process";
import type {
  EngineId,
  EngineInvokeRequest,
  EngineInvokeResult,
  EngineScope,
  EngineSnapshot,
  HostEnginePort,
} from "@obscur/engine-contracts";

export type CreateSubprocessEngineHostParams = Readonly<{
  /** Path to `engine-lab-headless` binary built from libobscur. */
  binaryPath: string;
  /** SQLite database path passed to `--db`. */
  dbPath: string;
}>;

/**
 * HostEnginePort backed by the libobscur headless CLI — no WebView or Tauri.
 */
export const createSubprocessEngineHost = (
  params: CreateSubprocessEngineHostParams,
): HostEnginePort => ({
  invoke: async (request: EngineInvokeRequest): Promise<EngineInvokeResult> => {
    const child = spawnSync(params.binaryPath, ["--db", params.dbPath], {
      input: JSON.stringify(request),
      encoding: "utf8",
      maxBuffer: 16 * 1024 * 1024,
    });
    if (child.error) {
      return {
        ok: false,
        errorCode: "subprocess_spawn_error",
        errorMessage: child.error.message,
      };
    }
    const stdout = child.stdout?.trim();
    if (!stdout) {
      return {
        ok: false,
        errorCode: "subprocess_empty_stdout",
        errorMessage: child.stderr?.trim() || `exit ${child.status ?? "unknown"}`,
      };
    }
    try {
      return JSON.parse(stdout) as EngineInvokeResult;
    } catch {
      return {
        ok: false,
        errorCode: "subprocess_invalid_json",
        errorMessage: stdout.slice(0, 200),
      };
    }
  },
  getSnapshot: async (engine: EngineId, scope: EngineScope): Promise<EngineSnapshot> => ({
    engine,
    scope,
    phase: "offline",
    revision: 0,
  }),
  subscribe: () => () => {},
});
