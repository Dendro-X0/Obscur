# Design — R-TRANSPORT-CHECKPOINT-ACL Slice 10

**Status:** Implemented · L1 Pass · 2026-07-30  
**Prior:** Slice 8–9 ACC-03 product path solely on `engine_invoke` transport methods

---

## Session gate

```text
NEXT ATOMIC STEP:     Slice 10 — ACL quarantine unused checkpoint db_* IPC
PAUSED / CANCELLED:   community · AUTH-SESSION-1 · R-RELAY rewrite · Dev Lab
CANONICAL OWNER:      transport.listRelayCheckpoints / upsertRelayCheckpoint via engine_invoke
PROOF BEFORE DONE:    vitest engine-invoke-boundary-catalog · app.toml omits checkpoint db_*
OUT OF SCOPE:         Delete Rust db_* handlers (later tombstone) · integrity migrate · P2 soak
```

---

## Facts

| Fact | Evidence |
|------|----------|
| Product ACC-03 uses engine only | `relay-checkpoint-sqlite-store.ts` |
| Zero feature `dbGetRelayCheckpoints` / `dbUpsertRelayCheckpoint` | Grep product `.ts` |
| Still ACL-allowed | `allow-db-commands` in `permissions/app.toml` |

Same pattern as relay R2: remove from allow so a reintroduced bare invoke fails closed.

---

## Keep-set

| # | Change |
|---|--------|
| 1 | Remove `db_upsert_relay_checkpoint`, `db_get_relay_checkpoint`, `db_get_relay_checkpoints` from `commands.allow` |
| 2 | Comment pointing at Slice 8–9 + this design |
| 3 | L1: boundary catalog asserts ACL omit + product features have no those invokes |
| 4 | Keep handlers registered (tombstone = Slice 11 later) |

## Proof

| Layer | Command |
|-------|---------|
| L1 | `pnpm -C apps/pwa exec vitest run app/engine-lab/engine-invoke-boundary-catalog.contract.test.ts` |
