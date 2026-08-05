# Investigation — lastSuccessfulPublishAtUnixMs null after dm-send confirmed

**Date (UTC):** 2026-08-02  
**Handoff residual** after R0–R3 demo exit  
**Evidence:** Soft L3 report `s-pool-delivery-l3-2026-08-02.json` — `[dm-send] confirmed` `success:true` · `lastSuccessfulPublishAtUnixMs: null` for 20s poll

---

## Session header

```text
NEXT ATOMIC STEP:     Residual — publish ledger honesty (lastSuccessfulPublishAtUnixMs)
PAUSED / CANCELLED:   COM-RUN-* · AUTH-SESSION · Dev Lab as validation
CANONICAL OWNER:      use-conduit-mesh-relay-pool publishToUrls stamp → obscurRelayRuntime
PROOF BEFORE DONE:    L1 hook/unit · Soft L3-style read shows stamp after confirmed publish
OUT OF SCOPE:         AUTH-SESSION F5 · community · claiming Soft L3 again
```

---

## Symptom

DM publish ACK succeeds (`[dm-send] confirmed`, UI `accepted`) but `window.obscurRelayRuntime.getSnapshot().lastSuccessfulPublishAtUnixMs` stays **null**. Soft L3 / Relays UI ledger looks dishonest vs console ACK.

---

## Canonical path

1. `publishToRelays` → `pool.publishToUrls` (mesh)  
2. On success, `use-conduit-mesh-relay-pool` **stamps** React `activitySnapshot.lastSuccessfulPublishAtUnixMs`  
3. `getTransportActivitySnapshot()` spreads `activitySnapshot`  
4. Supervisor `refresh` → `extractRelayRecoveryAdapterMetrics` → runtime snapshot field  

---

## Root cause (hypothesis)

Stamp is applied via `setActivitySnapshot` only. `getTransportActivitySnapshot` closes over **rendered** `activitySnapshot`. Until re-render, pool readers (supervisor refresh, Soft L3 poll in the same tick window) still see **pre-stamp** snapshot. Evidence-driven `mergeActivitySnapshot` can also race before the stamp commit.

**Invariant:** P-evidence — successful `publishToUrls` must be visible on `getTransportActivitySnapshot()` **synchronously** after the await returns, without waiting for React commit.

---

## Fix direction

1. Keep a **ref** updated synchronously on successful `publishToUrls`.  
2. `getTransportActivitySnapshot` overlays `ref.lastSuccessfulPublishAtUnixMs ?? activitySnapshot…`.  
3. Preserve ref across `mergeActivitySnapshot` (ref wins until cleared).  
4. L1: unit/test the overlay / stamp helper if extractable; otherwise document Soft L3 re-read optional.

**Out of scope:** AUTH-SESSION / session.identityStatus locked divergence (separate residual; CANCELLED band risk).
