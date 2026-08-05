# Design — R-DM-READ Slice 6 (sole DM engine read path)

**Status:** Implemented · L1 Pass · 2026-07-30  
**Investigation:** [r-dm-read-slice6-investigation-2026-07.md](./r-dm-read-slice6-investigation-2026-07.md)  
**Charter:** [rust-module-refactor-queue-2026-07.md](./rust-module-refactor-queue-2026-07.md)

---

## Session gate

```text
NEXT ATOMIC STEP:     Slice 6 R-DM-READ — implement sole engine read path
PAUSED / CANCELLED:   community · AUTH-SESSION-1 · Dev Lab · R-RELAY
CANONICAL OWNER:      dm-kernel-thread-port · dm-kernel-sidebar-port · @obscur/dm-engine · dm-engine-methods
PROOF BEFORE DONE:    pnpm -C apps/pwa exec vitest run app/features/dm-kernel app/engine-lab/dm-engine-b3.contract.test.ts
OUT OF SCOPE:         community · vault · messaging-provider sidebar · db_* IPC tombstone
```

---

## Keep-set (subtract first)

| # | Change |
|---|--------|
| 1 | `dm-kernel-thread-port`: always `fetchDmThreadRows`; remove `dbGetMessages` + `isEngineLabStrictMode` fork |
| 2 | `dm-kernel-sidebar-port`: always `listDmConversations`; remove `dbGetConversations` fork |
| 3 | `dm-engine-methods.ts`: add `insertMessage` / `upsertConversation` (+ builders optional) |
| 4 | `probeDmKernelWrite`: read-back via `fetchDmThreadRows` |
| 5 | Update unit tests to mock `@obscur/dm-engine` only; update `dm-engine-b3` contract |

## Mental simulation

1. User opens DM thread → `loadDmKernelThread` → `engine_invoke` `dm.getThread` only.  
2. Sidebar load → `dm.listConversations` only.  
3. `ALLOW_LEGACY=1` no longer restores bare `db_get_messages` for kernel ports (intentional subtraction).  
4. Community invite insert still `dbInsertMessage` (untouched).

## Proof

| Layer | Command |
|-------|---------|
| L1 | `pnpm -C apps/pwa exec vitest run app/features/dm-kernel app/engine-lab/dm-engine-b3.contract.test.ts` |
| L1 optional | `pnpm verify:dm-engine-w0` / `verify:dm-engine-b3` if scripted |

## Claim language

| May say | When |
|---------|------|
| Implemented | Diff matches keep-set |
| Verified | Named vitest green |
| Fixed (DM kernel single read owner) | Verified — not full db_* death |
