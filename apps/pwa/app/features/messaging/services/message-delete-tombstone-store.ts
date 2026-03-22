"use client";

import { getScopedStorageKey } from "@/app/features/profiles/services/profile-scope";

type MessageDeleteTombstoneEntry = Readonly<{
  id: string;
  deletedAtUnixMs: number;
}>;

type MessageDeleteTombstoneState = Readonly<{
  entries: ReadonlyArray<MessageDeleteTombstoneEntry>;
}>;

const STORAGE_KEY = "obscur.messaging.message_delete_tombstones.v1";
const MAX_ENTRIES = 5_000;
const RETENTION_MS = 30 * 24 * 60 * 60 * 1000;

const createEmptyState = (): MessageDeleteTombstoneState => ({ entries: [] });

const normalizeState = (
  state: MessageDeleteTombstoneState,
  nowMs: number
): MessageDeleteTombstoneState => {
  const deduped = new Map<string, number>();
  state.entries.forEach((entry) => {
    const id = entry.id.trim();
    if (!id) return;
    if (!Number.isFinite(entry.deletedAtUnixMs)) return;
    if (nowMs - entry.deletedAtUnixMs > RETENTION_MS) return;
    const prev = deduped.get(id) ?? 0;
    if (entry.deletedAtUnixMs > prev) {
      deduped.set(id, entry.deletedAtUnixMs);
    }
  });
  const nextEntries = Array.from(deduped.entries())
    .map(([id, deletedAtUnixMs]) => ({ id, deletedAtUnixMs }))
    .sort((a, b) => a.deletedAtUnixMs - b.deletedAtUnixMs)
    .slice(-MAX_ENTRIES);
  return { entries: nextEntries };
};

const readState = (nowMs: number = Date.now()): MessageDeleteTombstoneState => {
  if (typeof window === "undefined") return createEmptyState();
  try {
    const raw = window.localStorage.getItem(getScopedStorageKey(STORAGE_KEY));
    if (!raw) return createEmptyState();
    const parsed = JSON.parse(raw) as MessageDeleteTombstoneState | ReadonlyArray<string>;
    if (Array.isArray(parsed)) {
      return normalizeState({
        entries: parsed.map((id) => ({ id, deletedAtUnixMs: nowMs })),
      }, nowMs);
    }
    if (!parsed || !Array.isArray(parsed.entries)) {
      return createEmptyState();
    }
    return normalizeState({
      entries: parsed.entries.filter((entry): entry is MessageDeleteTombstoneEntry => (
        !!entry
        && typeof entry.id === "string"
        && typeof entry.deletedAtUnixMs === "number"
      )),
    }, nowMs);
  } catch {
    return createEmptyState();
  }
};

const writeState = (state: MessageDeleteTombstoneState): void => {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(getScopedStorageKey(STORAGE_KEY), JSON.stringify(state));
  } catch {
    // Keep delete flow non-throwing if storage is unavailable.
  }
};

export const suppressMessageDeleteTombstone = (
  messageId: string | null | undefined,
  deletedAtUnixMs: number = Date.now()
): void => {
  const normalized = messageId?.trim();
  if (!normalized) return;
  const current = readState(deletedAtUnixMs);
  const deduped = new Map(current.entries.map((entry) => [entry.id, entry.deletedAtUnixMs]));
  const prevDeletedAt = deduped.get(normalized) ?? 0;
  if (deletedAtUnixMs > prevDeletedAt) {
    deduped.set(normalized, deletedAtUnixMs);
  }
  const next = normalizeState({
    entries: Array.from(deduped.entries()).map(([id, atUnixMs]) => ({
      id,
      deletedAtUnixMs: atUnixMs,
    })),
  }, deletedAtUnixMs);
  writeState(next);
};

export const loadSuppressedMessageDeleteIds = (nowMs: number = Date.now()): ReadonlySet<string> => {
  const state = readState(nowMs);
  writeState(state);
  return new Set(state.entries.map((entry) => entry.id));
};

export const isMessageDeleteSuppressed = (
  messageId: string | null | undefined,
  nowMs: number = Date.now()
): boolean => {
  const normalized = messageId?.trim();
  if (!normalized) return false;
  const state = readState(nowMs);
  return state.entries.some((entry) => entry.id === normalized);
};

export const clearMessageDeleteTombstones = (): void => {
  writeState(createEmptyState());
};

export const messageDeleteTombstoneStoreInternals = {
  STORAGE_KEY,
  MAX_ENTRIES,
  RETENTION_MS,
  readState,
  writeState,
  normalizeState,
};

