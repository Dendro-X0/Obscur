/**
 * Returns true when running inside Tauri (desktop).
 * Use this to guard native paths so the PWA can fall back gracefully.
 *
 * Durable SQLite writes/reads go through `@obscur/*-engine` → `engine_invoke`
 * (Rust). Bare `db_*` message/conversation IPC was tombstoned Track B 2026-10.
 * @see specs/backend/db-insert-upsert-legacy-parallel-tombstone-design-2026-10.md
 */
export const isTauri = (): boolean => {
  if (typeof window === "undefined") {
    return false;
  }
  const w = window as Window & {
    __TAURI__?: { core?: { invoke?: unknown } };
    __TAURI_INTERNALS__?: { invoke?: unknown };
    __TAURI_IPC__?: unknown;
  };
  return (
    typeof w.__TAURI_INTERNALS__?.invoke === "function"
    || typeof w.__TAURI__?.core?.invoke === "function"
    || typeof w.__TAURI_IPC__ === "function"
  );
};

// ---------------------------------------------------------------------------
// Messages / conversations — IPC tombstoned (Track B 2026-10).
// Use @obscur/dm-engine via engine_invoke dm.insertMessage / upsertConversation /
// getThread / listConversations / tombstone methods.
// ---------------------------------------------------------------------------

// Slice 15 — DM read IPC tombstoned. Use @obscur/dm-engine fetchDmThreadRows / listDmConversations.

// Slice 21 — DM delete/tombstone IPC tombstoned. Use @obscur/dm-engine
// deleteDmMessages / deleteDmMessage / insertDmTombstone(s) / listDmTombstones / deleteAllDmTombstones.

// ---------------------------------------------------------------------------
// Groups + group messages — IPC tombstoned.
// Product + backup use @obscur/workspace-engine via engine_invoke
// (listGroups / upsertGroup / listGroupMessages / insertGroupMessage / insertGroupTombstone).
// @see specs/backend/community-group-db-ipc-tombstone-design-2026-07.md
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// Call records — IPC tombstoned (Slice 19). Use @obscur/persistence-engine
// listCallRecords / upsertCallRecord via engine_invoke.
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// Relay checkpoints — IPC tombstoned (Slice 11). Use @obscur/transport-engine
// listRelayCheckpoints / upsertRelayCheckpoint via engine_invoke.
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// Vault media index — IPC tombstoned (Slice 17). Use @obscur/persistence-engine
// listVaultMediaIndex / upsertVaultMediaIndex / delete* via engine_invoke.
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// Unified FTS5 search + profile wipe — IPC tombstoned (Slice 23).
// Use @obscur/persistence-engine searchMessages / wipeProfileLocalData.
// ---------------------------------------------------------------------------

export type WipeProfileLocalDataReport = Readonly<{
  profile_id: string;
  rows_deleted: number;
  profile_row_deleted: boolean;
}>;
