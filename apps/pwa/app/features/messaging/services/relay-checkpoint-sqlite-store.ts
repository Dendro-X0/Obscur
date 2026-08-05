/**
 * ACC-03 — Native relay checkpoint owner (SQLite authority, localStorage mirror).
 *
 * Timeline checkpoints in sync-checkpoints.ts remain the app contract; on native
 * we mirror `dm:all` progress into per-relay SQLite rows for restart survival.
 * Reads/writes go through transport engine_invoke.
 */

import {
  isTauri,
  type RelayCheckpointRecord,
} from "@dweb/db";
import { listRelayCheckpoints, upsertRelayCheckpoint } from "@obscur/transport-engine";
import { requiresSqlitePersistence } from "@/app/features/runtime/native-persistence-policy";
import { getTransportEngineHost } from "@/app/features/transport-kernel/transport-engine-host-port";

export const DM_ALL_TIMELINE_KEY = "dm:all";

const normalizeRelayUrl = (relayUrl: string): string => relayUrl.trim();

export const resolveSqliteRelayCheckpointFrontier = (
  records: ReadonlyArray<RelayCheckpointRecord>,
): number | null => {
  if (records.length === 0) {
    return null;
  }
  return records.reduce(
    (max, record) => Math.max(max, record.last_event_at),
    0,
  );
};

export const mirrorTimelineCheckpointToSqlite = async (params: Readonly<{
  profileId: string;
  timelineKey: string;
  lastProcessedAtUnixSeconds: number;
  relayUrls: ReadonlyArray<string>;
}>): Promise<void> => {
  if (!requiresSqlitePersistence() || !isTauri()) {
    return;
  }
  if (params.timelineKey !== DM_ALL_TIMELINE_KEY) {
    return;
  }
  const host = getTransportEngineHost();
  if (!host) {
    return;
  }
  const relayUrls = Array.from(new Set(
    params.relayUrls.map(normalizeRelayUrl).filter((url) => url.length > 0),
  ));
  if (relayUrls.length === 0) {
    return;
  }
  await Promise.all(relayUrls.map((relayUrl) => (
    upsertRelayCheckpoint({
      host,
      profileId: params.profileId,
      checkpoint: {
        profile_id: params.profileId,
        relay_url: relayUrl,
        last_event_at: params.lastProcessedAtUnixSeconds,
      },
    }).catch(() => undefined)
  )));
};

export const loadSqliteRelayCheckpointFrontier = async (
  profileId: string,
): Promise<number | null> => {
  if (!requiresSqlitePersistence() || !isTauri()) {
    return null;
  }
  const host = getTransportEngineHost();
  if (!host) {
    return null;
  }
  try {
    const records = await listRelayCheckpoints({ host, profileId });
    return resolveSqliteRelayCheckpointFrontier(records);
  } catch {
    return null;
  }
};
