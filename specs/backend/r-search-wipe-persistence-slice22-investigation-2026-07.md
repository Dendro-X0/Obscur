# Investigation — R-SEARCH-WIPE-PERSISTENCE Slice 22

**Status:** Investigated · 2026-07-30  
**Prior:** [inventory](./r-db-ipc-inventory-slice18-investigation-2026-07.md) · Slice 21 DM delete IPC tombstone

---

## Session gate

```text
NEXT ATOMIC STEP:     Slice 22 — search/wipe → persistence.*
PAUSED / CANCELLED:   community · AUTH-SESSION-1 · Dev Lab · R-RELAY
CANONICAL OWNER:      persistence.searchMessages / wipeProfileLocalData
PROOF BEFORE DONE:    Investigation + design · L1 when migrate lands
OUT OF SCOPE:         Group db_* · community invite · P2 soak
```

---

## Callers

| Command | Product | Notes |
|---------|---------|-------|
| `db_wipe_profile_local_data` | `profile-local-reset-service.ts` | Migrate now |
| `db_search_messages` | **none** (UI search uses chat-state IDB) | Wire engine method for sole path; no product migrate |

## Remaining ACL after Slice 22 (still bare)

Group `db_*` · `db_insert_message` / `db_upsert_conversation` (community PAUSED) · search/wipe IPC until Slice 23 tombstone
