# Investigation — Call ends ~30–40s · flaky relays · camera acquired

**Date (UTC):** 2026-10-19  
**Status:** Investigation  
**Charter:** Maintainer — camera works; calls drop within a minute; relay pool unstable (UI 2/3).

```text
HANDOFF ATOMIC STEP: Call drops <1min + unstable relays (screenshot evidence)
PAUSED / CANCELLED: Claim video usable · Soft L3 Fixed · invent ICE restart without design
CANONICAL OWNER:     realtime-voice-timeout-policy · main-shell connect timeout effect
PROOF BEFORE DONE:   This doc + timed screenshot match; then design/fix
SURFACE:             1:1 invite cards · dock honesty · relay chrome
```

## Screenshot evidence (2026-10-18 / 19)

| Observation | Implication |
|-------------|-------------|
| Relays **Connected 2/3** | One relay down; signaling may be slow or partial |
| Peer **Tester2 OFFLINE** | Callee may not accept; invite may not be seen promptly |
| Card A: **Timed out before connection** / NO ANSWER | Ring / expire honesty path (expected if unanswered) |
| Card B: **Call session closed before completion** · Invited 10:25:50 → Ended 10:26:24 (**~34s**) | Matches `VOICE_CALL_MIN_WAIT_MS` (30s) + teardown lag → **connect/ring timeout**, not a long mid-call hang |
| Maintainer: camera connected | Local `getUserMedia` OK — **not** proof remote AV stayed up; M1-L3 still needs ≥15s dual-profile soak |

## Code facts

1. Connect/ring watchdog fires every **30s** (`VOICE_CALL_MIN_WAIT_MS`).  
2. Only **`connecting`** can extend — and only **once** (`VOICE_CALL_CONNECT_TIMEOUT_MAX_EXTENSIONS = 1`) when SDP/ICE progress exists.  
3. **`ringing_*` always ends** at first tick (`phase_not_eligible` → UI `session_closed`).  
4. When an **active RTC session** exists at timeout, main-shell calls `leaveCallOnUnmount` **without** applying `mapRealtimeVoiceConnectTimeoutToUiReasonCode` — leave path tends to paint **`session_closed`**, which matches the pink card copy even when the real cause was a stalled connect under flaky relays.

## Hypotheses (ranked)

| ID | Hypothesis | Fit |
|----|------------|-----|
| H1 | 30s ring/connect timeout ends the attempt; flaky 2/3 relays delay answer/offer | **Strong** (34s wall clock) |
| H2 | User interprets local camera preview as “connected call” then sees timeout card | Strong (camera ≠ RTC connected) |
| H3 | Brief RTC `connected` then ICE `failed` / soft-disconnect | Possible; would prefer `network_interrupted` — pink copy is `session_closed` |
| H4 | TURN-less STUN path fails hard NAT | Possible for true mid-call; less explanatory for exact ~34s |

## Recommended fix slice (next)

1. **Honesty:** Timeout end with active session must set reason via timeout mapper (transport stall → `network_interrupted`).  
2. **Budget:** When relays are degraded (`openCount < configuredCount` and `openCount > 0`) **or** both local+remote SDP exist, allow **more connecting extensions** (e.g. 3 × 30s).  
3. Do **not** claim video usable; optional M1-L3 soak now that camera exists — separate step.

_Last updated: 2026-10-19T10:40:00Z_
