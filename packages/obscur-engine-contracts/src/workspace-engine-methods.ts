import type { EngineInvokeRequest } from "./host-engine-port";

export const WORKSPACE_ENGINE_METHODS = {
  listGroups: "listGroups",
  upsertGroup: "upsertGroup",
  listGroupMessages: "listGroupMessages",
  insertGroupMessage: "insertGroupMessage",
  insertGroupTombstone: "insertGroupTombstone",
} as const;

export type WorkspaceEngineMethod = (typeof WORKSPACE_ENGINE_METHODS)[keyof typeof WORKSPACE_ENGINE_METHODS];

export type WorkspaceListGroupsPayload = Readonly<Record<string, never>>;

/** Payload is a GroupRecord (snake_case fields) — same shape as @dweb/db GroupRecord. */
export type WorkspaceUpsertGroupPayload = Readonly<{
  id: string;
  profile_id: string;
  name: string;
  relay_url: string;
  kind: string;
  joined_at: number;
}>;

export type WorkspaceListGroupMessagesPayload = Readonly<{
  groupId: string;
  limit?: number;
  beforeReceivedAt?: number;
}>;

/** Payload is a GroupMessageRecord (snake_case) — same shape as @dweb/db GroupMessageRecord. */
export type WorkspaceInsertGroupMessagePayload = Readonly<{
  event_id: string;
  group_id: string;
  profile_id: string;
  sender_pubkey: string;
  plaintext: string;
  created_at: number;
  received_at: number;
}>;

/** Payload is a GroupTombstoneRecord (snake_case) — same shape as @dweb/db GroupTombstoneRecord. */
export type WorkspaceInsertGroupTombstonePayload = Readonly<{
  event_id: string;
  profile_id: string;
  deleted_at: number;
  deleted_by: string;
}>;

export const isWorkspaceEngineMethod = (method: string): method is WorkspaceEngineMethod => (
  method === WORKSPACE_ENGINE_METHODS.listGroups
  || method === WORKSPACE_ENGINE_METHODS.upsertGroup
  || method === WORKSPACE_ENGINE_METHODS.listGroupMessages
  || method === WORKSPACE_ENGINE_METHODS.insertGroupMessage
  || method === WORKSPACE_ENGINE_METHODS.insertGroupTombstone
);

export const buildWorkspaceListGroupsRequest = (params: Readonly<{
  profileId: string;
  windowLabel?: string;
}>): EngineInvokeRequest => ({
  engine: "workspace",
  method: WORKSPACE_ENGINE_METHODS.listGroups,
  scope: {
    profileId: params.profileId,
    ...(params.windowLabel ? { windowLabel: params.windowLabel } : {}),
  },
  payload: {},
});

export const buildWorkspaceUpsertGroupRequest = (params: Readonly<{
  profileId: string;
  windowLabel?: string;
  group: WorkspaceUpsertGroupPayload;
}>): EngineInvokeRequest => ({
  engine: "workspace",
  method: WORKSPACE_ENGINE_METHODS.upsertGroup,
  scope: {
    profileId: params.profileId,
    ...(params.windowLabel ? { windowLabel: params.windowLabel } : {}),
  },
  payload: params.group,
});

export const buildWorkspaceListGroupMessagesRequest = (params: Readonly<{
  profileId: string;
  windowLabel?: string;
  payload: WorkspaceListGroupMessagesPayload;
}>): EngineInvokeRequest => ({
  engine: "workspace",
  method: WORKSPACE_ENGINE_METHODS.listGroupMessages,
  scope: {
    profileId: params.profileId,
    ...(params.windowLabel ? { windowLabel: params.windowLabel } : {}),
  },
  payload: params.payload,
});

export const buildWorkspaceInsertGroupMessageRequest = (params: Readonly<{
  profileId: string;
  windowLabel?: string;
  message: WorkspaceInsertGroupMessagePayload;
}>): EngineInvokeRequest => ({
  engine: "workspace",
  method: WORKSPACE_ENGINE_METHODS.insertGroupMessage,
  scope: {
    profileId: params.profileId,
    ...(params.windowLabel ? { windowLabel: params.windowLabel } : {}),
  },
  payload: params.message,
});

export const buildWorkspaceInsertGroupTombstoneRequest = (params: Readonly<{
  profileId: string;
  windowLabel?: string;
  tombstone: WorkspaceInsertGroupTombstonePayload;
}>): EngineInvokeRequest => ({
  engine: "workspace",
  method: WORKSPACE_ENGINE_METHODS.insertGroupTombstone,
  scope: {
    profileId: params.profileId,
    ...(params.windowLabel ? { windowLabel: params.windowLabel } : {}),
  },
  payload: params.tombstone,
});
