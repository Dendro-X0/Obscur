# Design — R-TRANSPORT-CHECKPOINT-UPSERT Slice 9

**Status:** Implemented · L1 Pass · 2026-07-30  
**Prior:** Slice 8 read Pass · ACC-03 write still `dbUpsertRelayCheckpoint`

---

## Session gate

```text
NEXT ATOMIC STEP:     Slice 9 — upsertRelayCheckpoint on transport engine
PAUSED / CANCELLED:   community · AUTH-SESSION-1 · R-RELAY publish rewrite · Dev Lab
CANONICAL OWNER:      libobscur dispatch_transport + @obscur/transport-engine + ACC-03 mirror
PROOF BEFORE DONE:    cargo test -p libobscur upsert · vitest relay-checkpoint + transport-engine-w1 + transport-persistence
OUT OF SCOPE:         Tombstone db_upsert_relay_checkpoint IPC · publishRelayEvent · community
```

---

## Keep-set

| # | Change |
|---|--------|
| 1 | Rust `dispatch_transport` → `upsertRelayCheckpoint` (payload = RelayCheckpointRecord; scope profile match) |
| 2 | Contracts: `TRANSPORT_ENGINE_METHODS.upsertRelayCheckpoint` + builder |
| 3 | `@obscur/transport-engine` `upsertRelayCheckpoint` helper |
| 4 | `mirrorTimelineCheckpointToSqlite` uses engine helper (not `dbUpsertRelayCheckpoint`) |
| 5 | Update w1 contract + store tests · optional libobscur unit test |

## Mental simulation

Sync advances `dm:all` → mirror → N× `engine_invoke` `transport.upsertRelayCheckpoint` → SQLite rows → cold frontier load (Slice 8) sees them.

## Claim language

| May say | When |
|---------|------|
| Implemented | Keep-set landed |
| Verified | Named L1 green |
| Fixed (ACC-03 sole engine) | Reads (8) + writes (9) — IPC `db_*` may remain registered until later tombstone |
