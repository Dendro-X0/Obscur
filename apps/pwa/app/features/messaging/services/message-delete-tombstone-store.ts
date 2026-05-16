"use client";

import { createMessageDeleteTombstoneIndexedDbPersistence } from "@dweb/storage/message-delete-tombstones-indexed-db";
import type { MessageDeleteTombstonePersistencePort } from "@dweb/storage-contracts/message-delete-tombstones";
import {
  MESSAGE_DELETE_TOMBSTONE_STORAGE_KEY,
  MESSAGE_DELETE_TOMBSTONE_MAX_ENTRIES,
  MESSAGE_DELETE_TOMBSTONE_RETENTION_MS,
  mergeMessageDeleteTombstoneStates,
  normalizeMessageDeleteTombstoneEntries,
  normalizeMessageDeleteTombstoneState,
  emptyMessageDeleteTombstoneState,
  type MessageDeleteTombstoneEntry,
  type MessageDeleteTombstoneState,
} from "@dweb/storage-contracts/message-delete-tombstones";
import type { TombstoneRecord } from "@dweb/db";
import {
  dbDeleteAllTombstonesForProfile,
  dbGetTombstones,
  dbInsertTombstone,
  isTauri,
} from "@dweb/db";
import {
  capacitorDbDeleteAllTombstonesForProfile,
  capacitorDbGetTombstones,
  capacitorDbInsertTombstone,
} from "./capacitor-sqlite-tombstones-adapter";
import { getScopedStorageKey } from "@/app/features/profiles/services/profile-scope";
import { getResolvedProfileId } from "@/app/features/profiles/services/profile-runtime-scope";
import { emitAccountSyncMutation } from "@/app/shared/account-sync-mutation-signal";

export type { MessageDeleteTombstoneEntry, MessageDeleteTombstoneState };

export {
  MESSAGE_DELETE_TOMBSTONE_STORAGE_KEY,
  normalizeMessageDeleteTombstoneEntries,
  normalizeMessageDeleteTombstoneState,
  mergeMessageDeleteTombstoneStates,
};

const STORAGE_KEY = MESSAGE_DELETE_TOMBSTONE_STORAGE_KEY;

let indexedDbPort: MessageDeleteTombstonePersistencePort | null = null;

const getIndexedDbPort = (): MessageDeleteTombstonePersistencePort | null => {
  if (typeof indexedDB === "undefined") {
    return null;
  }
  if (!indexedDbPort) {
    indexedDbPort = createMessageDeleteTombstoneIndexedDbPersistence();
  }
  return indexedDbPort;
};

/** In-process cache for desktop SQLite-backed tombstones (localStorage is not authoritative on Tauri). */
const nativeTombstoneCache = new Map<string, MessageDeleteTombstoneState>();

// Mobile native environments (Capacitor SQLite) will set this to true after the first successful hydrate.
let capacitorSqliteEnabled = false;

const isNativeSqliteEnabled = (): boolean => isTauri() || capacitorSqliteEnabled;

let tauriTombstoneTail: Promise<void> = Promise.resolve();

const runTauriTombstoneWork = (fn: () => Promise<void>): Promise<void> => {
  const next = tauriTombstoneTail.then(fn).catch(() => {});
  tauriTombstoneTail = next.then(() => {});
  return next;
};

const resolveProfileId = (profileId?: string): string => {
  const trimmed = profileId?.trim();
  if (trimmed) {
    return trimmed;
  }
  return getResolvedProfileId();
};

const tombstoneRecordsToState = (
  rows: ReadonlyArray<TombstoneRecord>,
  nowMs: number,
): MessageDeleteTombstoneState => (
  normalizeMessageDeleteTombstoneState({
    entries: rows.map((row) => ({
      id: row.event_id,
      deletedAtUnixMs: row.deleted_at,
    })),
  }, nowMs)
);

const persistMergedStateToSqlite = async (
  profileId: string,
  merged: MessageDeleteTombstoneState,
): Promise<void> => {
  for (const entry of merged.entries) {
    await dbInsertTombstone({
      event_id: entry.id,
      profile_id: profileId,
      deleted_at: entry.deletedAtUnixMs,
      deleted_by: "",
    });
  }
};

const getTombstonesFromNativeSqlite = async (
  profileId: string,
): Promise<ReadonlyArray<TombstoneRecord>> => {
  if (isTauri()) {
    return dbGetTombstones(profileId);
  }
  return capacitorDbGetTombstones(profileId);
};

