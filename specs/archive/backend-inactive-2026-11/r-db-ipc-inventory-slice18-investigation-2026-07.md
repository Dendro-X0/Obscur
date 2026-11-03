# Investigation — R-DB-IPC-INVENTORY Slice 18

**Status:** Investigated · 2026-07-30  
**Charter:** [rust-module-refactor-queue-2026-07.md](./rust-module-refactor-queue-2026-07.md)

---

## Session gate

```text
NEXT ATOMIC STEP:     Slice 18 — inventory remaining bare db_* · migrate first keep-set
PAUSED / CANCELLED:   community · AUTH-SESSION-1 · Dev Lab · R-RELAY
CANONICAL OWNER:      engine_invoke (dm / persistence / workspace)
PROOF BEFORE DONE:    Inventory + ranked next band · L1 if migrate lands
OUT OF SCOPE:         Group/community IPC · P2 soak claim · LES
```

---

## ACL allow-db-commands still registered

| Command | Product callers (features) | Band |
|---------|----------------------------|------|
| `db_insert_message` | `community-dm-invite-pipeline` only | **PAUSED** community |
| `db_upsert_conversation` | same | **PAUSED** |
| `db_delete_message` / `db_delete_messages` | local-dm-visibility · restore-materialization · message-persistence | DM lifecycle — next wave |
| `db_insert_tombstone` / `db_insert_tombstones` / `db_get_tombstones` / `db_delete_all_tombstones_for_profile` | message-delete-tombstone-store · dm-thread-suppression · local-dm-visibility · message-persistence | DM lifecycle — next wave |
| `db_upsert_group` / `db_get_groups` | community-group-sqlite-store · backup evidence | **PAUSED** community |
| `db_insert_group_message` / `db_get_group_messages` | group-thread-* · backup · account-group evidence | **PAUSED** community |
| `db_insert_group_tombstone` | group-thread-suppress | **PAUSED** community |
| `db_insert_call_record` / `db_update_call_record` / `db_get_call_records` | `call-record-sqlite-store` (+ call-state-runtime) | **Migrate now** — ACC-04 |
| `db_search_messages` | (search UI — confirm before migrate) | Later utility |
| `db_wipe_profile_local_data` | profile-local-reset-service | Later utility |

## Already engine-only (do not reopen)

DM reads/writes (kernel) · vault media index · relay checkpoints · transport publish path

## Ranked next keep-set

| Rank | Band | Why |
|------|------|-----|
| 1 | **Call records → `persistence.*`** | Isolated store · mirrors Slice 16 vault · not PAUSED |
| 2 | DM tombstone/delete → `dm.*` | Entangled with visibility/restore; needs design |
| 3 | Search / wipe | Low dual-owner risk; utility |
| ∞ | Group / community invite insert | **Blocked** until community un-pause |

## Dual-owner leftover (unchanged)

`community-dm-invite-pipeline` → `dbInsertMessage` / `dbUpsertConversation` — PAUSED
