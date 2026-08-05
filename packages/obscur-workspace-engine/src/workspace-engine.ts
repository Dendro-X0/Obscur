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

export const listWorkspaceGroupMessages = async (
  params: ListWorkspaceGroupMessagesParams,
): Promise<ReadonlyArray<GroupMessageRecord>> => {
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
  return (result.data ?? []) as GroupMessageRecord[];
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
