# Design — R-VAULT-IPC-TOMBSTONE Slice 17

**Status:** L1 Pass · 2026-07-30 (re-verified)  
**Prior:** Slice 16 product path on `persistence.*`

---

## Session gate

```text
NEXT ATOMIC STEP:     Slice 17 — tombstone vault media db_* IPC
PAUSED / CANCELLED:   community · AUTH-SESSION-1 · Dev Lab · R-RELAY
CANONICAL OWNER:      persistence.list/upsert/deleteVaultMediaIndex via engine_invoke
PROOF BEFORE DONE:    cargo check desktop · vitest engine-invoke-boundary-catalog
OUT OF SCOPE:         P2 soak · LES · re-add vault IPC
```

---

## Keep-set

| # | Change |
|---|--------|
| 1 | Remove four vault media handlers from both `generate_handler!` lists |
| 2 | Delete command fns from `commands/db.rs`; leave tombstone comment |
| 3 | Remove wrappers from `packages/db` client + exports |
| 4 | Boundary catalog asserts handlers absent · persistence methods present |

## Claim language

| May say | When |
|---------|------|
| Tombstoned | Handlers unregistered · L1 green |
| Fixed (vault index sole engine IPC) | Slices 16–17 |
