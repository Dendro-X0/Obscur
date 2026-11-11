# Design — Remote connection-accept must not auto-trust incoming pending (2026-11-08)

```text
HANDOFF ATOMIC STEP: Soft L3 Requests — pending survives refresh; no TRUSTED without user Accept
PAUSED / CANCELLED: Soft L3 Fixed · Tor · Matrix promote · Continuity · packaged Pass
CANONICAL OWNER: applyIncomingContactLifecycle
PROOF BEFORE DONE: L1 vitest · user Soft L3 soak
```

## Invariant

Wire `t=connection-accept` means **the peer accepted our outgoing invite**. It must never Accept an **incoming** pending request on our behalf (that is only `requestTransport.acceptPeer` after user gesture).

## Contract

| Local inbox for peer | On remote `connection-accept` |
|----------------------|-------------------------------|
| outgoing pending/accepted | `acceptPeer` + `setStatus(accepted)` (unchanged) |
| incoming pending / no status / null | **no-op** (no trust, no accepted status) |
| under `removedPeers` | no-op (existing) |

## Implementation

In `applyIncomingContactLifecycle` `connection-accept` branch, after removed-mask check:

```ts
if (existing?.isOutgoing !== true) {
  return;
}
```

Then existing acceptPeer / setStatus / CONTACT_ACCEPTED path.

## Non-goals

- Soft L3 Fixed claim
- Full lookback event-order engine
- Requests header UI

## Proof

| Layer | Gate |
|-------|------|
| L1 | incoming pending + connection-accept → acceptPeer not called; outgoing pending → acceptPeer called |
| Manual | Soft L3: invite appears Requests · refresh · still pending · Network not TRUSTED until Accept |
