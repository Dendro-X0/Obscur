# Investigation — R-VAULT-PERSISTENCE Slice 16

**Status:** Closed by design · 2026-07-30

## Finding

Vault media index still uses bare IPC:

| Call | Owner file |
|------|------------|
| `dbGetVaultMediaIndexForProfile` | `vault-media-index-sqlite-store.ts` |
| `dbUpsertVaultMediaIndex` | same |
| `dbDeleteVaultMediaIndex` | same |
| `dbDeleteAllVaultMediaIndexForProfile` | same |

`EngineId` already reserves **`persistence`**; Rust `dispatch` returns `engine not implemented` for it.

## Keep path

Wire `persistence` engine for vault media index only (not LES rewrite).

## Deferred

| Item | Why |
|------|-----|
| Tombstone vault `db_*` IPC | After product migrate + ACL (Slices 17+) |
| P2 UI soak | Runtime |
| LES | Separate owner (`libobscur::les`) |
