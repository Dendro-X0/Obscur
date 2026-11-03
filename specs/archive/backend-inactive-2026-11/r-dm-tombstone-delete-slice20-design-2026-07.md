# Design — R-DM-TOMBSTONE-DELETE Slice 20

**Status:** Designed · 2026-07-30  
**Prior:** [investigation](./r-dm-tombstone-delete-slice20-investigation-2026-07.md)

---

## Session gate

```text
NEXT ATOMIC STEP:     Slice 20 — DM tombstone/delete → dm.*
PAUSED / CANCELLED:   community · AUTH-SESSION-1 · Dev Lab · R-RELAY
CANONICAL OWNER:      dm.* + message-delete-tombstone-store / local-dm-visibility / restore / persistence flush
PROOF BEFORE DONE:    cargo test dm_tombstone_delete_round_trip · named vitest
OUT OF SCOPE:         Unregister db_delete_* / db_*tombstone* IPC · community · P2
```

---

## Keep-set

| # | Change |
|---|--------|
| 1 | Rust `dispatch_dm` — five methods above |
| 2 | Contracts `DM_ENGINE_METHODS` + builders |
| 3 | `@obscur/dm-engine` helpers |
| 4 | Migrate five Tauri product call sites |
| 5 | Update mocks / boundary / L1 |

## Payload notes

- Tombstone records: snake_case wire (same as `MessageRecord`)
- `deleteMessages`: `{ eventIds: string[] }` camelCase
- `deleteMessage`: `{ eventId: string }` camelCase

## Claim language

| May say | When |
|---------|------|
| Implemented | Keep-set landed |
| Verified | Named L1 green |
| Fixed (sole engine product path) | Verified — IPC may remain until Slice 21 |
