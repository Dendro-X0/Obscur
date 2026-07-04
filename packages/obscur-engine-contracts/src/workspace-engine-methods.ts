import type { EngineInvokeRequest } from "./host-engine-port";

export const WORKSPACE_ENGINE_METHODS = {
  listGroups: "listGroups",
} as const;

export type WorkspaceEngineMethod = (typeof WORKSPACE_ENGINE_METHODS)[keyof typeof WORKSPACE_ENGINE_METHODS];

export type WorkspaceListGroupsPayload = Readonly<Record<string, never>>;

export const isWorkspaceEngineMethod = (method: string): method is WorkspaceEngineMethod => (
  method === WORKSPACE_ENGINE_METHODS.listGroups
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
