# Design — Reconnect surfaces Requests pending card (2026-11-07)

```text
HANDOFF ATOMIC STEP: Requests-tab follow-up after delete/reconnect L2 Partial
PAUSED: Soft L3 · Tor · Matrix
CANONICAL OWNER: connection-handshake-machine · use-requests-inbox · contact-request-incoming-lifecycle
PROOF: L1 vitest (handshake · merge · lifecycle) · claim Fixed only after L2 re-soak optional
```

## Goal

After peer Remove → reconnect invitation, the recipient Requests tab shows an **incoming pending** card (Accept/Decline), not an empty inbox while Hello lands only in the DM thread.

## Invariants

1. Remote `connection-cancel` demotes local handshake out of `accepted` (bilateral reset).
2. `CONTACT_REMOVED` and the legacy inbox mirror agree: no sticky `accepted` after remove notify.
3. Under projection-read authority, a distinct `CONTACT_REQUEST_RECEIVED` (incoming pending) wins over stale legacy accepted/canceled stubs in the merge.
4. Do not recreate placeholder `canceled`/`declined` projection rows after remove (existing reducer rule).

## Changes (smallest)

### A. Handshake machine

`accepted` + `CANCEL` → `{ status: "canceled", isOutgoing }` so `setStatus({ status: "canceled" })` is not a no-op.

### B. Cancel lifecycle

Prefer `requestsInbox.remove({ peerPublicKeyHex })` when available (clears legacy + emits `CONTACT_REMOVED` + evidence reset). Keep `unacceptPeer`. Drop redundant `setStatus(canceled)` + duplicate append when `remove` is used.

Fallback when `remove` missing: `setStatus(canceled)` + existing `CONTACT_REMOVED` append.

### C. Inbox merge

Before accepted-sticky / outgoing-open preference: if projection item is **incoming pending**, take projection (fresher request evidence). Prevents Accept-card suppression when upsert is a no-op under projection-write policy.

## Proof

| Layer | Command / assert |
|-------|------------------|
| L1 | `transitionHandshake(accepted, CANCEL)` → canceled |
| L1 | merge helper or inbox unit: projection pending beats legacy accepted |
| L1 | lifecycle cancel calls `remove` when provided |
| L2 (optional) | re-soak Requests pending card after Remove→Connect |

## Non-goals

- Changing send/Invitation wire format.
- Soft L3 / Tor / Matrix.
- Packaged NSIS soak unless operator asks.
