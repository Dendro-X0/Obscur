import { getScopedStorageKey } from "@/app/features/profiles/services/profile-scope";
import { getResolvedProfileId } from "@/app/features/profiles/services/profile-runtime-scope";
import { requiresSqlitePersistence } from "@/app/features/runtime/native-persistence-policy";
import {
  DM_ALL_TIMELINE_KEY,
  loadSqliteRelayCheckpointFrontier,
  mirrorTimelineCheckpointToSqlite,
} from "../services/relay-checkpoint-sqlite-store";

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

const GLOBAL_CHECKPOINTS_BY_PROFILE_KEY = "__obscur_sync_checkpoints_by_profile__";
const STORAGE_KEY = "obscur.messaging.sync_checkpoints.v1";

const resolveProfileScope = (profileId?: string): string => profileId ?? getResolvedProfileId();
const GAP_DETECTION_THRESHOLD_SECONDS = 6 * 60 * 60;
const TARGETED_BACKFILL_WINDOW_SECONDS = 2 * 60 * 60;

type PersistedCheckpointState = Readonly<{
  version: 1;
  checkpoints: ReadonlyArray<TimelineCheckpoint>;
}>;

const getStorageKey = (profileId?: string): string => (
  getScopedStorageKey(STORAGE_KEY, resolveProfileScope(profileId))
);

const getCheckpointRoot = (): Map<string, Map<string, TimelineCheckpoint>> => {
  const root = globalThis as Record<string, unknown>;
  const existing = root[GLOBAL_CHECKPOINTS_BY_PROFILE_KEY];
  if (existing instanceof Map) {
    return existing as Map<string, Map<string, TimelineCheckpoint>>;
  }
  const next = new Map<string, Map<string, TimelineCheckpoint>>();
  root[GLOBAL_CHECKPOINTS_BY_PROFILE_KEY] = next;
  return next;
};

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

const loadPersistedCheckpointState = (profileId?: string): Map<string, TimelineCheckpoint> => {
  if (typeof window === "undefined") {
    return new Map<string, TimelineCheckpoint>();
  }
  try {
    const raw = window.localStorage.getItem(getStorageKey(profileId));
    if (!raw) {
      return new Map<string, TimelineCheckpoint>();
    }
    return fromPersistedState(JSON.parse(raw));
  } catch {
    return new Map<string, TimelineCheckpoint>();
  }
};

export const bootstrapTimelineCheckpointsFromSqlite = async (profileId?: string): Promise<boolean> => {
  if (!requiresSqlitePersistence()) {
    return false;
  }
  const scope = resolveProfileScope(profileId);
  if (loadPersistedCheckpointState(profileId).size > 0) {
    return false;
  }
  const frontierUnixSeconds = await loadSqliteRelayCheckpointFrontier(scope);
  if (frontierUnixSeconds === null) {
    return false;
  }
  const state = getCheckpointState(profileId);
  if (state.has(DM_ALL_TIMELINE_KEY)) {
    return false;
  }
  state.set(DM_ALL_TIMELINE_KEY, {
    timelineKey: DM_ALL_TIMELINE_KEY,
    lastProcessedAtUnixSeconds: frontierUnixSeconds,
    updatedAtUnixMs: Date.now(),
  });
  persistCheckpointState(state, profileId);
  return true;
};

const persistCheckpointState = (
  state: Map<string, TimelineCheckpoint>,
  profileId?: string,
  options?: Readonly<{ relayUrls?: ReadonlyArray<string> }>,
): void => {
  if (typeof window === "undefined") {
    return;
  }
  try {
    window.localStorage.setItem(getStorageKey(profileId), JSON.stringify(toPersistedState(state)));
  } catch {
    // Keep sync bookkeeping non-throwing during degraded storage conditions.
  }

  const dmAllCheckpoint = state.get(DM_ALL_TIMELINE_KEY);
  if (!dmAllCheckpoint || !options?.relayUrls?.length) {
    return;
  }
  void mirrorTimelineCheckpointToSqlite({
    profileId: resolveProfileScope(profileId),
    timelineKey: DM_ALL_TIMELINE_KEY,
    lastProcessedAtUnixSeconds: dmAllCheckpoint.lastProcessedAtUnixSeconds,
    relayUrls: options.relayUrls,
  }).catch(() => undefined);
};

const getCheckpointState = (profileId?: string): Map<string, TimelineCheckpoint> => {
  const scope = resolveProfileScope(profileId);
  const root = getCheckpointRoot();
  const existing = root.get(scope);
  if (existing instanceof Map) {
    return existing;
  }
  const next = loadPersistedCheckpointState(profileId);
  root.set(scope, next);
  return next;
};

export const getTimelineCheckpoint = (timelineKey: string, profileId?: string): TimelineCheckpoint | null => {
  const value = getCheckpointState(profileId).get(timelineKey);
  return value ?? null;
};

export const updateTimelineCheckpoint = (
  timelineKey: string,
  lastProcessedAtUnixSeconds: number,
  profileId?: string,
  options?: Readonly<{ relayUrls?: ReadonlyArray<string> }>,
): TimelineCheckpoint => {
  const next: TimelineCheckpoint = {
    timelineKey,
    lastProcessedAtUnixSeconds,
    updatedAtUnixMs: Date.now(),
  };
  const state = getCheckpointState(profileId);
  state.set(timelineKey, next);
  persistCheckpointState(state, profileId, options);
  return next;
};

export const detectSyncGap = (
  timelineKey: string,
  requestedSinceUnixSeconds: number,
  profileId?: string,
): SyncGap | null => {
  const checkpoint = getTimelineCheckpoint(timelineKey, profileId);
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
  requestedSinceUnixSeconds: number,
  profileId?: string,
): CheckpointRepairReport => {
  try {
    const checkpoint = getTimelineCheckpoint(timelineKey, profileId);
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
      updateTimelineCheckpoint(timelineKey, now, profileId);
      return {
        result: "repaired",
        timelineKey,
        repairedSinceUnixSeconds,
        message: "Checkpoint was in the future and has been repaired.",
      };
    }

    if (checkpoint.lastProcessedAtUnixSeconds < 0) {
      const repairedSinceUnixSeconds = Math.max(0, requestedSinceUnixSeconds);
      updateTimelineCheckpoint(timelineKey, repairedSinceUnixSeconds, profileId);
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

export const resetTimelineCheckpointsForTests = (profileId?: string): void => {
  const scope = resolveProfileScope(profileId);
  getCheckpointRoot().delete(scope);
  if (typeof window !== "undefined") {
    window.localStorage.removeItem(getStorageKey(profileId));
  }
};

export const syncCheckpointInternals = {
  getStorageKey,
  loadPersistedCheckpointState,
  persistCheckpointState,
  fromPersistedState,
  toPersistedState,
};