const persistMergedStateToNativeSqlite = async (
  profileId: string,
  merged: MessageDeleteTombstoneState,
): Promise<void> => {
  if (isTauri()) {
    await persistMergedStateToSqlite(profileId, merged);
    return;
  }
  for (const entry of merged.entries) {
    await capacitorDbInsertTombstone({
      event_id: entry.id,
      profile_id: profileId,
      deleted_at: entry.deletedAtUnixMs,
      deleted_by: "",
    });
  }
};

const deleteAllTombstonesForNativeSqlite = async (
  profileId: string,
): Promise<void> => {
  if (isTauri()) {
    await dbDeleteAllTombstonesForProfile(profileId);
    return;
  }
  await capacitorDbDeleteAllTombstonesForProfile(profileId);
};

const getStorage = (): Storage | null => {
  const storageCandidate = globalThis.localStorage;
  if (!storageCandidate) {
    return null;
  }
  return storageCandidate;
};

const getScopeKey = (profileId?: string): string => (
  getScopedStorageKey(STORAGE_KEY, profileId)
);

const flushToIndexedDb = (scopeKey: string, state: MessageDeleteTombstoneState): void => {
  if (isNativeSqliteEnabled()) {
    return;
  }
  const port = getIndexedDbPort();
  if (!port) return;
  void port.saveState({ scopeKey, state }).catch(() => {
    // Non-blocking: localStorage remains authoritative for sync callers.
  });
};

const tombstoneEntriesEqual = (
  a: MessageDeleteTombstoneState,
  b: MessageDeleteTombstoneState,
): boolean => {
  if (a.entries.length !== b.entries.length) {
    return false;
  }
  return a.entries.every((entry, index) => (
    entry.id === b.entries[index]?.id
    && entry.deletedAtUnixMs === b.entries[index]?.deletedAtUnixMs
  ));
};

const readState = (
  nowMs: number = Date.now(),
  profileId?: string,
): MessageDeleteTombstoneState => {
  const pid = resolveProfileId(profileId);
  if (isNativeSqliteEnabled()) {
    const cached = nativeTombstoneCache.get(pid);
    if (cached) {
      return normalizeMessageDeleteTombstoneState(cached, nowMs);
    }
    return emptyMessageDeleteTombstoneState();
  }
  const storage = getStorage();
  if (!storage) return emptyMessageDeleteTombstoneState();
  try {
    const raw = storage.getItem(getScopeKey(profileId));
    if (!raw) return emptyMessageDeleteTombstoneState();
    const parsed = JSON.parse(raw) as MessageDeleteTombstoneState | ReadonlyArray<string>;
    if (Array.isArray(parsed)) {
      return normalizeMessageDeleteTombstoneState({
        entries: parsed.map((id) => ({ id, deletedAtUnixMs: nowMs })),
      }, nowMs);
    }
    if (!parsed || !Array.isArray(parsed.entries)) {
      return emptyMessageDeleteTombstoneState();
    }
    return normalizeMessageDeleteTombstoneState({
      entries: parsed.entries.filter((entry): entry is MessageDeleteTombstoneEntry => (
        !!entry
        && typeof entry.id === "string"
        && typeof entry.deletedAtUnixMs === "number"
      )),
    }, nowMs);
  } catch {
    return emptyMessageDeleteTombstoneState();
  }
};

const writeState = (
  state: MessageDeleteTombstoneState,
  profileId?: string,
): void => {
  const storage = getStorage();
  const scopeKey = getScopeKey(profileId);
  const pid = resolveProfileId(profileId);

  if (isNativeSqliteEnabled()) {
    const retentionNowMs = Math.max(
      Date.now(),
      ...state.entries.map((e) => e.deletedAtUnixMs),
    );
    const normalized = normalizeMessageDeleteTombstoneState(state, retentionNowMs);
    const prev = nativeTombstoneCache.get(pid) ?? emptyMessageDeleteTombstoneState();
    const locallyMerged = mergeMessageDeleteTombstoneStates(prev, normalized, retentionNowMs);
    nativeTombstoneCache.set(pid, locallyMerged);
    void runTauriTombstoneWork(async () => {
      const rows = await getTombstonesFromNativeSqlite(pid);
      const fromDb = tombstoneRecordsToState(rows, Date.now());
      const cached = nativeTombstoneCache.get(pid) ?? emptyMessageDeleteTombstoneState();
      const merged = mergeMessageDeleteTombstoneStates(fromDb, cached, Date.now());
      nativeTombstoneCache.set(pid, merged);
      await persistMergedStateToNativeSqlite(pid, merged);
    });
    return;
  }

  if (storage) {
    try {
      storage.setItem(scopeKey, JSON.stringify(state));
    } catch {
      // Keep delete flow non-throwing if storage is unavailable.
    }
  }
  flushToIndexedDb(scopeKey, normalizeMessageDeleteTombstoneState(
    state,
    Math.max(Date.now(), ...state.entries.map((e) => e.deletedAtUnixMs), 0),
  ));
};

