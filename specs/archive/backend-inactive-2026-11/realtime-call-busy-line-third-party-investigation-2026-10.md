# Investigation — Third-party invite while A↔B already in call

**Date (UTC):** 2026-10-19  
**Status:** Gap confirmed · design next  
**Trigger:** Maintainer — after successful 1:1 (2:32), how should C→A or C→B behave?

```text
HANDOFF ATOMIC STEP: Consider C calling A/B during active 1:1
PAUSED / CANCELLED: M2 conference · Soft L3 Fixed · Twilio TURN landlord
CANONICAL OWNER:     main-shell invite ingest · voice-call-busy-line
PROOF BEFORE DONE:   Design contract · L1 busy helper · no UI clobber
```

## Current behavior (code)

| Case | Today |
|------|--------|
| Invite from **same** peer while busy | Deferred (`shouldBlockForActiveSession`) — OK |
| Invite from **other** peer C while A↔B connected | **Not blocked** → sets `incomingVoiceInvite` + `ringing_incoming` for C, **overwriting** live call UI status |
| Join while session owner already active | Toast `voiceCallJoinAlreadyActive` |
| Outbound dial while already in call | **Not blocked** (only `isSendingVoiceCallInvite`) |
| Call waiting / hold / conference | **Not shipped** (M2–M3 charter) |

Single slot: one `incomingVoiceInvite` + one `voiceCallUiStatus` + one `RTCPeerConnection`.

## Risk

C’s invite can clobber A’s in-call chrome mid-media. Accepting C while RTC still bound to B is undefined / destructive.

## Options (product)

1. **Busy-line (recommended now)** — one active line; third-party invites defer until idle (or miss if expired); outbound dial blocked while busy.
2. **Call waiting** — second ring UI, hold/swap — needs charter + dual session model.
3. **Conference / merge** — M2+; out of scope.

_Last updated: 2026-10-19T17:40:00Z_
