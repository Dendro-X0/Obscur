# Design — Busy-line when C calls A or B during an active 1:1

**Date (UTC):** 2026-10-19  
**Status:** Implemented · L1 (busy defer + outbound block; await operator L3)  
**Depends:** `realtime-call-busy-line-third-party-investigation-2026-10.md`

```text
HANDOFF ATOMIC STEP: Busy-line for third-party invites during active 1:1
PAUSED / CANCELLED: Call waiting UI · M2 conference · Soft L3 Fixed
CANONICAL OWNER:     voice-call-busy-line · main-shell invite + dial
PROOF BEFORE DONE:   L1 helper tests · wire defer any-peer + outbound block · toast
SURFACE:             1:1 voice/video invite only (not group media)
```

## Decision

Ship **busy-line honesty** for the current single-session architecture. Defer call waiting and conference until M2 charter.

## Contract

### Line busy

`isVoiceCallLineBusy(phase)` true when phase is:

`ringing_outgoing` | `ringing_incoming` | `connecting` | `connected`

### Inbound (C → A or C → B while A↔B live)

1. If line busy → **do not** set `ringing_incoming` / do not replace `voiceCallUiStatus` / do not start ringtone for C.
2. Defer invite processing (same as today’s same-peer defer) so when the line becomes idle and invite is still unexpired, it may ring.
3. Invite DM card in C’s thread still exists (wire) — no silent denial of the event.
4. No second overlay. No hold. No auto-answer.

### Outbound (A dials C while still on B)

Block dial with toast: already in a call — end current call first.

### Explicit non-goals

| Deferred | Why |
|----------|-----|
| Call waiting UI / swap | Dual session + hold media |
| Busy SIP-style signal to C | Nice later; timeout already ends C’s ring |
| Conference / add C to A↔B | M2+ |

## Proof

- **L1:** `isVoiceCallLineBusy` · `shouldDeferVoiceInviteForBusyLine` · outbound `canStartVoiceCallInviteWhileLineIdle`
- **L3 (operator):** A↔B connected; C invites A → A stays in call; after A ends, unexpired C invite may ring

_Last updated: 2026-10-19T17:40:00Z_
