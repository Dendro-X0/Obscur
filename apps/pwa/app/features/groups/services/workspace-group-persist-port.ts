/**
 * U2 Wave A — sole product bridge for native group-list SQLite via workspace-engine.
 * @see specs/backend/community-u2-group-persist-engine-design-2026-07.md
 */
import type { GroupRecord } from "@dweb/db";
import { isTauri } from "@dweb/db";
import { createTauriEngineHost } from "@obscur/engine-host/tauri";
import type { HostEnginePort } from "@obscur/engine-contracts";
import { listWorkspaceGroups, upsertWorkspaceGroup } from "@obscur/workspace-engine";

let workspaceGroupPersistHost: HostEnginePort | null = null;

const getWorkspaceGroupPersistHost = (): HostEnginePort => {
  workspaceGroupPersistHost ??= createTauriEngineHost();
  return workspaceGroupPersistHost;
};

/** Test seam — inject mock HostEnginePort between vitest cases. */
export const workspaceGroupPersistPortInternals = {
  resetEngineHostForTests: (): void => {
    workspaceGroupPersistHost = null;
  },
  setEngineHostForTests: (host: HostEnginePort | null): void => {
    workspaceGroupPersistHost = host;
  },
};

export const listWorkspaceGroupRecords = async (
  profileId: string,
): Promise<ReadonlyArray<GroupRecord>> => {
  if (!isTauri()) {
    return [];
  }
  return listWorkspaceGroups({
    host: getWorkspaceGroupPersistHost(),
    profileId,
  });
};

export const upsertWorkspaceGroupRecord = async (
  group: GroupRecord,
): Promise<void> => {
  if (!isTauri()) {
    return;
  }
  await upsertWorkspaceGroup({
    host: getWorkspaceGroupPersistHost(),
    profileId: group.profile_id,
    group,
  });
};
