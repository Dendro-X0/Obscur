# Investigation — Relays UI signal n/a while DMs work

**Date (UTC):** 2026-08-04  
**Status:** Pass (L1)  
**Evidence:** Maintainer Relays metrics — nos/damus CONNECTING + signal `n/a` + PRIMARY (OFFLINE); footer Publish-ready 3 of 4; A↔B DM works; localhost STANDBY (lab silo OK).

---

```text
NEXT ATOMIC STEP:     Align Relays card signal/status with mesh publish-ready (UX honesty)
PAUSED / CANCELLED:   COM-RUN-* · O-2/O-4 · RIW-8 · Dev Lab · AUTH-SESSION · groups/**
CANONICAL OWNER:      deriveRelayNodeStatus · formatRelayLatencyLabel · RelayMetricCard
PROOF BEFORE DONE:    L1 runtime-status + latency-label tests
OUT OF SCOPE:         Soft L3 Docker · public Nostr SLA · AUTH-SESSION
```

---

## Root cause

| Layer | Truth |
|-------|--------|
| DM / mesh | `publishReadyRelayUrls` / writable count — messaging works |
| Card badge/RTT | `pool.connections[].status` + `healthMetrics.latency` |
| Footer “Open sockets” | `Math.max(openWs, writableRelayCount)` — inflates open count |

When mesh marks a URL publish-ready but the thin WS snapshot stays `connecting`, cards show CONNECTING / Primary (offline) / `n/a` even though transport can deliver.

## Fix (subtraction / overlay)

1. `isPublishReady` on node status — if true and connection is not `error`, treat UI connection as `open` for `deriveRelayNodeStatus`.
2. `formatRelayLatencyLabel` — if no latency sample but publish-ready → `"Ready"` (not `n/a`).
3. Footer: stop counting writable as open sockets (`openCount` = real WS open only).

No new owner. Lab silo unchanged.