export const suppressMessageDeleteTombstone = (
  messageId: string | null | undefined,
  deletedAtUnixMs: number = Date.now(),
  profileId?: string,
): void => {
  const normalized = messageId?.trim();
  if (!normalized) return;
  const current = readState(deletedAtUnixMs, profileId);
  const deduped = new Map(current.entries.map((entry) => [entry.id, entry.deletedAtUnixMs]));
  const prevDeletedAt = deduped.get(normalized) ?? 0;
  if (deletedAtUnixMs > prevDeletedAt) {
    deduped.set(normalized, deletedAtUnixMs);
  }
  const next = normalizeMessageDeleteTombstoneState({
    entries: Array.from(deduped.entries()).map(([id, atUnixMs]) => ({
      id,
      deletedAtUnixMs: atUnixMs,
    })),
  }, deletedAtUnixMs);
  const changed = next.entries.length !== current.entries.length
    || next.entries.some((entry, index) => (
      entry.id !== current.entries[index]?.id
      || entry.deletedAtUnixMs !== current.entries[index]?.deletedAtUnixMs
    ));
  writeState(next, profileId);
  if (changed) {
    emitAccountSyncMutation("message_delete_tombstones_changed");
  }
};

export const loadSuppressedMessageDeleteIds = (
  nowMs: number = Date.now(),
  profileId?: string,
): ReadonlySet<string> => {
  const state = readState(nowMs, profileId);
  if (!isNativeSqliteEnabled()) {
    writeState(state, profileId);
  }
  return new Set(state.entries.map((entry) => entry.id));
};

export const loadMessageDeleteTombstoneEntries = (
  nowMs: number = Date.now(),
  profileId?: string,
): ReadonlyArray<MessageDeleteTombstoneEntry> => {
  const state = readState(nowMs, profileId);
  if (!isNativeSqliteEnabled()) {
    writeState(state, profileId);
  }
  return state.entries;
};

export const replaceMessageDeleteTombstones = async (
  entries: ReadonlyArray<MessageDeleteTombstoneEntry>,
  nowMs: number = Date.now(),
  profileId?: string,
): Promise<void> => {
  await hydrateMessageDeleteTombstonesFromSqlite(profileId);
  const current = readState(nowMs, profileId);
  const merged = new Map<string, number>(
    current.entries.map((entry) => [entry.id, entry.deletedAtUnixMs]),
  );
  entries.forEach((entry) => {
    const prev = merged.get(entry.id) ?? 0;
    if (entry.deletedAtUnixMs > prev) {
      merged.set(entry.id, entry.deletedAtUnixMs);
    }
  });
  const nextEntries = normalizeMessageDeleteTombstoneEntries(
    Array.from(merged.entries()).map(([id, deletedAtUnixMs]) => ({ id, deletedAtUnixMs })),
    nowMs,
  );
  writeState({ entries: nextEntries }, profileId);
  const changed = nextEntries.length !== current.entries.length
    || nextEntries.some((entry, index) => (
      entry.id !== current.entries[index]?.id
      || entry.deletedAtUnixMs !== current.entries[index]?.deletedAtUnixMs
    ));
  if (changed) {
    emitAccountSyncMutation("message_delete_tombstones_changed");
  }
};

export const isMessageDeleteSuppressed = (
  messageId: string | null | undefined,
  nowMs: number = Date.now(),
  profileId?: string,
): boolean => {
  const normalized = messageId?.trim();
  if (!normalized) return false;
  const state = readState(nowMs, profileId);
  return state.entries.some((entry) => entry.id === normalized);
};

