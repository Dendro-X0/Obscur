# Design — R-DM-SIDEBAR-HOST Slice 7

**Status:** Implemented · L1 Pass · 2026-07-30  
**Investigation:** [r-dm-sidebar-host-slice7-investigation-2026-07.md](./r-dm-sidebar-host-slice7-investigation-2026-07.md)

---

## Session gate

```text
NEXT ATOMIC STEP:     Slice 7 R-DM-SIDEBAR-HOST implement
PAUSED / CANCELLED:   community · AUTH-SESSION-1 · Dev Lab
CANONICAL OWNER:      messaging-provider → loadDmKernelSidebar
PROOF BEFORE DONE:    pnpm -C apps/pwa exec vitest run app/features/messaging/providers app/features/dm-kernel/p3-runtime-data-path.contract.test.ts
OUT OF SCOPE:         repair · backup-evidence · groups
```

---

## Keep-set

| # | Change |
|---|--------|
| 1 | `loadSidebarConversations` always `loadDmKernelSidebar(profileId)` |
| 2 | Drop unused `dbGetConversations`, `ConversationRecord`, `sqliteConvToRaw` |
| 3 | Drop unused `isDmKernelAuthority` import if only used for that fork |
| 4 | Fix provider tests; add/assert no `dbGetConversations` in provider source |

## Mental simulation

Tauri profile open → provider loads sidebar → only `engine_invoke` `listConversations`. `ALLOW_LEGACY=1` no longer restores bare `db_get_conversations` for the host sidebar.

## Proof

| Layer | Command |
|-------|---------|
| L1 | vitest messaging providers + p3-runtime-data-path |
