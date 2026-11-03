# Investigation — DM publish ACK honesty (v1.9.15 D2)

**Date:** 2026-08-01  
**Charter:** [v1.9.15-scope.md](../../docs/program/v1.9.15-scope.md) · **D2**  
**Design parent:** [latency-underlay-path-design-2026-08.md](./latency-underlay-path-design-2026-08.md) §3.2 **P-evidence**  
**Handoff:** Soft L3 Fail · `lastSuccessfulPublishAtUnixMs: null` with local echo `sent_visible_local`

---

## Session header

```text
HANDOFF ATOMIC STEP: D3 verify E2d → D2 publish ACK honesty → D1 Soft L3 Pass
PAUSED / CANCELLED:    COM-RUN-* · O-2/O-4 · RIW-8 · Dev Lab as validation · AUTH-SESSION
CANONICAL OWNER:       dm-send-pipeline + dm-relay-transport (publish evidence)
PROOF BEFORE DONE:     L1 dm-send-pipeline tests · Soft L3 re-run (D1, separate claim)
```

---

## Symptom

Soft L3 Row B: marker appears in Tester1 compose (local echo) while relay supervisor still reports `lastSuccessfulPublishAtUnixMs: null`. UI treats the send as accepted (“sent”) without a relay OK.

---

## Canonical path

1. `dm-controller` inserts optimistic message `status: "sending"`.
2. `sendDm` Phase 1: `pool.sendToOpen(EVENT)` — fire-and-forget, no OK wait.
3. With `onConfirmed`: returns immediately with `success: firedToOpenCount > 0` and **fabricates** `relayResults[].success: true` for every open socket.
4. Controller: `immediateStatus = result.success ? "accepted" : "sending"` → green **accepted** without ACK.
5. Phase 2: `publishToRelays` → `publishToUrls` / `publishToAll`; on total failure, **last resort** again calls `sendToOpen` and returns `success: openRelayCount > 0` with fake OK outcomes.
6. `buildSendConfirmation`: `effectiveSuccess = publishSuccess || firedToOpenCount > 0` — wire fire alone counts as success; `deliveryStatus` becomes `sent_partial`.

---

## Root cause (subtraction)

| Layer | Dishonest rule |
|-------|----------------|
| Optimistic return | Open socket count ⇒ `success: true` + fake relayResults |
| `buildSendConfirmation` | `firedToOpenCount > 0` ⇒ `success` / `sent_partial` |
| `publishToRelays` last resort | `sendToOpen` ⇒ `success: true` without OK |

**Invariant violated:** P-evidence / I4 — local echo ≠ relay acceptance; UI success needs ACK / quorum evidence.

`lastSuccessfulPublishAtUnixMs` stays null because real `publishToUrls` never recorded an OK — Soft L3 evidence agrees with transport journal, not with bubble status.

---

## Non-causes (this slice)

- E2d dial starvation (operator Relays show remotes POOL MEMBER) — D3 largely verified.
- Stranger gate / FK on profile-2 — separate receive-side Fail class; Soft L3 already seeds peer trust.
- Soft L3 harness “sent_visible_local” — checks text visibility, not `accepted`; honesty fix does not redefine that probe.

---

## Fix direction (design next)

1. Require **publish OK** for `confirmation.success` and optimistic `accepted`.
2. Keep `sendToOpen` as latency assist only; flag `partialWireDelivery` when wire fired without ACK.
3. Last-resort `sendToOpen` in `publishToRelays` must **not** claim success.
4. Optimistic `onConfirmed` path: return `success: false` (stay `sending`) until ACK; do not invent successful relayResults.

**Out of scope for D2:** fixing Soft L3 Pass (D1) if publish still fails after honesty — that is a separate publish-target / ACK path repair after evidence is honest.
