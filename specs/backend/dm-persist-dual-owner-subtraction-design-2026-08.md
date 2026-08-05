# Design — dm-persist dual-owner (taxonomy close)

**Date (UTC):** 2026-08-04  
**Investigation:** [dm-persist-dual-owner-subtraction-investigation-2026-08.md](./dm-persist-dual-owner-subtraction-investigation-2026-08.md)

---

## Verdict

**No Obscur product code for this slice.** CodaCtrl `dm-persist` dual-owner is a **path-heuristic false positive**.

| Writer | Actual lifecycle |
|--------|------------------|
| `message-persistence-service.ts` | **Canonical DM** message-bus → SQLite |
| `message-persistence-durability-owner.tsx` | Flush/lifecycle shell for the service above (same owner chain) |
| `workspace-group-message-persist-port.ts` | **Group** thread history port |
| `sealed-group-message-persistence.ts` | **Group** sealed → `appendGroupThreadMessage` only |

DM canonical owner remains `MessagePersistenceService` (+ durability owner). Group sealed persist must **not** be subtracted or “fixed” as DM — and must not be patched under COM-RUN pause as a community feature.

### Ask (CodaCtrl)

Split lifecycle taxonomy: `dm-persist` vs `group-persist` so sealed-group / group-thread ports do not score as DM dual-owners.

### Obscur follow-on (separate atomic)

Real dual-owner still open: **`relay-publish`** (multiple relay-pool hooks). Study **relays/** + conduit-mesh only; leave `groups/**` writers as freeze/stop-writing (PAUSED).

---

## Status

**Closed (investigation)** — 2026-08-04 · no L1 product change · taxonomy documented.
