# Design — R-CALL-IPC-TOMBSTONE Slice 19

**Status:** Designed · 2026-07-30  
**Prior:** Slice 18 product path on `persistence.listCallRecords` / `upsertCallRecord`

---

## Session gate

```text
NEXT ATOMIC STEP:     Slice 19 — tombstone call-record db_* IPC
PAUSED / CANCELLED:   community · AUTH-SESSION-1 · Dev Lab · R-RELAY
CANONICAL OWNER:      persistence.* via engine_invoke
PROOF BEFORE DONE:    cargo check desktop · vitest engine-invoke-boundary-catalog
OUT OF SCOPE:         DM tombstone/delete migrate · P2 soak · community
```

---

## Keep-set

| # | Change |
|---|--------|
| 1 | Remove three call handlers from both `generate_handler!` lists |
| 2 | Delete command fns from `commands/db.rs`; leave tombstone comment |
| 3 | Drop from `permissions/app.toml` + `acl-manifests.json` |
| 4 | Remove wrappers from `packages/db` client + exports (keep `CallRecord` type) |
| 5 | Boundary catalog asserts handlers absent · persistence methods present |

## Claim language

| May say | When |
|---------|------|
| Tombstoned | Handlers unregistered · L1 green |
| Fixed (call records sole engine IPC) | Slices 18–19 |
