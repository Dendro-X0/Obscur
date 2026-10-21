import type { GroupMessageRecord, GroupRecord, GroupTombstoneRecord } from "@dweb/db";
import type { HostEnginePort } from "@obscur/engine-contracts";
import {
  buildWorkspaceInsertGroupMessageRequest,
  buildWorkspaceInsertGroupTombstoneRequest,
  buildWorkspaceListGroupMessagesRequest,
  buildWorkspaceListGroupsRequest,
  buildWorkspaceUpsertGroupRequest,
} from "@obscur/engine-contracts";

export type ListWorkspaceGroupsParams = Readonly<{
  host: HostEnginePort;
  profileId: string;
  windowLabel?: string;
}>;

export type UpsertWorkspaceGroupParams = Readonly<{
  host: HostEnginePort;
  profileId: string;
  windowLabel?: string;
  group: GroupRecord;
}>;

export type ListWorkspaceGroupMessagesParams = Readonly<{
  host: HostEnginePort;
  profileId: string;
  windowLabel?: string;
  groupId: string;
  limit?: number;
  beforeReceivedAt?: number;
}>;

export type InsertWorkspaceGroupMessageParams = Readonly<{
  host: HostEnginePort;
  profileId: string;
  windowLabel?: string;
  message: GroupMessageRecord;
}>;

export type InsertWorkspaceGroupTombstoneParams = Readonly<{
  host: HostEnginePort;
  profileId: string;
  windowLabel?: string;
  tombstone: GroupTombstoneRecord;
}>;

export const listWorkspaceGroups = async (
  params: ListWorkspaceGroupsParams,
): Promise<ReadonlyArray<GroupRecord>> => {
  const result = await params.host.invoke(
    buildWorkspaceListGroupsRequest({
      profileId: params.profileId,
      windowLabel: params.windowLabel,
    }),
  );
  if (!result.ok) {
    throw new Error(result.errorMessage ?? result.errorCode ?? "workspace.listGroups failed");
  }
  return (result.data ?? []) as GroupRecord[];
};

export const upsertWorkspaceGroup = async (
  params: UpsertWorkspaceGroupParams,
): Promise<void> => {
  const result = await params.host.invoke(
    buildWorkspaceUpsertGroupRequest({
      profileId: params.profileId,
      windowLabel: params.windowLabel,
      group: params.group,
    }),
  );
  if (!result.ok) {
    throw new Error(result.errorMessage ?? result.errorCode ?? "workspace.upsertGroup failed");
  }
};

/** Slice 3g: sidebar preview storms share one listGroupMessages window per group. */
const LIST_GROUP_MESSAGES_CACHE_TTL_MS = 30_000;
const listWorkspaceGroupMessagesCache = new Map<string, Readonly<{
  atMs: number;
  rows: ReadonlyArray<GroupMessageRecord>;
}>>();

export const resetWorkspaceGroupMessagesCacheForTests = (): void => {
  listWorkspaceGroupMessagesCache.clear();
};

export const listWorkspaceGroupMessages = async (
  params: ListWorkspaceGroupMessagesParams,
): Promise<ReadonlyArray<GroupMessageRecord>> => {
  const cacheKey = [
    params.profileId.trim(),
    params.windowLabel?.trim() ?? "",
    params.groupId.trim(),
    typeof params.limit === "number" ? String(params.limit) : "",
    typeof params.beforeReceivedAt === "number" ? String(params.beforeReceivedAt) : "",
  ].join(":");
  const cached = listWorkspaceGroupMessagesCache.get(cacheKey);
  const nowMs = Date.now();
  if (cached && nowMs - cached.atMs < LIST_GROUP_MESSAGES_CACHE_TTL_MS) {
    return cached.rows;
  }
  const result = await params.host.invoke(
    buildWorkspaceListGroupMessagesRequest({
      profileId: params.profileId,
      windowLabel: params.windowLabel,
      payload: {
        groupId: params.groupId,
        ...(typeof params.limit === "number" ? { limit: params.limit } : {}),
        ...(typeof params.beforeReceivedAt === "number"
          ? { beforeReceivedAt: params.beforeReceivedAt }
          : {}),
      },
    }),
  );
  if (!result.ok) {
    throw new Error(result.errorMessage ?? result.errorCode ?? "workspace.listGroupMessages failed");
  }
  const rows = (result.data ?? []) as GroupMessageRecord[];
  listWorkspaceGroupMessagesCache.set(cacheKey, { atMs: nowMs, rows });
  return rows;
};

export const insertWorkspaceGroupMessage = async (
  params: InsertWorkspaceGroupMessageParams,
): Promise<void> => {
  const result = await params.host.invoke(
    buildWorkspaceInsertGroupMessageRequest({
      profileId: params.profileId,
      windowLabel: params.windowLabel,
      message: params.message,
    }),
  );
  if (!result.ok) {
    throw new Error(result.errorMessage ?? result.errorCode ?? "workspace.insertGroupMessage failed");
  }
  const prefix = `${params.profileId.trim()}:${params.windowLabel?.trim() ?? ""}:${params.message.group_id.trim()}:`;
  for (const key of listWorkspaceGroupMessagesCache.keys()) {
    if (key.startsWith(prefix)) {
      listWorkspaceGroupMessagesCache.delete(key);
    }
  }
};

export const insertWorkspaceGroupTombstone = async (
  params: InsertWorkspaceGroupTombstoneParams,
): Promise<void> => {
  const result = await params.host.invoke(
    buildWorkspaceInsertGroupTombstoneRequest({
      profileId: params.profileId,
      windowLabel: params.windowLabel,
      tombstone: params.tombstone,
    }),
  );
  if (!result.ok) {
    throw new Error(result.errorMessage ?? result.errorCode ?? "workspace.insertGroupTombstone failed");
  }
};
