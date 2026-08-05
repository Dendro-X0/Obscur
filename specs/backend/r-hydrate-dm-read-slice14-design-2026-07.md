# Design — R-HYDRATE-DM-READ Slice 14

**Status:** Designed · Implemented · Verified (L1) · 2026-07-30  
**Prior:** Slice 13 backup DM collect Done

---

## Session gate

```text
NEXT ATOMIC STEP:     Slice 14 — hydrate-indexed-scan dbGet* → engine
PAUSED / CANCELLED:   community · AUTH-SESSION-1 · Dev Lab · R-RELAY
CANONICAL OWNER:      loadLegacyConversationWindow → fetchDmThreadRows
PROOF BEFORE DONE:    vitest dm-conversation-hydrate-indexed-scan + durability + monotonic (legacy opt-in)
OUT OF SCOPE:         vault · P2 soak · community · tombstone db_get_messages IPC · full use-conversation-messages.integration under kernel stub
```

---

## Keep-set

| # | Change |
|---|--------|
| 1 | `hydrate-indexed-scan.ts`: `dbGetMessages` → `fetchDmThreadRows` + Tauri host; pass `beforeReceivedAt` |
| 2 | Unit test mocks → `@obscur/dm-engine` |
| 3 | Monotonic hydrate integration mocks → `fetchDmThreadRows` + legacy opt-in stubs |
| 4 | Durability contract: hydrate source must not contain `dbGetMessages` |

## Claim language

| May say | When |
|---------|------|
| Implemented | Keep-set landed |
| Verified | Named vitest green — unit + durability + monotonic |
| Fixed (hydrate window on engine) | Verified — bare `db_get_messages` IPC may still exist until tombstone; kernel ship path uses stub/kernel, not this legacy window |
