import type { EngineInvokeRequest } from "./host-engine-port";

/** Canonical persistence-engine method names — host invokes only these strings. */
export const PERSISTENCE_ENGINE_METHODS = {
  listVaultMediaIndex: "listVaultMediaIndex",
  upsertVaultMediaIndex: "upsertVaultMediaIndex",
  deleteVaultMediaIndex: "deleteVaultMediaIndex",
  deleteAllVaultMediaIndex: "deleteAllVaultMediaIndex",
  listCallRecords: "listCallRecords",
  upsertCallRecord: "upsertCallRecord",
  searchMessages: "searchMessages",
  wipeProfileLocalData: "wipeProfileLocalData",
} as const;

export type PersistenceEngineMethod =
  (typeof PERSISTENCE_ENGINE_METHODS)[keyof typeof PERSISTENCE_ENGINE_METHODS];

export type PersistenceListVaultMediaIndexPayload = Readonly<Record<string, never>>;

/** Mirrors Rust/SQLite `VaultMediaIndexRecord` (snake_case wire). */
export type PersistenceUpsertVaultMediaIndexPayload = Readonly<{
  remote_url: string;
  profile_id: string;
  relative_path: string;
  saved_at_unix_ms: number;
  file_name: string;
  content_type: string;
  size_bytes: number;
  message_event_id?: string | null;
  explicit_chat_save: boolean;
}>;

export type PersistenceDeleteVaultMediaIndexPayload = Readonly<{
  remote_url: string;
}>;

export type PersistenceListCallRecordsPayload = Readonly<Record<string, never>>;

/** Mirrors Rust/SQLite `CallRecord` (snake_case wire). */
export type PersistenceUpsertCallRecordPayload = Readonly<{
  call_id: string;
  profile_id: string;
  peer_pubkey: string;
  initiated_by: string;
  status: string;
  started_at?: number | null;
  ended_at?: number | null;
  duration_ms?: number | null;
}>;

export type PersistenceSearchMessagesPayload = Readonly<{
  query: string;
  limit?: number;
}>;

export type PersistenceWipeProfileLocalDataPayload = Readonly<{
  removeProfileRow?: boolean;
}>;

/** Mirrors Rust `WipeProfileLocalDataReport` (snake_case wire). */
export type PersistenceWipeProfileLocalDataReport = Readonly<{
  profile_id: string;
  rows_deleted: number;
  profile_row_deleted: boolean;
}>;

export const isPersistenceEngineMethod = (method: string): method is PersistenceEngineMethod => (
  method === PERSISTENCE_ENGINE_METHODS.listVaultMediaIndex
  || method === PERSISTENCE_ENGINE_METHODS.upsertVaultMediaIndex
  || method === PERSISTENCE_ENGINE_METHODS.deleteVaultMediaIndex
  || method === PERSISTENCE_ENGINE_METHODS.deleteAllVaultMediaIndex
  || method === PERSISTENCE_ENGINE_METHODS.listCallRecords
  || method === PERSISTENCE_ENGINE_METHODS.upsertCallRecord
  || method === PERSISTENCE_ENGINE_METHODS.searchMessages
  || method === PERSISTENCE_ENGINE_METHODS.wipeProfileLocalData
);

export const buildPersistenceListVaultMediaIndexRequest = (params: Readonly<{
  profileId: string;
  windowLabel?: string;
}>): EngineInvokeRequest => ({
  engine: "persistence",
  method: PERSISTENCE_ENGINE_METHODS.listVaultMediaIndex,
  scope: {
    profileId: params.profileId,
    ...(params.windowLabel ? { windowLabel: params.windowLabel } : {}),
  },
  payload: {},
});

export const buildPersistenceUpsertVaultMediaIndexRequest = (params: Readonly<{
  profileId: string;
  windowLabel?: string;
  payload: PersistenceUpsertVaultMediaIndexPayload;
}>): EngineInvokeRequest => ({
  engine: "persistence",
  method: PERSISTENCE_ENGINE_METHODS.upsertVaultMediaIndex,
  scope: {
    profileId: params.profileId,
    ...(params.windowLabel ? { windowLabel: params.windowLabel } : {}),
  },
  payload: params.payload,
});

export const buildPersistenceDeleteVaultMediaIndexRequest = (params: Readonly<{
  profileId: string;
  windowLabel?: string;
  payload: PersistenceDeleteVaultMediaIndexPayload;
}>): EngineInvokeRequest => ({
  engine: "persistence",
  method: PERSISTENCE_ENGINE_METHODS.deleteVaultMediaIndex,
  scope: {
    profileId: params.profileId,
    ...(params.windowLabel ? { windowLabel: params.windowLabel } : {}),
  },
  payload: params.payload,
});

export const buildPersistenceDeleteAllVaultMediaIndexRequest = (params: Readonly<{
  profileId: string;
  windowLabel?: string;
}>): EngineInvokeRequest => ({
  engine: "persistence",
  method: PERSISTENCE_ENGINE_METHODS.deleteAllVaultMediaIndex,
  scope: {
    profileId: params.profileId,
    ...(params.windowLabel ? { windowLabel: params.windowLabel } : {}),
  },
  payload: {},
});

export const buildPersistenceListCallRecordsRequest = (params: Readonly<{
  profileId: string;
  windowLabel?: string;
}>): EngineInvokeRequest => ({
  engine: "persistence",
  method: PERSISTENCE_ENGINE_METHODS.listCallRecords,
  scope: {
    profileId: params.profileId,
    ...(params.windowLabel ? { windowLabel: params.windowLabel } : {}),
  },
  payload: {},
});

export const buildPersistenceUpsertCallRecordRequest = (params: Readonly<{
  profileId: string;
  windowLabel?: string;
  payload: PersistenceUpsertCallRecordPayload;
}>): EngineInvokeRequest => ({
  engine: "persistence",
  method: PERSISTENCE_ENGINE_METHODS.upsertCallRecord,
  scope: {
    profileId: params.profileId,
    ...(params.windowLabel ? { windowLabel: params.windowLabel } : {}),
  },
  payload: params.payload,
});

export const buildPersistenceSearchMessagesRequest = (params: Readonly<{
  profileId: string;
  windowLabel?: string;
  payload: PersistenceSearchMessagesPayload;
}>): EngineInvokeRequest => ({
  engine: "persistence",
  method: PERSISTENCE_ENGINE_METHODS.searchMessages,
  scope: {
    profileId: params.profileId,
    ...(params.windowLabel ? { windowLabel: params.windowLabel } : {}),
  },
  payload: params.payload,
});

export const buildPersistenceWipeProfileLocalDataRequest = (params: Readonly<{
  profileId: string;
  windowLabel?: string;
  payload?: PersistenceWipeProfileLocalDataPayload;
}>): EngineInvokeRequest => ({
  engine: "persistence",
  method: PERSISTENCE_ENGINE_METHODS.wipeProfileLocalData,
  scope: {
    profileId: params.profileId,
    ...(params.windowLabel ? { windowLabel: params.windowLabel } : {}),
  },
  payload: {
    removeProfileRow: params.payload?.removeProfileRow === true,
  },
});
