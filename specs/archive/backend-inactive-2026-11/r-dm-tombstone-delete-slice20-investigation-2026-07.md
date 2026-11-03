# Investigation — R-DM-TOMBSTONE-DELETE Slice 20

**Status:** Investigated · 2026-07-30  
**Prior:** [inventory](./r-db-ipc-inventory-slice18-investigation-2026-07.md) · Slice 19 call IPC tombstone

---

## Session gate

```text
NEXT ATOMIC STEP:     Slice 20 — DM tombstone/delete → dm.*
PAUSED / CANCELLED:   community · AUTH-SESSION-1 · Dev Lab · R-RELAY
CANONICAL OWNER:      dm.listTombstones / insertTombstone / delete* via engine_invoke
PROOF BEFORE DONE:    Investigation + design · L1 when migrate lands
OUT OF SCOPE:         Group tombstones · community invite · IPC tombstone (Slice 21)
```

---

## Product callers (Tauri bare `db_*`)

| Caller | Commands |
|--------|----------|
| `message-delete-tombstone-store.ts` | get / insert / deleteAll tombstones |
| `dm-thread-suppression-prepare.ts` | get tombstones |
| `local-dm-visibility-owner.ts` | deleteMessages (+ fallback deleteMessage) + insertTombstone |
| `restore-materialization.ts` | deleteMessages (+ fallback deleteMessage) |
| `message-persistence-service.ts` | deleteMessages + insertTombstone |

Capacitor adapters stay (not Tauri `db_*`).

## Engine keep-set methods

| Method | Maps to |
|--------|---------|
| `listTombstones` | `get_tombstones` |
| `insertTombstone` | `insert_tombstone` |
| `deleteAllTombstones` | `delete_all_tombstones_for_profile` |
| `deleteMessages` | `delete_messages` |
| `deleteMessage` | `delete_message` (fallback) |

`insert_tombstones` batch unused in product — defer.
