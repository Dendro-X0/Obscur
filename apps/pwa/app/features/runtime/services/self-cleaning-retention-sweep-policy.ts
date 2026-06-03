/**
 * M4 — Self-cleaning retention sweep policy (single owner).
 *
 * Proactive idle compaction for vault media index and delete tombstones so
 * mobile / long-session clients do not grow unbounded localStorage indexes.
 */

import {
  MESSAGE_DELETE_TOMBSTONE_MAX_ENTRIES,
  MESSAGE_DELETE_TOMBSTONE_RETENTION_MS,
} from "@dweb/storage-contracts/message-delete-tombstones";

/** Default idle defer before first sweep after profile bootstrap. */
export const SELF_CLEANING_RETENTION_SWEEP_IDLE_DEFER_MS = 8_000;

/** Vault index cap — oldest entries evicted after age filter. */
export const LOCAL_MEDIA_INDEX_MAX_ENTRIES = 2_000;

/** Vault index age ceiling (90 days). Independent of chat message retention settings. */
export const LOCAL_MEDIA_INDEX_RETENTION_MS = 90 * 24 * 60 * 60 * 1000;

export {
  MESSAGE_DELETE_TOMBSTONE_MAX_ENTRIES,
  MESSAGE_DELETE_TOMBSTONE_RETENTION_MS,
};

export type LocalMediaIndexRetentionEntry = Readonly<{
  remoteUrl: string;
  savedAtUnixMs: number;
}>;

export type PruneLocalMediaIndexRetentionResult = Readonly<{
  keptRemoteUrls: ReadonlyArray<string>;
  removedByAge: number;
  removedByCap: number;
}>;

export const pruneLocalMediaIndexRetentionEntries = (
  entries: ReadonlyArray<LocalMediaIndexRetentionEntry>,
  nowMs: number,
  maxEntries: number = LOCAL_MEDIA_INDEX_MAX_ENTRIES,
  maxAgeMs: number = LOCAL_MEDIA_INDEX_RETENTION_MS,
): PruneLocalMediaIndexRetentionResult => {
  let removedByAge = 0;
  const withinAge = entries.filter((entry) => {
    if (!Number.isFinite(entry.savedAtUnixMs)) {
      removedByAge += 1;
      return false;
    }
    const keep = nowMs - entry.savedAtUnixMs <= maxAgeMs;
    if (!keep) {
      removedByAge += 1;
    }
    return keep;
  });

  const sorted = [...withinAge].sort((left, right) => left.savedAtUnixMs - right.savedAtUnixMs);
  let removedByCap = 0;
  if (sorted.length > maxEntries) {
    removedByCap = sorted.length - maxEntries;
    sorted.splice(0, removedByCap);
  }

  return {
    keptRemoteUrls: sorted.map((entry) => entry.remoteUrl),
    removedByAge,
    removedByCap,
  };
};

export type TombstoneRetentionSweepStats = Readonly<{
  removedCount: number;
  remainingCount: number;
}>;

export const summarizeTombstoneRetentionSweep = (
  beforeCount: number,
  afterCount: number,
): TombstoneRetentionSweepStats => ({
  removedCount: Math.max(0, beforeCount - afterCount),
  remainingCount: afterCount,
});
