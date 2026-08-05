# Investigation — R-DM-READ Slice 6 (DM kernel → sole engine_invoke reads)

**Status:** Investigation · 2026-07-30 · **no product code until design**  
**Charter:** [rust-module-refactor-queue-2026-07.md](./rust-module-refactor-queue-2026-07.md)  
**Prior:** Dual-owner DM **writes** on `engine_invoke` · R-ACCOUNT L3b keychain **Pass**

---

## Session gate

```text
NEXT ATOMIC STEP:     Slice 6 R-DM-READ — investigation
PAUSED / CANCELLED:   community · AUTH-SESSION-1 · Dev Lab · R-RELAY rewrite
CANONICAL OWNER:      @obscur/dm-engine fetchDmThreadRows / listDmConversations → engine_invoke
PROOF BEFORE DONE:    Call-graph + fork inventory (this doc)
OUT OF SCOPE:         community dbInsertMessage · vault/groups db_* · relay
```

---

## Facts

| Fact | Evidence |
|------|----------|
| Rust already has `getThread` / `listConversations` / `insertMessage` / `upsertConversation` | `libobscur::engine_invoke::dispatch_dm` |
| TS package helpers exist | `fetchDmThreadRows`, `listDmConversations` in `@obscur/dm-engine` |
| DM kernel **write** port already uses `engine_invoke` | `dm-kernel-write-port.ts` |
| Thread/sidebar still fork: strict → engine · legacy → `dbGet*` | `dm-kernel-thread-port.ts` · `dm-kernel-sidebar-port.ts` |
| Default runtime is **strict** (`ALLOW_LEGACY` unset) | `engine-lab-policy.ts` — so production already hits engine |
| Contracts list only `getThread` / `listConversations` | `dm-engine-methods.ts` — writes missing from catalog |
| Write probe still reads via `dbGetMessages` | `probeDmKernelWrite` |
| Community `dbInsertMessage` sole product insert leftover | PAUSED — do not touch |

---

## Parallel paths (DM read)

```
loadDmKernelThread
  ├─ isEngineLabStrictMode() → fetchDmThreadRows → engine_invoke getThread   ← DEFAULT
  └─ else → dbGetMessages → db_get_messages                                    ← LEGACY ONLY

loadDmKernelSidebar
  ├─ strict → listDmConversations → engine_invoke listConversations            ← DEFAULT
  └─ else → dbGetConversations                                                  ← LEGACY ONLY
```

**Verdict:** Dual read path is real but legacy-gated. Subtracting the fork completes the DM **functional module** boundary without un-pausing community.

---

## Out of this slice (later bands)

| Caller | Still on `db_*` | Why defer |
|--------|-----------------|-----------|
| `messaging-provider` `dbGetConversations` | Yes | Non-kernel path; separate subtract |
| `native-dm-sqlite-integrity` | Yes | Diagnostic |
| `account-sync` backup evidence | Yes | Group + DM restore — own design |
| Community groups sqlite | Yes | Community PAUSED |
| Vault media index | Yes | Vault / DEFER |

---

## Recommended design keep-set

1. Always route thread + sidebar through `@obscur/dm-engine` (delete `dbGet*` + strict fork).  
2. Expand `DM_ENGINE_METHODS` with `insertMessage` / `upsertConversation`.  
3. Write probe read-back via `fetchDmThreadRows`.  
4. Update L1 unit + `dm-engine-b3` contract expectations.

---

## Claim language

| May say | When |
|---------|------|
| Investigated | This doc |
| Designed | Design with implement steps |
| Implemented | Ports + contracts green |
| Fixed (single DM invoke path) | L1 + optional L3 thread open — not claiming full `db_*` tombstone |
