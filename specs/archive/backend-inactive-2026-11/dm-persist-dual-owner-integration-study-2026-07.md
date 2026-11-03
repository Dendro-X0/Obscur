# Integration study — `dm-persist` dual-owner subtract

**Status:** Study only · 2026-07-30 · **no product code** until design + handoff un-pause for this band  
**Charter:** [rust-module-refactor-queue-2026-07.md](./rust-module-refactor-queue-2026-07.md)  
**Related:** [r-rust-boundary-slice3-investigation-2026-07.md](./r-rust-boundary-slice3-investigation-2026-07.md) · [r-scope-slice2-investigation-2026-07.md](./r-scope-slice2-investigation-2026-07.md)  
**Trigger:** Maintainer redirect — “dual-owner subtract” (supersedes R-ACCOUNT keychain as next atomic)

---

## Session gate

```text
NEXT ATOMIC STEP:     Dual-owner subtract — dm-persist integration study (this doc)
PAUSED / CANCELLED:   community · COM-RUN-* · relay-publish rewrite · AUTH-SESSION-1 · Dev Lab
                      (dm-persist rewrite stays PAUSED for mutate until design signed)
CANONICAL OWNER (target): message bus → MessagePersistenceService → dm-kernel write port → single SQLite path
PROOF BEFORE DONE:    L1 owner contract (Slice-2 style) · design subtract list · then L3 DM send→restart
OUT OF SCOPE:         Product deletes · UI-kit · community membership · keychain code · relay-publish mutate
```

---

## Integration checklist

| Gate | Status |
|------|--------|
| Working neighbors listed | Done — §Neighbors |
| Interface contract (`profileId`, inputs/outputs, proof) | Draft — §Contract |
| Parallel writers classified + subtraction plan | Draft — §Triage / §Subtract |
| Automated scenario named before manual soak | Draft — §Proof |
| Handoff one next atomic step | Pending — update after maintainer accepts triage |

---

## Heuristic writers (CodaCtrl score 3) → role triage

| Path | Real role (code) | Dual-owner? | Slice action |
|------|------------------|-------------|--------------|
| `messaging/services/message-persistence-service.ts` | **DM persist owner** — messageBus → queue → native flush → `writeDmKernelMessage` / `dbInsertMessage` | Lifecycle owner | **Keep canonical** |
| `messaging/components/message-persistence-durability-owner.tsx` | **Flush adapter only** — `pagehide` / `beforeunload` / `visibilitychange` → `flushPendingNow()` | No (not a row writer) | Clarify as reader/adapter; **subtract duplicate flush** vs service’s own listeners |
| `groups/services/sealed-group-message-persistence.ts` | **Group thread bridge** → `appendGroupThreadMessage` → `db_insert_group_message` | Different lifecycle (`group-persist`) | Reclassify out of `dm-persist`; **do not mutate** while community PAUSED |

**Working verdict:** Path heuristic over-counts (same pattern as R-SCOPE). True **DM row mutate** is concentrated in `MessagePersistenceService.flushQueue`. Group SQLite is a **separate owner** already documented as canonical in `group-thread-append.ts`.

---

## Real parallel paths (beneath the heuristic)

| Parallel | A | B | Risk |
|----------|---|---|------|
| Flush on hide/unload | Service `onVisibilityChange` / `onBeforeUnload` | `MessagePersistenceDurabilityOwner` | Double flush — harmless but dual adapter |
| Native DM insert | `writeDmKernelMessage` → `dbInsertMessage` | Direct `dbInsertMessage` when `!isDmKernelWriteOwner()` | Same Tauri `db_*` command; policy fork not second store |
| Boundary (Slice 3 E) | All product writes via `@dweb/db` → `db_*` | Future `engine_invoke` / libobscur | **LEGACY_PARALLEL** — tombstone only after this band’s design |

`dm-kernel-write-port` is a **fail-loud wrapper**, not a second persistence engine. Subtract target is **policy fork + `db_*` vs `engine_invoke`**, not deleting the kernel port.

---

## Canonical path (target)

