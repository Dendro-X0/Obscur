# Investigation — Invite publish → mesh pool (pre-W66)

**Date (UTC):** 2026-08-04  
**Trigger:** Web-legacy browser-pool EVENT retired; W66 thin-port still unsafe until invites leave standalone  
**Soft L3 re-proof:** Blocked (harness CDP page closed / isShell drift) — DM path owner unchanged by gate flip

---

## Session header

```text
NEXT ATOMIC STEP:     Invite publish → mesh (design → impl)
PAUSED / CANCELLED:   COM-RUN-* · O-2/O-4 · RIW-8 · Dev Lab · AUTH-SESSION · groups/**
CANONICAL OWNER:      conduit-mesh pool publishToUrls (same Soft L3 / DM path)
PROOF BEFORE DONE:    Design · retarget invite-manager · L1 contracts · Soft L3 optional
OUT OF SCOPE:         W66 file delete until invites green · groups/** · AUTH-SESSION
```

---

## Current

| Caller | Publish API | After 2026-08 gate flip |
|--------|-------------|-------------------------|
| Soft L3 / DM | `pool.publishToUrls` (mesh) | Unchanged |
| `invite-manager` connection request | `publishToUrlsStandalone` | Transport-kernel (not browser-pool) |
| W66 thin port | fail-closed blocked | Would break invites on native |

`InviteManagerImpl` is a **non-React singleton** — cannot call `useConduitMeshRelayPool` directly. Need an injectable publish port or module accessor that shares the live mesh pool.

Existing helper: `publishDmNostrEvent(pool, urls, event)` — pattern for pool-injected publish.

---

## Subtract plan

1. Define `InviteRelayPublishPort` (`publishToUrls(urls, payload)`)  
2. Wire from messaging/relay React layer (where pool exists) into invite manager  
3. Remove `publishToUrlsStandalone` import from invite-manager  
4. Update `path-b-b2-2-exit.contract.test.ts`  
5. Only then W66 thin-port / deletion

---

## Status

**Investigation** → design next
