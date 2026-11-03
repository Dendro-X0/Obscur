# Design — R-BACKUP-DM-READ Slice 13

**Status:** Designed · Implemented · Verified (L1) · 2026-07-30  
**Prior:** Slice 12 integrity/repair engine reads Done

---

## Session gate

```text
NEXT ATOMIC STEP:     Slice 13 — backup-evidence DM dbGet* → engine
PAUSED / CANCELLED:   community · AUTH-SESSION-1 · Dev Lab · R-RELAY
CANONICAL OWNER:      collectNativeSqliteBackupEvidence → listDmConversations / fetchDmThreadRows
PROOF BEFORE DONE:    vitest native-sqlite-backup-evidence + path-b-b4-exit.contract
OUT OF SCOPE:         group db_* · vault · hydrate-indexed-scan · P2 soak
```

---

## Keep-set

| # | Change |
|---|--------|
| 1 | `collectNativeSqliteBackupEvidence` DM list/thread → `@obscur/dm-engine` + Tauri host |
| 2 | Remove `dbGetConversations` / `dbGetMessages` imports from that file |
| 3 | Unit test mocks → dm-engine |
| 4 | `path-b-b4-exit.contract` asserts engine symbols, not bare DM `dbGet*` |

## Claim language

| May say | When |
|---------|------|
| Implemented | Keep-set landed |
| Verified | Named vitest green — **10/10** |
| Fixed (backup DM collect on engine) | Verified — groups still bare IPC |
