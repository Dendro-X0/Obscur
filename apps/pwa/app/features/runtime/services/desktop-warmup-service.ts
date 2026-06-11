import type { AdapterResult } from "../adapter-result";
import { invokeNativeCommand } from "../native-adapters";
import { listenToNativeEvent } from "../native-event-adapter";
import { hasNativeRuntime } from "../runtime-capabilities";

export const DESKTOP_WARMUP_PROGRESS_EVENT = "desktop-warmup-progress";

export type DesktopWarmupPhase = "idle" | "running" | "complete" | "failed";

export type DesktopWarmupStatus = Readonly<{
  profileId: string;
  phase: DesktopWarmupPhase;
  completedTasks: ReadonlyArray<string>;
  currentTask: string | null;
  completedCount: number;
  totalTasks: number;
  elapsedMs: number;
  conversationCount: number | null;
  groupCount: number | null;
  tombstoneCount: number | null;
  relayCheckpointCount: number | null;
  dmMessageHeadCount: number | null;
  groupMessageHeadCount: number | null;
  error: string | null;
}>;

export const startDesktopWarmup = async (
  profileId: string,
): Promise<AdapterResult<DesktopWarmupStatus>> => (
  invokeNativeCommand<DesktopWarmupStatus>("desktop_start_warmup", { profileId })
);

export const getDesktopWarmupStatus = async (
  profileId: string,
): Promise<AdapterResult<DesktopWarmupStatus>> => (
  invokeNativeCommand<DesktopWarmupStatus>("desktop_get_warmup_status", { profileId })
);

export const listenDesktopWarmupProgress = async (
  handler: (status: DesktopWarmupStatus) => void,
): Promise<() => void> => {
  if (!hasNativeRuntime()) {
    return () => undefined;
  }
  return listenToNativeEvent<DesktopWarmupStatus>(DESKTOP_WARMUP_PROGRESS_EVENT, (event) => {
    if (!event.payload) {
      return;
    }
    handler(event.payload);
  });
};
