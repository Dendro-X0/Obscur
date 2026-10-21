import type { EngineInvokeRequest } from "./host-engine-port";

/** Canonical DM engine method names — host invokes only these strings. */
export const DM_ENGINE_METHODS = {
  getThread: "getThread",
  listConversations: "listConversations",
  insertMessage: "insertMessage",
  upsertConversation: "upsertConversation",
  listTombstones: "listTombstones",
  insertTombstone: "insertTombstone",
  /** Batch insert — one IPC for many tombstones (unlock hydrate stampede cut). */
  insertTombstones: "insertTombstones",
  deleteAllTombstones: "deleteAllTombstones",
  deleteMessages: "deleteMessages",
  deleteMessage: "deleteMessage",
} as const;

export type DmEngineMethod = (typeof DM_ENGINE_METHODS)[keyof typeof DM_ENGINE_METHODS];

export type DmGetThreadPayload = Readonly<{
  conversationId: string;
  limit?: number;
  beforeReceivedAt?: number;
}>;

export type DmListConversationsPayload = Readonly<Record<string, never>>;

export type DmListTombstonesPayload = Readonly<Record<string, never>>;

/** Mirrors Rust/SQLite `TombstoneRecord` (snake_case wire). */
export type DmInsertTombstonePayload = Readonly<{
  event_id: string;
  profile_id: string;
  deleted_at: number;
  deleted_by: string;
}>;

/** Wire payload for `insertTombstones` — array of tombstone records. */
export type DmInsertTombstonesPayload = Readonly<{
  records: ReadonlyArray<DmInsertTombstonePayload>;
}>;

export type DmDeleteAllTombstonesPayload = Readonly<Record<string, never>>;

export type DmDeleteMessagesPayload = Readonly<{
  eventIds: ReadonlyArray<string>;
}>;

export type DmDeleteMessagePayload = Readonly<{
  eventId: string;
}>;

export const isDmEngineMethod = (method: string): method is DmEngineMethod => (
  method === DM_ENGINE_METHODS.getThread
  || method === DM_ENGINE_METHODS.listConversations
  || method === DM_ENGINE_METHODS.insertMessage
  || method === DM_ENGINE_METHODS.upsertConversation
  || method === DM_ENGINE_METHODS.listTombstones
  || method === DM_ENGINE_METHODS.insertTombstone
  || method === DM_ENGINE_METHODS.insertTombstones
  || method === DM_ENGINE_METHODS.deleteAllTombstones
  || method === DM_ENGINE_METHODS.deleteMessages
  || method === DM_ENGINE_METHODS.deleteMessage
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

export const buildDmListTombstonesRequest = (params: Readonly<{
  profileId: string;
  windowLabel?: string;
}>): EngineInvokeRequest => ({
  engine: "dm",
  method: DM_ENGINE_METHODS.listTombstones,
  scope: {
    profileId: params.profileId,
    ...(params.windowLabel ? { windowLabel: params.windowLabel } : {}),
  },
  payload: {},
});

export const buildDmInsertTombstoneRequest = (params: Readonly<{
  profileId: string;
  windowLabel?: string;
  payload: DmInsertTombstonePayload;
}>): EngineInvokeRequest => ({
  engine: "dm",
  method: DM_ENGINE_METHODS.insertTombstone,
  scope: {
    profileId: params.profileId,
    ...(params.windowLabel ? { windowLabel: params.windowLabel } : {}),
  },
  payload: params.payload,
});

export const buildDmInsertTombstonesRequest = (params: Readonly<{
  profileId: string;
  windowLabel?: string;
  payload: DmInsertTombstonesPayload;
}>): EngineInvokeRequest => ({
  engine: "dm",
  method: DM_ENGINE_METHODS.insertTombstones,
  scope: {
    profileId: params.profileId,
    ...(params.windowLabel ? { windowLabel: params.windowLabel } : {}),
  },
  payload: params.payload,
});

export const buildDmDeleteAllTombstonesRequest = (params: Readonly<{
  profileId: string;
  windowLabel?: string;
}>): EngineInvokeRequest => ({
  engine: "dm",
  method: DM_ENGINE_METHODS.deleteAllTombstones,
  scope: {
    profileId: params.profileId,
    ...(params.windowLabel ? { windowLabel: params.windowLabel } : {}),
  },
  payload: {},
});

export const buildDmDeleteMessagesRequest = (params: Readonly<{
  profileId: string;
  windowLabel?: string;
  payload: DmDeleteMessagesPayload;
}>): EngineInvokeRequest => ({
  engine: "dm",
  method: DM_ENGINE_METHODS.deleteMessages,
  scope: {
    profileId: params.profileId,
    ...(params.windowLabel ? { windowLabel: params.windowLabel } : {}),
  },
  payload: params.payload,
});

export const buildDmDeleteMessageRequest = (params: Readonly<{
  profileId: string;
  windowLabel?: string;
  payload: DmDeleteMessagePayload;
}>): EngineInvokeRequest => ({
  engine: "dm",
  method: DM_ENGINE_METHODS.deleteMessage,
  scope: {
    profileId: params.profileId,
    ...(params.windowLabel ? { windowLabel: params.windowLabel } : {}),
  },
  payload: params.payload,
});
