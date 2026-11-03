# Investigation — Soft L3 Fail after D2 (S1 drops local, remotes no ACK)

**Date:** 2026-08-01  
**Charter:** v1.9.15 **D1** Soft L3  
**Evidence:** `test-results/s-pool-delivery-l3-2026-08-01.json` · `s-pool-l3-publish-diag.json`

```text
HANDOFF ATOMIC STEP: D1 Soft L3 Pass
PAUSED / CANCELLED:    COM-RUN-* · O-2/O-4 · RIW-8 · Dev Lab · AUTH-SESSION
CANONICAL OWNER:       dm-relay-transport publishToRelays (+ S1 scope)
PROOF BEFORE DONE:     L1 transport tests · Soft L3 re-run
```

## Symptom

Row A Pass · Row B Fail · `sent_visible_local` · `lastSuccessfulPublishAtUnixMs: null` · `writable ≥ 1`.

## Cause

1. D2 correctly refuses wire-fire as success (local echo ≠ ACK).
2. S1 (`resolveScopedPublishRelayUrls`) drops open `localhost:7000` when any remote candidate is open.
3. Phase 2 publishes remotes only; remotes fail OK → timestamp stays null → Tester2 never sees event on agreed lab path.
4. Soft L3 agreed path is `ws://localhost:7000` — P-local allows lab publish when both enable it.

## Fix direction

Keep S1 first preference (remotes). After scoped remote publish fails quorum, **retry open local workspace relay** before `publishToAll` / fire-and-forget. Do not reclaim success from `sendToOpen`.
