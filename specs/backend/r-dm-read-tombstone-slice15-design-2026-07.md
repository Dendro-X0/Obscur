# Design — R-DM-READ-TOMBSTONE Slice 15

**Status:** Designed · Implemented · Verified (L1) · 2026-07-30  
**Prior:** Slices 6–14 DM reads on engine · Slice 11 checkpoint IPC tombstone pattern

---

## Session gate

```text
NEXT ATOMIC STEP:     Slice 15 — tombstone leftover db_get_messages / db_get_conversations
PAUSED / CANCELLED:   community · AUTH-SESSION-1 · Dev Lab · R-RELAY
CANONICAL OWNER:      dm.getThread / dm.listConversations via engine_invoke
PROOF BEFORE DONE:    cargo check desktop · vitest engine-invoke-boundary-catalog (+ probe/bootstrap cleanups)
OUT OF SCOPE:         vault engine · group db_* · P2 soak · db_insert_message
```

---

## Keep-set

| # | Change |
|---|--------|
| 1 | Remove `db_get_messages` / `db_get_conversations` from both `generate_handler!` lists |
| 2 | Delete Tauri command fns from `commands/db.rs`; leave tombstone comment |
| 3 | Quarantine from `permissions/app.toml` + sync `acl-manifests.json` |
| 4 | Remove wrappers from `packages/db` client + exports |
| 5 | Boundary catalog: handlers absent · ACL omit · engine methods present |

## Claim language

| May say | When |
|---------|------|
| Tombstoned | Handlers unregistered · L1 green — **cargo + 23 vitest** |
| Fixed (DM read sole engine IPC) | Slices 6–15 — product + IPC |
| Vault fixed | **No** — deferred |
