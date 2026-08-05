# Design — R-TRANSPORT-CHECKPOINT-READ Slice 8

**Status:** Implemented · L1 Pass · 2026-07-30  
**Investigation:** [r-transport-checkpoint-read-slice8-investigation-2026-07.md](./r-transport-checkpoint-read-slice8-investigation-2026-07.md)

---

## Session gate

```text
NEXT ATOMIC STEP:     Slice 8 implement ACC-03 read via transport engine
PAUSED / CANCELLED:   community · AUTH-SESSION-1 · R-RELAY rewrite · Dev Lab
CANONICAL OWNER:      relay-checkpoint-sqlite-store load → listRelayCheckpoints
PROOF BEFORE DONE:    pnpm -C apps/pwa exec vitest run app/features/messaging/services/relay-checkpoint-sqlite-store.test.ts
OUT OF SCOPE:         upsert method · publish · community
```

---

## Keep-set

| # | Change |
|---|--------|
| 1 | `loadSqliteRelayCheckpointFrontier` uses `listRelayCheckpoints` + `getTransportEngineHost` |
| 2 | Remove `dbGetRelayCheckpoints` import from store |
| 3 | Keep `mirrorTimelineCheckpointToSqlite` on `dbUpsertRelayCheckpoint` |
| 4 | Update unit tests; assert no `dbGetRelayCheckpoints` in store source (inline or contract) |

## Mental simulation

Cold sync needs frontier → load → `engine_invoke` `transport.listRelayCheckpoints` → max `last_event_at`. Mirror writes still persist via `db_upsert_relay_checkpoint` until a later upsert design.

## Proof

| Layer | Command |
|-------|---------|
| L1 | vitest `relay-checkpoint-sqlite-store.test.ts` (+ optional transport-engine-w1) |
