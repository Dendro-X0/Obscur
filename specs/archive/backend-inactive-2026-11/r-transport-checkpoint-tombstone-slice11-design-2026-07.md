# Design — R-TRANSPORT-CHECKPOINT-TOMBSTONE Slice 11

**Status:** Implemented · L1 Pass · 2026-07-30  
**Prior:** [Slice 10 ACL](./r-transport-checkpoint-acl-slice10-design-2026-07.md) · Slices 8–9 engine path

---

## Session gate

```text
NEXT ATOMIC STEP:     Slice 11 — tombstone checkpoint db_* IPC handlers
PAUSED / CANCELLED:   community · AUTH-SESSION-1 · R-RELAY rewrite · Dev Lab
CANONICAL OWNER:      transport.listRelayCheckpoints / upsertRelayCheckpoint via engine_invoke
PROOF BEFORE DONE:    L1 catalog · lib.rs has no db_* checkpoint · cargo check obscur_desktop_lib
OUT OF SCOPE:         integrity migrate · P2 · community · vault db_*
```

---

## Keep-set

| # | Change |
|---|--------|
| 1 | Remove three handlers from both `generate_handler!` lists in `lib.rs` |
| 2 | Delete `db_upsert_relay_checkpoint` / `db_get_relay_checkpoint` / `db_get_relay_checkpoints` from `commands/db.rs` |
| 3 | Remove wrappers from `packages/db` client + exports |
| 4 | L1: catalog asserts handlers absent · engine methods present · ACL still omits |

## Claim language

| May say | When |
|---------|------|
| Tombstoned | Handlers unregistered · L1 green |
| Fixed (ACC-03 sole owner) | Slices 8–11 — product + IPC |
