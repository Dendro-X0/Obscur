# Investigation — R-DM-READ-TOMBSTONE Slice 15

**Status:** Closed by design · 2026-07-30

## Finding

After Slices 6–14, **zero** production TS callers of `dbGetMessages` / `dbGetConversations` remain (grep apps/pwa features). Sole leftovers:

| Surface | Status |
|---------|--------|
| `packages/db` wrappers | Dead IPC clients |
| Tauri `db_get_messages` / `db_get_conversations` | Still registered + ACL-allowed |
| Test mocks | Harmless stubs |

Engine path owns reads: `dm.getThread` / `dm.listConversations` via `engine_invoke`.

## Deferred

| Candidate | Why |
|-----------|-----|
| Vault `db_*` | No vault engine methods yet — greenfield, not tombstone |
| Group `db_get_*` | Community PAUSED |
| `db_insert_message` | Community invite leftover + write path still IPC for some |
| P2 UI soak | Runtime, not this band |

## Subtraction

Tombstone bare get IPC (handlers + ACL + `@dweb/db` wrappers). Keep libobscur SQLite internals used by `engine_invoke`.
