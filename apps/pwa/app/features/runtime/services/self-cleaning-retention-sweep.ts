"use client";

import { pruneLocalMediaIndexRetention } from "@/app/features/vault/services/local-media-store";
import { sweepMessageDeleteTombstones } from "@/app/features/messaging/services/message-delete-tombstone-store";
import { scheduleIdleWork } from "@/app/shared/schedule-idle-work";
import { SELF_CLEANING_RETENTION_SWEEP_IDLE_DEFER_MS } from "./self-cleaning-retention-sweep-policy";

export type SelfCleaningRetentionSweepResult = Readonly<{
  vaultIndex: Readonly<{
    removedByAge: number;
    removedByCap: number;
    remaining: number;
  }>;
  tombstones: Readonly<{
    removedCount: number;
    remainingCount: number;
  }>;
}>;

/**
 * Run vault index + tombstone TTL compaction for the active profile scope.
 * Safe to call from idle work — non-throwing.
 */
export const runSelfCleaningRetentionSweep = async (
  params: Readonly<{ profileId?: string; nowMs?: number }> = {},
): Promise<SelfCleaningRetentionSweepResult> => {
  const nowMs = params.nowMs ?? Date.now();
  const vaultIndex = pruneLocalMediaIndexRetention(nowMs, params.profileId);
  const tombstones = sweepMessageDeleteTombstones(params.profileId, nowMs);
  return { vaultIndex, tombstones };
};

/** Schedule idle retention sweep after profile bootstrap (returns cancel handle). */
export const scheduleSelfCleaningRetentionSweep = (
  profileId?: string,
): (() => void) => (
  scheduleIdleWork(() => {
    void runSelfCleaningRetentionSweep({ profileId }).catch(() => {});
  }, SELF_CLEANING_RETENTION_SWEEP_IDLE_DEFER_MS)
);
