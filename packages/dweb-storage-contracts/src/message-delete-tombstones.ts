/**
 * Shared model + normalization for "delete for everyone" tombstones (message ids
 * that must stay suppressed locally). Native and PWA adapters implement the port.
 */

export type MessageDeleteTombstoneEntry = Readonly<{
  id: string;
  deletedAtUnixMs: number;
}>;

export type MessageDeleteTombstoneState = Readonly<{
  entries: ReadonlyArray<MessageDeleteTombstoneEntry>;
}>;

export const MESSAGE_DELETE_TOMBSTONE_STORAGE_KEY = "obscur.messaging.message_delete_tombstones.v1";

export const MESSAGE_DELETE_TOMBSTONE_MAX_ENTRIES = 5_000;

export const MESSAGE_DELETE_TOMBSTONE_RETENTION_MS = 2 * 365 * 24 * 60 * 60 * 1000;

export const emptyMessageDeleteTombstoneState = (): MessageDeleteTombstoneState => ({ entries: [] });

export const normalizeMessageDeleteTombstoneState = (
  state: MessageDeleteTombstoneState,
  nowMs: number,
): MessageDeleteTombstoneState => {
  const deduped = new Map<string, number>();
  state.entries.forEach((entry) => {
    const id = entry.id.trim();
    if (!id) return;
    if (!Number.isFinite(entry.deletedAtUnixMs)) return;
    if (nowMs - entry.deletedAtUnixMs > MESSAGE_DELETE_TOMBSTONE_RETENTION_MS) return;
    const prev = deduped.get(id) ?? 0;
    if (entry.deletedAtUnixMs > prev) {
      deduped.set(id, entry.deletedAtUnixMs);
    }
  });
  const nextEntries = Array.from(deduped.entries())
    .map(([id, deletedAtUnixMs]) => ({ id, deletedAtUnixMs }))
    .sort((a, b) => a.deletedAtUnixMs - b.deletedAtUnixMs)
    .slice(-MESSAGE_DELETE_TOMBSTONE_MAX_ENTRIES);
  return { entries: nextEntries };
};

export const normalizeMessageDeleteTombstoneEntries = (
  entries: ReadonlyArray<MessageDeleteTombstoneEntry>,
  nowMs: number = Date.now(),
): ReadonlyArray<MessageDeleteTombstoneEntry> => (
  normalizeMessageDeleteTombstoneState({ entries }, nowMs).entries
);

/** Union two normalized-ish states, keeping the latest deletedAtUnixMs per id, then normalize. */
export const mergeMessageDeleteTombstoneStates = (
  a: MessageDeleteTombstoneState,
  b: MessageDeleteTombstoneState,
  nowMs: number,
): MessageDeleteTombstoneState => {
  const merged = new Map<string, number>();
  const ingest = (entries: ReadonlyArray<MessageDeleteTombstoneEntry>) => {
    entries.forEach((entry) => {
      const id = entry.id.trim();
      if (!id || !Number.isFinite(entry.deletedAtUnixMs)) return;
      const prev = merged.get(id) ?? 0;
      if (entry.deletedAtUnixMs > prev) {
        merged.set(id, entry.deletedAtUnixMs);
      }
    });
  };
  ingest(a.entries);
  ingest(b.entries);
  return normalizeMessageDeleteTombstoneState({
    entries: Array.from(merged.entries()).map(([id, deletedAtUnixMs]) => ({ id, deletedAtUnixMs })),
  }, nowMs);
};

/**
 * Persistence port: scopeKey is an opaque per-profile key (e.g. scoped localStorage key).
 */
export type MessageDeleteTombstonePersistencePort = Readonly<{
  loadState(params: Readonly<{ scopeKey: string; nowMs: number }>): Promise<MessageDeleteTombstoneState>;
  saveState(params: Readonly<{ scopeKey: string; state: MessageDeleteTombstoneState }>): Promise<void>;
  clearScope(params: Readonly<{ scopeKey: string }>): Promise<void>;
}>;
