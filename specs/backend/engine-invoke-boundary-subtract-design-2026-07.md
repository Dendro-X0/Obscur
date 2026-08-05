# Design — `engine_invoke` boundary subtract (dm #4 · relay #5)

**Status:** B1+B2+B3(backup) implemented · B2 L3 VERIFIED · 2026-07-30 · full B3 tombstone blocked (community)  
**Charter:** [rust-module-refactor-queue-2026-07.md](./rust-module-refactor-queue-2026-07.md)  
**Prior:** [r-rust-boundary-slice3-investigation-2026-07.md](./r-rust-boundary-slice3-investigation-2026-07.md) · [dm-persist #3](./dm-persist-dual-owner-slice3-design-2026-07.md) · [relay #1–3](./relay-publish-lab-shim-tombstone-design-2026-07.md)  
**B3 slice:** [engine-invoke-b3-backup-evidence-migrate-design-2026-07.md](./engine-invoke-b3-backup-evidence-migrate-design-2026-07.md)  
**L3 evidence:** [dual-owner-b2-l3-engine-invoke-2026-07-30.md](../../docs/handoffs/dual-owner-b2-l3-engine-invoke-2026-07-30.md) — insert→cold restart PASS; UI send deferred (relays unreachable).

---

## Session gate

```text
NEXT ATOMIC STEP:     Dual-owner subtract — engine_invoke boundary design + L1 catalog
PAUSED / CANCELLED:   community · AUTH-SESSION-1 · Dev Lab
CANONICAL OWNER (target):
  DM write → writeDmKernelMessage → engine_invoke dm.insertMessage (future)
  Relay EVENT → transport-kernel → engine_invoke / async host (single) · not raw relay::publish_event from product
PROOF BEFORE DONE (this slice): L1 boundary-catalog contract only
OUT OF SCOPE:         Deleting db_* / relay::publish_event handlers · community · R-ACCOUNT keychain
```

---

## Why now

| Band | TS status | Rust boundary |
|------|-----------|---------------|
| `dm-persist` | #1–3 done — sole write port | Still `db_insert_message` under `@dweb/db` |
| `relay-publish` | #1–3 done — native kernel path | Still `relay::publish_event` **and** `engine_invoke_transport_publish_relay_event` |
| Community | PAUSED | No touch |

TS dual-owner noise is cleared. Remaining dual ownership is **LEGACY_PARALLEL** at the Tauri command surface.

---

## Parallel paths (current)

### DM insert

```
MessagePersistenceService
  → writeDmKernelMessage
    → dbInsertMessage → invoke("db_insert_message")   ← LEGACY_PARALLEL
```

`libobscur` `dm` dispatch today: `getThread`, `listConversations` only — **no** `insertMessage`.

### Relay publish

```
publishToRelayStandalone (native)
  → publishTransportKernelToRelay → (TS/host stack)
Rust still registers:
  relay::publish_event
  engine_invoke_transport_publish_relay_event  (async; host/network gated)
```

---

## Target (after mutate slices)

```
DM bus flush
  → writeDmKernelMessage
    → engine_invoke { engine: "dm", method: "insertMessage", scope, payload }
      → libobscur::dispatch → Database::insert_message
    (db_insert_message tombstoned when zero keep-set callers)

Native EVENT
  → transport-kernel only
  → one Rust entry (prefer engine_invoke_transport_* / dispatch; quarantine raw relay::publish_event from product TS)
```

---

## Ordered mutate slices (after this catalog)

| # | Slice | Risk | Gate |
|---|--------|------|------|
| B1 | Add `dm.insertMessage` (+ `upsertConversation`) to `dispatch_dm` | Med | **Done** — libobscur unit |
| B2 | Point `writeDmKernelMessage` at `engine_invoke` when Tauri | Med | **Done** — L1 write-port |
| B3 | Tombstone `db_insert_message` from product allowlist when callers=0 | High | **Partial** — backup migrated; community invite still allowlisted (PAUSED) |
| R1 | Inventory TS callers of `publish_event` vs transport-kernel | Low | L1 |
| R2 | Quarantine product use of raw `relay::publish_event` invoke | Med | **Done** — ACL deny + L1 |
| R3 | Collapse / tombstone unused relay command | High | **Done** — IPC `publish_event` removed; keep `publish_event_with_ack` |

---

## L1 catalog contract

File: `apps/pwa/app/engine-lab/engine-invoke-boundary-catalog.contract.test.ts`

| Assert | Source |
|--------|--------|
| `dispatch_dm` has getThread / listConversations | `packages/libobscur/src/engine_invoke.rs` |
| `dispatch_dm` does **not** yet contain `insertMessage` | same (documents gap for B1) |
| Desktop `generate_handler!` includes `db_insert_message` and `engine_invoke` | `apps/desktop/src-tauri/src/lib.rs` |
| Desktop registers both `relay::publish_event` and `engine_invoke_transport_publish_relay_event` | same |
| Product DM write port still calls `dbInsertMessage` | `dm-kernel-write-port.ts` |

---

## Explicit non-goals

- Implementing B1–B3 / R2–R3 in this step  
- Deleting handlers  
- L3 on stale skip-build shell  
- Community invite `dbInsertMessage` caller  

---

## Claim language

| May say | When |
|---------|------|
| Designed | This doc |
| Implemented (catalog) | L1 green |
| Fixed (single SQLite / publish invoke) | After B2/R2 + L3 on **rebuilt** parity |
