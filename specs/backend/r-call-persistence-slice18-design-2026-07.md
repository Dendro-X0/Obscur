# Design — R-CALL-PERSISTENCE Slice 18

**Status:** Designed · 2026-07-30  
**Prior:** [inventory](./r-db-ipc-inventory-slice18-investigation-2026-07.md) · Slice 16 vault persistence pattern

---

## Session gate

```text
NEXT ATOMIC STEP:     Slice 18 — call records → persistence engine
PAUSED / CANCELLED:   community · AUTH-SESSION-1 · Dev Lab · R-RELAY
CANONICAL OWNER:      persistence.listCallRecords / upsertCallRecord + call-record-sqlite-store
PROOF BEFORE DONE:    cargo test persistence_call_records_round_trip · vitest call-record + boundary + p5 ACC-04
OUT OF SCOPE:         Tombstone call db_* IPC · DM tombstones · community · P2 soak
```

---

## Keep-set

| # | Change |
|---|--------|
| 1 | Rust `dispatch_persistence` — `listCallRecords`, `upsertCallRecord` (insert OR IGNORE + update) |
| 2 | Contracts: extend `PERSISTENCE_ENGINE_METHODS` + builders |
| 3 | `@obscur/persistence-engine` helpers `listCallRecords` / `upsertCallRecord` |
| 4 | `call-record-sqlite-store` uses helpers (not bare `db_*`) |
| 5 | Update ACC-04 / native-persist / p5 / boundary guards · L1 |

## Methods

| Method | Payload | Result |
|--------|---------|--------|
| `listCallRecords` | `{}` | `CallRecord[]` |
| `upsertCallRecord` | CallRecord (snake_case) | `{ upserted: true }` |

`upsertCallRecord` owns insert+update so product stops dual bare IPC for one user action.

## Claim language

| May say | When |
|---------|------|
| Inventory complete | Investigation committed |
| Implemented | Keep-set landed |
| Verified | Named L1 green |
| Fixed (call records sole engine product path) | Verified — IPC may remain until tombstone |
