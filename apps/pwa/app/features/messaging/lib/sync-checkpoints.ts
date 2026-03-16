import { getScopedStorageKey } from "@/app/features/profiles/services/profile-scope";

export type TimelineCheckpoint = Readonly<{
  timelineKey: string;
  lastProcessedAtUnixSeconds: number;
  updatedAtUnixMs: number;
}>;

export type SyncGap = Readonly<{
  timelineKey: string;
  requestedSinceUnixSeconds: number;
  checkpointUnixSeconds: number;
  gapSeconds: number;
}>;

export type BackfillRequest = Readonly<{
  timelineKey: string;
  sinceUnixSeconds: number;
  limit: number;
  reason: "gap_detected" | "manual_since" | "standard";
}>;

export type CheckpointRepairResult = "ok" | "repaired" | "failed";

export type CheckpointRepairReport = Readonly<{
  result: CheckpointRepairResult;
  timelineKey: string;
  repairedSinceUnixSeconds: number;
  message?: string;
}>;

const GLOBAL_CHECKPOINTS_KEY = "__obscur_sync_checkpoints__";
const STORAGE_KEY = "obscur.messaging.sync_checkpoints.v1";
const GAP_DETECTION_THRESHOLD_SECONDS = 6 * 60 * 60;
const TARGETED_BACKFILL_WINDOW_SECONDS = 2 * 60 * 60;

type PersistedCheckpointState = Readonly<{
  version: 1;
  checkpoints: ReadonlyArray<TimelineCheckpoint>;
}>;

const getStorageKey = (): string => getScopedStorageKey(STORAGE_KEY);

const toPersistedState = (state: Map<string, TimelineCheckpoint>): PersistedCheckpointState => ({
  version: 1,
  checkpoints: Array.from(state.values()),
});

const fromPersistedState = (value: unknown): Map<string, TimelineCheckpoint> => {
  if (!value || typeof value !== "object") {
    return new Map<string, TimelineCheckpoint>();
  }
  const parsed = value as PersistedCheckpointState;
  if (parsed.version !== 1 || !Array.isArray(parsed.checkpoints)) {
    return new Map<string, TimelineCheckpoint>();
  }
  const next = new Map<string, TimelineCheckpoint>();
  for (const checkpoint of parsed.checkpoints) {
    if (!checkpoint || typeof checkpoint !== "object") {
      continue;
    }
    const record = checkpoint as Record<string, unknown>;
    if (
      typeof record.timelineKey !== "string"
      || typeof record.lastProcessedAtUnixSeconds !== "number"
      || typeof record.updatedAtUnixMs !== "number"
    ) {
      continue;
    }
    next.set(record.timelineKey, {
      timelineKey: record.timelineKey,
      lastProcessedAtUnixSeconds: record.lastProcessedAtUnixSeconds,
      updatedAtUnixMs: record.updatedAtUnixMs,
    });
  }
  return next;
};

const loadPersistedCheckpointState = (): Map<string, TimelineCheckpoint> => {
  if (typeof window === "undefined") {
    return new Map<string, TimelineCheckpoint>();
  }
  try {
    const raw = window.localStorage.getItem(getStorageKey());
    if (!raw) {
      return new Map<string, TimelineCheckpoint>();
    }
    return fromPersistedState(JSON.parse(raw));
  } catch {
    return new Map<string, TimelineCheckpoint>();
  }
};

const persistCheckpointState = (state: Map<string, TimelineCheckpoint>): void => {
  if (typeof window === "undefined") {
    return;
  }
  try {
    window.localStorage.setItem(getStorageKey(), JSON.stringify(toPersistedState(state)));
  } catch {
    // Keep sync bookkeeping non-throwing during degraded storage conditions.
  }
};

const getCheckpointState = (): Map<string, TimelineCheckpoint> => {
  const root = globalThis as Record<string, unknown>;
  const existing = root[GLOBAL_CHECKPOINTS_KEY];
  if (existing instanceof Map) {
    return existing as Map<string, TimelineCheckpoint>;
  }
  const next = loadPersistedCheckpointState();
  root[GLOBAL_CHECKPOINTS_KEY] = next;
  return next;
};

