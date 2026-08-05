# Investigation — R-DB-IPC-REMAINING Slice 24

**Status:** Investigated · 2026-07-30  
**Prior:** Slices 6–23 non-PAUSED `db_*` → `engine_invoke` (+ IPC tombstones)

---

## Session gate

```text
NEXT ATOMIC STEP:     Slice 24 — remaining ACL inventory (no PAUSED code)
PAUSED / CANCELLED:   community · AUTH-SESSION-1 · Dev Lab · R-RELAY · group db_*
CANONICAL OWNER:      engine_invoke for all non-PAUSED product db paths
PROOF BEFORE DONE:    Inventory + L1 ACL allowlist pin
OUT OF SCOPE:         Group/community migrate · P2 soak claim without release L3
```

---

## Non-PAUSED functional-module subtract — complete

| Band | Slices | Sole IPC |
|------|--------|----------|
| DM read | 6–15 | `dm.getThread` / `listConversations` |
| Relay checkpoints | 8–11 | `transport.*` |
| Vault media | 16–17 | `persistence.*` vault |
| Call records | 18–19 | `persistence.*` call |
| DM delete/tombstone | 20–21 | `dm.*` delete/tombstone |
| Search / wipe | 22–23 | `persistence.searchMessages` / `wipeProfileLocalData` |

---

## Remaining `allow-db-commands` (PAUSED only)

| Command | Product callers | Gate |
|---------|-----------------|------|
| `db_insert_message` | `community-dm-invite-pipeline` | **PAUSED** community |
| `db_upsert_conversation` | same | **PAUSED** |
| `db_upsert_group` / `db_get_groups` | community-group-sqlite-store · backup | **PAUSED** |
| `db_insert_group_message` / `db_get_group_messages` | group-thread-* · backup · evidence | **PAUSED** |
| `db_insert_group_tombstone` | group-thread-suppress | **PAUSED** |
| `engine_invoke` (+ transport publish) | canonical | keep |

Plus dual-owner leftover: invite pipeline bare insert — blocked until community un-pause.

---

## P2 unlock→shell UI soak

| Field | Value |
|-------|--------|
| Prior | R-ACCOUNT L3b keychain **Pass** (release cold restart) |
| Still open | Full unlock→shell **UI** soak on release exe — maintainer L3 runtime |
| This slice | **Does not claim** P2 UI fixed |

---

## Next options (maintainer choose)

1. **P2 UI soak** — release exe unlock→shell evidence (not agent-declared)  
2. **Community un-pause charter** — then migrate group + invite insert onto `workspace`/`dm`  
3. Hold queue — no further non-PAUSED `db_*` subtract
