# Investigation — Send regression (open=0) + startup ghost call

**Date (UTC):** 2026-08-05  
**Status:** Confirmed  
**Trigger:** Maintainer screenshots after relay-warmup slice

---

```text
HANDOFF ATOMIC STEP: Relay warm-up + notification hygiene (regression)
PAUSED / CANCELLED:   Dev Lab · COM-RUN-* · O-2/O-4 · RIW-8 · AUTH-SESSION · groups/**
CANONICAL OWNER:      warmRelayNetworkForSend · use-conduit-mesh-relay-pool · call-record-sqlite-store
PROOF BEFORE DONE:    L1 warmup + call-record + mesh wait tests
OUT OF SCOPE:         Soft L3 · AUTH-SESSION · groups/** · video · public Nostr SLA
```

## A — Cannot send / “Delivery could not be confirmed”

**Evidence:** Relays footer `Publish-ready 2 of 2 • Open sockets 0 of 2`. Cards QUIET/ACTIVE TRANSPORT. Outgoing toast: Delivery could not be confirmed.

**Causes:**

1. `resolveWritableRelayUrls` unions **probe** `publishReadyRelayUrls` with open sockets → publish-ready can be 2 while open is 0.
2. `waitForConnection` short-circuits on `hasWritableRelay` (probe-backed) without an open socket.
3. `waitForScopedConnection` treats probe writable URLs as ready.
4. `warmRelayNetworkForSend` treated `warmed === true` as ready even when `openRelayCount === 0` → publish proceeds without sockets → ACK fail → red toast. **Worse than pre-warm** when wait falsely succeeds, or blocks then still fails.

## B — Startup ghost call (CALL COMPLETED · 0:30 · Ended normally)

**Evidence:** Invite→ended ~57s, duration shown 0:30, card state completed/ended normally without a real peer connect.

**Cause:** `mapCallRecordToVoiceCallRoomSummary` treats sqlite status `"ended"` like `"answered"` (`connectedAtUnixMs = started_at`, `endedNormally = true`). Timeout/missed terminals stored as `"ended"` render as completed calls. Merge ORs `endedNormally` from sqlite over message timeline honesty.

## Repair

1. Warm: `ready` only when `openRelayCount > 0`.
2. Mesh waits: resolve true only when connection snapshots show `open` (scoped match for scoped wait).
3. Call summary map: only `"answered"` ⇒ connected / endedNormally; `"ended"`/`timeout`/`missed` ⇒ not completed.
4. Optional one reconnect+rewait when open stays 0 after first warm (subtraction-friendly: use existing `reconnectAll`).

## Residual (2026-08-05 maintainer re-report)

**Evidence:** Still `Publish-ready 2 · Open sockets 0`; send still fails on A/B; option A cold-start ghost CALL COMPLETED 0:30.

**Additional cause:** Mesh pool `reconnectAll` only called `runtime.configureUrls` — it never re-dialed `createConduitMeshNostrWsClient` sockets. After sockets close (or stick closed), warm’s `reconnectAll({ force: true })` was a no-op for open count. Cards/QUIET still show historical connect RTT from health monitor.

**Follow-up repair:**

1. `forceReconnectAll(urls?)` on nostr WS client — tear down + dial.
2. Mesh `reconnectAll` → `forceReconnectAll(poolUrls)`.
3. Warm: force-dial **before** first wait when open=0 (avoid burning full timeout on dead sockets).