export const getTimelineCheckpoint = (timelineKey: string): TimelineCheckpoint | null => {
  const value = getCheckpointState().get(timelineKey);
  return value ?? null;
};

export const updateTimelineCheckpoint = (timelineKey: string, lastProcessedAtUnixSeconds: number): TimelineCheckpoint => {
  const next: TimelineCheckpoint = {
    timelineKey,
    lastProcessedAtUnixSeconds,
    updatedAtUnixMs: Date.now(),
  };
  const state = getCheckpointState();
  state.set(timelineKey, next);
  persistCheckpointState(state);
  return next;
};

export const detectSyncGap = (timelineKey: string, requestedSinceUnixSeconds: number): SyncGap | null => {
  const checkpoint = getTimelineCheckpoint(timelineKey);
  if (!checkpoint) return null;
  const gapSeconds = checkpoint.lastProcessedAtUnixSeconds - requestedSinceUnixSeconds;
  if (gapSeconds <= GAP_DETECTION_THRESHOLD_SECONDS) return null;
  return {
    timelineKey,
    requestedSinceUnixSeconds,
    checkpointUnixSeconds: checkpoint.lastProcessedAtUnixSeconds,
    gapSeconds,
  };
};

export const createBackfillRequest = (
  timelineKey: string,
  sinceUnixSeconds: number,
  gap: boolean | SyncGap
): BackfillRequest => {
  if (gap) {
    const targetedSince = typeof gap === "boolean"
      ? sinceUnixSeconds
      : Math.max(
        sinceUnixSeconds,
        gap.checkpointUnixSeconds - TARGETED_BACKFILL_WINDOW_SECONDS
      );
    return {
      timelineKey,
      sinceUnixSeconds: targetedSince,
      limit: 250,
      reason: "gap_detected",
    };
  }
  return {
    timelineKey,
    sinceUnixSeconds,
    limit: 100,
    reason: "standard",
  };
};

export const repairTimelineCheckpoint = (
  timelineKey: string,
  requestedSinceUnixSeconds: number
): CheckpointRepairReport => {
  try {
    const checkpoint = getTimelineCheckpoint(timelineKey);
    if (!checkpoint) {
      return {
        result: "ok",
        timelineKey,
        repairedSinceUnixSeconds: requestedSinceUnixSeconds,
      };
    }

    const now = Math.floor(Date.now() / 1000);
    if (checkpoint.lastProcessedAtUnixSeconds > now + 60) {
      const repairedSinceUnixSeconds = Math.max(requestedSinceUnixSeconds, now - TARGETED_BACKFILL_WINDOW_SECONDS);
      updateTimelineCheckpoint(timelineKey, now);
      return {
        result: "repaired",
        timelineKey,
        repairedSinceUnixSeconds,
        message: "Checkpoint was in the future and has been repaired.",
      };
    }

    if (checkpoint.lastProcessedAtUnixSeconds < 0) {
      const repairedSinceUnixSeconds = Math.max(0, requestedSinceUnixSeconds);
      updateTimelineCheckpoint(timelineKey, repairedSinceUnixSeconds);
      return {
        result: "repaired",
        timelineKey,
        repairedSinceUnixSeconds,
        message: "Checkpoint was negative and has been repaired.",
      };
    }

    return {
      result: "ok",
      timelineKey,
      repairedSinceUnixSeconds: requestedSinceUnixSeconds,
    };
  } catch (error) {
    return {
      result: "failed",
      timelineKey,
      repairedSinceUnixSeconds: requestedSinceUnixSeconds,
      message: error instanceof Error ? error.message : String(error),
    };
  }
};

export const resetTimelineCheckpointsForTests = (): void => {
  const root = globalThis as Record<string, unknown>;
  root[GLOBAL_CHECKPOINTS_KEY] = new Map<string, TimelineCheckpoint>();
  if (typeof window !== "undefined") {
    window.localStorage.removeItem(getStorageKey());
  }
};

export const syncCheckpointInternals = {
  getStorageKey,
  loadPersistedCheckpointState,
  persistCheckpointState,
  fromPersistedState,
  toPersistedState,
};
