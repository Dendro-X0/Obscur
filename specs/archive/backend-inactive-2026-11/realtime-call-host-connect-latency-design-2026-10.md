# Design — Host dial→connected latency (R3)

**Date (UTC):** 2026-10-19  
**Status:** Implemented (L1) · host_connected dial/offer elapsed diagnostics  
**Parent:** [realtime-call-perf-stability-ux-investigation-2026-10.md](./realtime-call-perf-stability-ux-investigation-2026-10.md)

```text
HANDOFF ATOMIC STEP: R2 done · charter R3 host connect latency
PAUSED / CANCELLED: Claim faster connects · video usable · Soft L3 Fixed
CANONICAL OWNER:     main-shell host dial/offer marks · realtime-call-connect-latency
PROOF BEFORE DONE:   L1 elapsed helper · host_connected diagnostic on RTC connected
SURFACE:             diagnostics only
```

## Gap

Joiner logs `join_connected.acceptToConnectedElapsedMs`. Host has no dial→connected or offer→connected sample.

## Contract

| Mark | When |
|------|------|
| `dialStartedAtUnixMs` | Host invite accepted → `ringing_outgoing` |
| `offerSentAtUnixMs` | First successful host offer send for that room (not resend) |

On RTC `connected` + role `host`, emit once:

`messaging.realtime_voice.host_connected` with:
- `dialToConnectedElapsedMs` (nullable)
- `offerToConnectedElapsedMs` (nullable)
- `roomIdHint`, `peerPubkeySuffix`

Clear both marks after emit / session teardown.

## Non-goals

UI timers · claiming faster calls · changing connect budgets

_Last updated: 2026-10-19T07:45:00Z_