```
messageBus (new_message / message_updated)
  → MessagePersistenceService (bound profileId)
    → queueMessageUpsert / flushQueue
      → writeDmKernelMessage (native authority)  [sole insert port]
        → single SQLite invoke (today db_insert_message; later engine_invoke)
```

| Concern | Single owner |
|---------|----------------|
| DM bus → durable row | `message-persistence-service.ts` |
| Native write port + diagnostics | `dm-kernel-write-port.ts` (must always be the only call site for inserts) |
| Hide/unload flush | One adapter — prefer service listeners **or** durability owner, not both |
| Group sealed commit | `appendGroupThreadMessage` (out of `dm-persist` lifecycle id) |

---

## Neighbors (must not regress)

| Neighbor | Why |
|----------|-----|
| `session-hydrate` / auth-kernel boot | Profile bind before SQLite writes |
| `profile-scope` (Slice 2) | `boundProfileId` === `getResolvedProfileId()` gate |
| `@dweb/db` / Tauri `db_*` | Current wire; freeze package churn until engine cutover design |
| Account sync / backup evidence | Calls `dbInsertMessage` / probe paths |
| Group thread ingest | Separate; community band still PAUSED |

---

## Contract (re-integration)

| Field | Value |
|-------|--------|
| Inputs | `profileId` (bound), conversationId, Message with confirmed `eventId` on Tauri |
| Outputs | SQLite message + conversation rows; chat-state mirror for DM only (groups skipped) |
| Evidence | `messaging.native_sqlite_write_*` / `dm_kernel.sqlite_write_*` events |
| Forbidden | Second bus subscriber that inserts rows; IndexedDB dual-write on Tauri; UI “repair” of missing rows |

---

## Mental simulation — one DM send

1. User sends DM → bus `new_message` (optimistic UUID).  
2. Tauri: upsert **skipped** until `eventId` confirmed.  
3. Confirmed event → queue → flush → `writeDmKernelMessage` → `db_insert_message`.  
4. Hide/close → flush (once).  
5. Restart → thread load from SQLite (dm-kernel / `db_get_messages`), not chat-state alone.

**Failure modes if subtract wrong:** drop durability flush → lost last batch; delete sealed-group bridge while “fixing DM” → group history break; route half of writers to `engine_invoke` without tombstone of `db_*` → dual store truth.

---

## Subtract list (ordered · no code yet)

| # | Action | Risk | Gate |
|---|--------|------|------|
| 1 | **Clarify register** — durability = flush adapter; sealed-group = `group-persist` | Low | L1 contract test (path allowlist) |
| 2 | **Dedupe flush** — one of service listeners vs durability owner | Low | L1 + smoke hide→flush |
| 3 | **Force sole insert port** — flushQueue never calls `dbInsertMessage` except via `writeDmKernelMessage` | Med | dm-kernel write tests + L3 DM |
| 4 | **Boundary** — map `db_insert_message` → `engine_invoke` (Slice 3 E) | High | Separate design; keep-set Rust |

**Not in this band:** deleting `packages/db`; community sealed-group rewrites; chat-state IndexedDB on web.

---

## Proof plan

| Layer | Command / evidence |
|-------|-------------------|
| L1 | New `dm-persist-owner.contract.test.ts` (roles allowlist + no second insert call site) |
| L2 | Existing `message-persistence-service.test.ts` · `dm-kernel-write-port.test.ts` |
| L3 | Parity-desktop: send DM → restart → row present (`db_get_messages` / kernel thread) |
| L4 | Optional two-profile soak — **not** required to claim clarify/dedupe |

---

## Un-pause charter (maintainer)

Un-pause **`dm-persist` rewrite** for mutate when:

1. This study accepted.  
2. Design doc names subtract #1–2 (or #1–3) as the first code slice.  
3. Community remains PAUSED — no `groups/**` churn in the first slice.  
4. R-ACCOUNT keychain stays siloed (parallel evidence only).

---

## Claim language

| May say | Only when |
|---------|-----------|
| Clarified (heuristic) | L1 allowlist green |
| Implemented (dedupe / sole port) | Diff matches design slice |
| Fixed (persist) | L3 send→restart agrees with L1/L2 |
