# Design — R-DM-INTEGRITY-READ Slice 12

**Status:** Designed · Implemented · Verified (L1) · 2026-07-30  
**Prior:** Slice 6–7 DM kernel/host sole engine reads · ACC-03 Slices 8–11 Done

---

## Session gate

```text
NEXT ATOMIC STEP:     Slice 12 — integrity/repair dbGet* → engine
PAUSED / CANCELLED:   community · AUTH-SESSION-1 · Dev Lab · R-RELAY
CANONICAL OWNER:      fetchDmThreadRows / listDmConversations via engine_invoke
PROOF BEFORE DONE:    vitest native-dm-sqlite-integrity + native-dm-sqlite-repair (+ durability contract)
OUT OF SCOPE:         account-sync backup-evidence · community · P2 soak
```

---

## Keep-set

| # | Change |
|---|--------|
| 1 | `native-dm-sqlite-integrity`: `dbGetMessages` → `fetchDmThreadRows` |
| 2 | `native-dm-sqlite-repair`: `dbGetConversations` → `listDmConversations` |
| 3 | Update unit tests to mock `@obscur/dm-engine` |
| 4 | Contract assert no `dbGetMessages` / `dbGetConversations` in those files |

## Claim language

| May say | When |
|---------|------|
| Implemented | Keep-set landed |
| Verified | Named vitest green — **22/22** |
| Fixed (diagnostic DM reads on engine) | Verified — backup-evidence still deferred |