export const clearMessageDeleteTombstones = (profileId?: string): void => {
  const pid = resolveProfileId(profileId);
  if (isNativeSqliteEnabled()) {
    nativeTombstoneCache.set(pid, emptyMessageDeleteTombstoneState());
    void runTauriTombstoneWork(async () => {
      const rows = await getTombstonesFromNativeSqlite(pid);
      const had = rows.length > 0;
      await deleteAllTombstonesForNativeSqlite(pid);
      if (had) {
        emitAccountSyncMutation("message_delete_tombstones_changed");
      }
    });
    return;
  }
  const current = readState(Date.now(), profileId);
  writeState(emptyMessageDeleteTombstoneState(), profileId);
  if (current.entries.length > 0) {
    emitAccountSyncMutation("message_delete_tombstones_changed");
  }
};

/**
 * Load SQLite tombstones into the in-memory cache (desktop). Safe to call on startup / profile change.
 */
/**
 * Wait for pending desktop/Capacitor tombstone writes and flush the in-memory cache to SQLite.
 * Call after `suppressMessageDeleteTombstone` when delete must survive an immediate refresh.
 */
export const flushMessageDeleteTombstonesToNativeStore = async (
  profileId?: string,
): Promise<void> => {
  if (!isNativeSqliteEnabled()) {
    return;
  }
  const pid = resolveProfileId(profileId);
  await runTauriTombstoneWork(async () => {
    const cached = nativeTombstoneCache.get(pid) ?? emptyMessageDeleteTombstoneState();
    await persistMergedStateToNativeSqlite(pid, cached);
  });
};

export const hydrateMessageDeleteTombstonesFromSqlite = async (
  profileId?: string,
): Promise<void> => {
  const pid = resolveProfileId(profileId);
  // Desktop (Tauri) path is always available when `isTauri()` is true.
  if (isTauri()) {
    await runTauriTombstoneWork(async () => {
      const rows = await dbGetTombstones(pid);
      const fromDb = tombstoneRecordsToState(rows, Date.now());
      const prev = nativeTombstoneCache.get(pid) ?? emptyMessageDeleteTombstoneState();
      nativeTombstoneCache.set(pid, mergeMessageDeleteTombstoneStates(prev, fromDb, Date.now()));
    });
    return;
  }

  // Mobile (Capacitor SQLite) path: best-effort. If it fails, we keep using localStorage/IDB.
  try {
    const localState = readState(Date.now(), profileId);
    await runTauriTombstoneWork(async () => {
      const rows = await getTombstonesFromNativeSqlite(pid);
      const fromDb = tombstoneRecordsToState(rows, Date.now());
      const prev = nativeTombstoneCache.get(pid) ?? emptyMessageDeleteTombstoneState();
      const mergedNative = mergeMessageDeleteTombstoneStates(prev, fromDb, Date.now());
      const mergedWithLocal = mergeMessageDeleteTombstoneStates(mergedNative, localState, Date.now());
      nativeTombstoneCache.set(pid, mergedWithLocal);
      await persistMergedStateToNativeSqlite(pid, mergedWithLocal);
      capacitorSqliteEnabled = true;
    });
  } catch {
    // Non-fatal: keep localStorage as authority until native sqlite is available.
  }
};

/**
 * Merge IndexedDB tombstones into localStorage for the given profile scope.
 * Call once after profile is resolved in the PWA (skipped on Tauri where LS is not the source of truth).
 */
export const mergeMessageDeleteTombstonesFromIndexedDb = async (
  profileId?: string,
): Promise<void> => {
  if (isNativeSqliteEnabled()) {
    return;
  }
  const port = getIndexedDbPort();
  if (!port) return;
  const nowMs = Date.now();
  const scopeKey = getScopeKey(profileId);
  let idbState: MessageDeleteTombstoneState;
  try {
    idbState = await port.loadState({ scopeKey, nowMs });
  } catch {
    return;
  }
  const lsState = readState(nowMs, profileId);
  const merged = mergeMessageDeleteTombstoneStates(lsState, idbState, nowMs);
  if (!tombstoneEntriesEqual(merged, lsState)) {
    writeState(merged, profileId);
    emitAccountSyncMutation("message_delete_tombstones_changed");
    return;
  }
  if (!tombstoneEntriesEqual(merged, idbState)) {
    flushToIndexedDb(scopeKey, merged);
  }
};

export const messageDeleteTombstoneStoreInternals = {
  createEmptyState: emptyMessageDeleteTombstoneState,
  STORAGE_KEY,
  MAX_ENTRIES: MESSAGE_DELETE_TOMBSTONE_MAX_ENTRIES,
  RETENTION_MS: MESSAGE_DELETE_TOMBSTONE_RETENTION_MS,
  readState,
  writeState,
  normalizeState: normalizeMessageDeleteTombstoneState,
};
