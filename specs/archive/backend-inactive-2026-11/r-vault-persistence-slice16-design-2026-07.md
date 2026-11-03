# Design — R-VAULT-PERSISTENCE Slice 16

**Status:** Designed · Implemented · Verified (L1) · 2026-07-30  
**Prior:** Slice 15 DM read IPC tombstone · `persistence` EngineId reserved

---

## Session gate

```text
NEXT ATOMIC STEP:     Slice 16 — vault media index → persistence engine
PAUSED / CANCELLED:   community · AUTH-SESSION-1 · Dev Lab · R-RELAY
CANONICAL OWNER:      persistence.* via engine_invoke + vault-media-index-sqlite-store
PROOF BEFORE DONE:    cargo test libobscur persistence vault · vitest vault-media-index + boundary
OUT OF SCOPE:         Tombstone vault db_* IPC · LES · P2 soak
```

---

## Keep-set

| # | Change |
|---|--------|
| 1 | Rust `dispatch_persistence` — list/upsert/delete/deleteAll vault media index |
| 2 | Contracts: `PERSISTENCE_ENGINE_METHODS` + builders |
| 3 | Package `@obscur/persistence-engine` helpers |
| 4 | `vault-media-index-sqlite-store` uses helpers (not bare `db_*`) |
| 5 | Wire pwa dependency · L1 tests |

## Methods

| Method | Payload | Result |
|--------|---------|--------|
| `listVaultMediaIndex` | `{}` | `VaultMediaIndexRecord[]` |
| `upsertVaultMediaIndex` | record (snake_case) | `{ upserted: true }` |
| `deleteVaultMediaIndex` | `{ remote_url }` | `{ deleted: true }` |
| `deleteAllVaultMediaIndex` | `{}` | `{ deleted: number }` |

## Claim language

| May say | When |
|---------|------|
| Implemented | Keep-set landed |
| Verified | Named L1 green — cargo persistence_vault + **13** vitest |
| Fixed (vault index sole engine product path) | Verified — IPC may remain until tombstone |
