# Design — R-DM-DELETE-TOMBSTONE-IPC Slice 21

**Status:** Designed · 2026-07-30  
**Prior:** Slice 20 product path on `dm.*` delete/tombstone methods

---

## Session gate

```text
NEXT ATOMIC STEP:     Slice 21 — tombstone DM delete/tombstone db_* IPC
PAUSED / CANCELLED:   community · AUTH-SESSION-1 · Dev Lab · R-RELAY
CANONICAL OWNER:      dm.deleteMessages / deleteMessage / insertTombstone / listTombstones / deleteAllTombstones
PROOF BEFORE DONE:    cargo check desktop · vitest engine-invoke-boundary-catalog
OUT OF SCOPE:         Community db_insert_message · search/wipe · P2 soak
```

---

## Keep-set

| # | Change |
|---|--------|
| 1 | Remove six delete/tombstone handlers from both `generate_handler!` lists |
| 2 | Delete command fns from `commands/db.rs`; leave tombstone comment |
| 3 | Drop from `permissions/app.toml` + `acl-manifests.json` |
| 4 | Remove wrappers from `packages/db` (keep `TombstoneRecord` type) |
| 5 | Boundary catalog asserts handlers absent · dm methods present |

## Claim language

| May say | When |
|---------|------|
| Tombstoned | Handlers unregistered · L1 green |
| Fixed (DM delete/tombstone sole engine IPC) | Slices 20–21 |
