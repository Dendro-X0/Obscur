# Design — `dm-persist` dual-owner subtract (clarify + flush dedupe)

**Status:** Implemented (L1 #1–2) · 2026-07-30  
**Study:** [dm-persist-dual-owner-integration-study-2026-07.md](./dm-persist-dual-owner-integration-study-2026-07.md)  
**Charter:** [rust-module-refactor-queue-2026-07.md](./rust-module-refactor-queue-2026-07.md)  
**Pattern:** [r-scope-slice2-design-2026-07.md](./r-scope-slice2-design-2026-07.md)

---

## Session gate

```text
NEXT ATOMIC STEP:     Dual-owner subtract — dm-persist design → L1 clarify + flush dedupe
PAUSED / CANCELLED:   community · COM-RUN-* · relay-publish mutate · AUTH-SESSION-1 · Dev Lab
CANONICAL OWNER:      MessagePersistenceService (DM rows) · MessagePersistenceDurabilityOwner (hide/unload flush only)
PROOF BEFORE DONE:    L1 dm-persist-owner.contract.test.ts · dm-durability-contract.test.ts
OUT OF SCOPE:         groups/** · engine_invoke db_* cutover · sole-port force (#3) · keychain · UI-kit
```

**Maintainer proceed:** Default plan order — this slice un-pauses **dm-persist** for clarify + flush dedupe only (not full rewrite / not #3–4).

---

## Verdict from study

| Path | Role | This slice |
|------|------|------------|
| `message-persistence-service.ts` | DM bus → SQLite owner | Keep; **remove** duplicate hide/unload listeners |
| `message-persistence-durability-owner.tsx` | Hide/unload/pagehide → `flushPendingNow` | **Sole flush adapter** (existing Phase D contract) |
| `sealed-group-message-persistence.ts` | Group bridge → `appendGroupThreadMessage` | Out of `dm-persist`; **no mutate** (community PAUSED) |

---

## Target ownership

```
messageBus → MessagePersistenceService → writeDmKernelMessage | dbInsertMessage
                                              ↓
                         MessagePersistenceDurabilityOwner (pagehide / beforeunload / visibility)
                                              → flushPendingNow()
```

| Concern | Owner |
|---------|--------|
| Queue + SQLite insert | `message-persistence-service.ts` |
| Lifecycle flush on hide/unload | `message-persistence-durability-owner.tsx` only |
| Native write diagnostics | `dm-kernel-write-port.ts` |
| Group sealed rows | `appendGroupThreadMessage` (not this band) |

---

## Implement slice (smallest · #1–2)

1. **Document** ownership comments on service + durability owner.  
2. **Subtract** service `visibilitychange` / `beforeunload` flush listeners (and dispose cleanup for them). Keep `privacy-settings-changed`.  
3. **L1 contract** — `dm-persist-owner.contract.test.ts`:
   - Durability owner remains mounted from `providers.tsx`
   - Service source must **not** `addEventListener("beforeunload"` / `visibilitychange` for flush
   - Production `dbInsertMessage(` call sites stay on allowlist (document known parallels; no new writers)
4. **Do not** change sealed-group files or force sole insert port (#3).

### `dbInsertMessage` production allowlist (clarify)

| Path | Why allowed this slice |
|------|------------------------|
| `dm-kernel/dm-kernel-write-port.ts` | Canonical native write port |
| `messaging/services/message-persistence-service.ts` | Fallback when `!isDmKernelWriteOwner()` |
| `account-sync/.../native-sqlite-backup-evidence.ts` | Backup probe — separate lifecycle |
| `groups/.../community-dm-invite-pipeline.ts` | Community invite — **PAUSED** neighbor; list only |

---

## Explicit non-goals

- Collapse `db_*` → `engine_invoke`  
- Force all inserts through `writeDmKernelMessage` when authority off  
- Delete durability owner (Phase D requires it)  
- Touch relay-publish or community membership

---

## Proof

| Layer | Command |
|-------|---------|
| L1 | `pnpm --filter @obscur/pwa exec vitest run app/features/messaging/services/dm-persist-owner.contract.test.ts app/features/messaging/services/thread-history/dm-durability-contract.test.ts` |
| L2 | Existing `message-persistence-service.test.ts` if touched behavior |

---

## Claim language

| May say | When |
|---------|------|
| Designed | This doc |
| Implemented | Flush dedupe + comments + L1 green |
| Clarified (heuristic) | L1 allowlist green |
| Fixed (persist dual-owner) | Not yet — need #3 + L3 send→restart |
