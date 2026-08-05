# Investigation — R-TRANSPORT-CHECKPOINT-READ Slice 8

**Status:** Investigation · 2026-07-30  
**Prior:** Slice 6–7 DM sole engine reads

---

## Session gate

```text
NEXT ATOMIC STEP:     Slice 8 — ACC-03 checkpoint read dual path
PAUSED / CANCELLED:   community · AUTH-SESSION-1 · R-RELAY rewrite · Dev Lab
CANONICAL OWNER (target): @obscur/transport-engine listRelayCheckpoints → engine_invoke
PROOF BEFORE DONE:    Call-graph inventory
OUT OF SCOPE:         dbUpsertRelayCheckpoint (no engine method yet) · publishRelayEvent · community
```

---

## Facts

| Path | Owner today |
|------|-------------|
| `loadSqliteRelayCheckpointFrontier` | `dbGetRelayCheckpoints` |
| `transport-relay-supervisor-bootstrap` | already `listRelayCheckpoints` via engine host |
| Rust | `dispatch_transport` has `listRelayCheckpoints` |
| Write mirror | still `dbUpsertRelayCheckpoint` — **defer** (no transport upsert method) |

**Verdict:** Read dual ownership is real; subtract ACC-03 load to transport engine. Writes stay on `db_*` until a designed upsert method lands (not this slice; not R-RELAY publish).

---

## Keep-set

1. `loadSqliteRelayCheckpointFrontier` → `listRelayCheckpoints({ host, profileId })`  
2. Host: `getTransportEngineHost()` (same as supervisor bootstrap)  
3. Update unit test mocks  
4. Contract: store must not call `dbGetRelayCheckpoints`
