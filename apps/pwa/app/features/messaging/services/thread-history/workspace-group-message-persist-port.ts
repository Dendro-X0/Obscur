/**
 * U2 Wave B — sole product bridge for native group-message SQLite via workspace-engine.
 * @see specs/backend/community-u2-group-persist-engine-design-2026-07.md
 */
import type { GroupMessageRecord, GroupTombstoneRecord } from "@dweb/db";
import { isTauri } from "@dweb/db";
import { createTauriEngineHost } from "@obscur/engine-host/tauri";
import type { HostEnginePort } from "@obscur/engine-contracts";
import {
  insertWorkspaceGroupMessage,
  insertWorkspaceGroupTombstone,
  listWorkspaceGroupMessages,
} from "@obscur/workspace-engine";

let workspaceGroupMessagePersistHost: HostEnginePort | null = null;

/** Slice 3b: kind-5 / hide paths re-insert the same tombstone → IPC storm. */
const insertedGroupTombstoneKeys = new Set<string>();

const getWorkspaceGroupMessagePersistHost = (): HostEnginePort => {
  workspaceGroupMessagePersistHost ??= createTauriEngineHost();
  return workspaceGroupMessagePersistHost;
};

/** Test seam — inject mock HostEnginePort between vitest cases. */
export const workspaceGroupMessagePersistPortInternals = {
  resetEngineHostForTests: (): void => {
    workspaceGroupMessagePersistHost = null;
    insertedGroupTombstoneKeys.clear();
  },
  setEngineHostForTests: (host: HostEnginePort | null): void => {
    workspaceGroupMessagePersistHost = host;
  },
};

export const listWorkspaceGroupMessageRecords = async (params: Readonly<{
  profileId: string;
  groupId: string;
  limit?: number;
  beforeReceivedAt?: number;
}>): Promise<ReadonlyArray<GroupMessageRecord>> => {
  if (!isTauri()) {
    return [];
  }
  return listWorkspaceGroupMessages({
    host: getWorkspaceGroupMessagePersistHost(),
    profileId: params.profileId,
    groupId: params.groupId,
    limit: params.limit,
    beforeReceivedAt: params.beforeReceivedAt,
  });
};

export const insertWorkspaceGroupMessageRecord = async (
  message: GroupMessageRecord,
): Promise<void> => {
  if (!isTauri()) {
    return;
  }
  await insertWorkspaceGroupMessage({
    host: getWorkspaceGroupMessagePersistHost(),
    profileId: message.profile_id,
    message,
  });
};

export const insertWorkspaceGroupTombstoneRecord = async (
  tombstone: GroupTombstoneRecord,
): Promise<void> => {
  if (!isTauri()) {
    return;
  }
  const dedupeKey = `${tombstone.profile_id.trim()}:${tombstone.event_id.trim()}`;
  if (!tombstone.event_id.trim() || insertedGroupTombstoneKeys.has(dedupeKey)) {
    return;
  }
  insertedGroupTombstoneKeys.add(dedupeKey);
  await insertWorkspaceGroupTombstone({
    host: getWorkspaceGroupMessagePersistHost(),
    profileId: tombstone.profile_id,
    tombstone,
  });
};
