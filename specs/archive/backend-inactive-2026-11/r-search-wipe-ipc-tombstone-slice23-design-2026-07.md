# Design — R-SEARCH-WIPE-IPC-TOMBSTONE Slice 23

**Status:** Designed · 2026-07-30  
**Prior:** Slice 22 product wipe on `persistence.wipeProfileLocalData`; search engine-ready

---

## Session gate

```text
NEXT ATOMIC STEP:     Slice 23 — tombstone search/wipe db_* IPC
PAUSED / CANCELLED:   community · AUTH-SESSION-1 · Dev Lab · R-RELAY
CANONICAL OWNER:      persistence.searchMessages / wipeProfileLocalData
PROOF BEFORE DONE:    cargo check desktop · vitest engine-invoke-boundary-catalog
OUT OF SCOPE:         Group db_* · community · P2 soak
```

---

## Keep-set

| # | Change |
|---|--------|
| 1 | Remove `db_search_messages` / `db_wipe_profile_local_data` from both `generate_handler!` lists |
| 2 | Delete command fns from `commands/db.rs`; leave tombstone comment |
| 3 | Drop from `permissions/app.toml` + `acl-manifests.json` |
| 4 | Remove wrappers from `packages/db` (keep `MessageSearchResult` / wipe report types) |
| 5 | Boundary catalog asserts handlers absent · persistence methods present |

## Claim language

| May say | When |
|---------|------|
| Tombstoned | Handlers unregistered · L1 green |
| Fixed (search/wipe sole engine IPC) | Slices 22–23 |
