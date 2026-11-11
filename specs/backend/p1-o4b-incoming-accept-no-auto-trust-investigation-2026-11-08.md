# Investigation — Pending vanish + TRUSTED without Accept (2026-11-08)

```text
HANDOFF ATOMIC STEP: Soft L3 Requests — pending survives refresh; no TRUSTED without user Accept
PAUSED / CANCELLED: Soft L3 Fixed · Tor · Matrix promote · Continuity · packaged Pass
CANONICAL OWNER: applyIncomingContactLifecycle (connection-accept) · use-requests-inbox tab filter
PROOF BEFORE DONE: L1 unit · user Soft L3 soak
```

## Evidence (user Soft L3 reseed)

| Observation | Implication |
|-------------|-------------|
| Tester 2 Requests → **NO OPEN REQUESTS** after refresh / restart | Pending row gone from tab |
| Network still **Tester 1 TRUSTED** | Trust applied without Requests Accept click |
| Chat shows Hello + multiple **YOU Accepted** + Connection removed | Lifecycle / accept ceremony traffic in Soft L3 lookback |
| Banner: peer relay nos.lol | Hybrid residue; Soft L3 exclusive still owed separately |

## Root cause (primary)

`applyIncomingContactLifecycle` on **`connection-accept`** always calls `peerTrust.acceptPeer` + `setStatus(accepted)` (unless `removedPeers` mask).

Soft L3 DM subscribe lookback (7d) re-delivers historical `t=connection-accept` events. On the **incoming** invitee side (pending request not yet user-Accepted), that auto-trusts and marks inbox **accepted**.

`getRequestsTabItems` only shows pending / outgoing resendable — **accepted rows leave the Requests tab** → "NO OPEN REQUESTS" after refresh when lookback re-applies accept.

## Hypotheses

### H-accept-1 — Remote accept auto-trusts incoming pending (confirmed in code)

Wire `connection-accept` must complete **our outgoing invite**, not Accept an incoming pending for us. Local Accept is `requestTransport.acceptPeer` (user gesture).

### H-accept-2 — Sticky accepted merge prefers accepted over pending (secondary)

`mergeProjectionWithLegacyRequestsInbox` keeps accepted sticky — after H-accept-1 fires once, hydrate keeps accepted.

### H-accept-3 — Pending not persisted (falsify after H-accept-1)

If pending still vanishes with no auto-trust, check storage/hydrate separately.

## Non-causes

- Requests header UI layout
- H5 Soft L3 publish pin alone

## NEXT

Design: gate remote `connection-accept` → `acceptPeer` only when local inbox shows **outgoing** invite (or equivalent). L1 tests for incoming-pending ignore.
