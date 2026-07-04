import type { EngineInvokeRequest } from "./host-engine-port";

/** Canonical DM engine method names — host invokes only these strings. */
export const DM_ENGINE_METHODS = {
  getThread: "getThread",
  listConversations: "listConversations",
} as const;

export type DmEngineMethod = (typeof DM_ENGINE_METHODS)[keyof typeof DM_ENGINE_METHODS];

export type DmGetThreadPayload = Readonly<{
  conversationId: string;
  limit?: number;
  beforeReceivedAt?: number;
}>;

export type DmListConversationsPayload = Readonly<Record<string, never>>;

export const isDmEngineMethod = (method: string): method is DmEngineMethod => (
  method === DM_ENGINE_METHODS.getThread
  || method === DM_ENGINE_METHODS.listConversations
);

export const buildDmGetThreadRequest = (params: Readonly<{
  profileId: string;
  windowLabel?: string;
  payload: DmGetThreadPayload;
}>): EngineInvokeRequest => ({
  engine: "dm",
  method: DM_ENGINE_METHODS.getThread,
  scope: {
    profileId: params.profileId,
    ...(params.windowLabel ? { windowLabel: params.windowLabel } : {}),
  },
  payload: params.payload,
});

export const buildDmListConversationsRequest = (params: Readonly<{
  profileId: string;
  windowLabel?: string;
}>): EngineInvokeRequest => ({
  engine: "dm",
  method: DM_ENGINE_METHODS.listConversations,
  scope: {
    profileId: params.profileId,
    ...(params.windowLabel ? { windowLabel: params.windowLabel } : {}),
  },
  payload: {},
});
