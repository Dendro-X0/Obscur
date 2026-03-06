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

const GLOBAL_CHECKPOINTS_KEY = "__obscur_sync_checkpoints__";
const GAP_DETECTION_THRESHOLD_SECONDS = 6 * 60 * 60;
const TARGETED_BACKFILL_WINDOW_SECONDS = 2 * 60 * 60;

const getCheckpointState = (): Map<string, TimelineCheckpoint> => {
  const root = globalThis as Record<string, unknown>;
  const existing = root[GLOBAL_CHECKPOINTS_KEY];
  if (existing instanceof Map) {
    return existing as Map<string, TimelineCheckpoint>;
  }
  const next = new Map<string, TimelineCheckpoint>();
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
  getCheckpointState().set(timelineKey, next);
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

export const resetTimelineCheckpointsForTests = (): void => {
  const root = globalThis as Record<string, unknown>;
  root[GLOBAL_CHECKPOINTS_KEY] = new Map<string, TimelineCheckpoint>();
};
