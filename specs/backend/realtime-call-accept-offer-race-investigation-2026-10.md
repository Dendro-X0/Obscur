# Investigation — Call drops on every accept (offer toast + network_interrupted)

**Date (UTC):** 2026-10-19  
**Status:** Root cause candidate identified · design next  
**Screenshot:** Host toast **Could not send the call offer** · CALL FAILED `network_interrupted` · **2/3 relays** · prior CALL COMPLETED 4:52 same day

```text
HANDOFF ATOMIC STEP: Retest 1:1 under 2/3 after signal provisional — still failing on accept
PAUSED / CANCELLED: Claim video usable · Soft L3 Fixed · Twilio TURN landlord
CANONICAL OWNER:     main-shell join-request → dispatchHostOffer
PROOF BEFORE DONE:   L1 race helper · host offer in-flight coalesce · dual-profile retest
```

## Symptoms

1. Accept invite → host immediately shows offer-send failure toast + interrupted.
2. Recurs under degraded relays; earlier same-day call can still complete (4:52).
3. Prior slice fixed answer provisional; **this toast is host `failVoiceOfferDispatch`**.

## Evidence in code

1. **No join-request serialization.** Concurrent join signals (relay dupes + joiner 1.2s retry + interval retry) can both pass the “no local offer yet” branch and both call `createOffer` / `setLocalDescription` on the same `RTCPeerConnection`.
2. Second `setLocalDescription` → `InvalidStateError` (already `have-local-offer`) → catch → **`failVoiceOfferDispatch` tears down** even if the first offer path succeeded or is in flight.
3. Immediate identical-payload retry in `sendVoiceSignal` collides with **500ms DM dedup** (`Duplicate send suppressed` → empty `failed`) — worsens false “send failed” under load.
4. Resend-existing-offer path already exists but only when `localDescription.type === "offer"` is visible **before** the race window.

## Hypotheses ranked

| # | Hypothesis | Fit |
|---|------------|-----|
| H1 | Concurrent join → double createOffer → tear-down | Strong — matches “every accept” |
| H2 | Offer publish hard-fail (no pending_ack) | Weaker after provisional accept; still possible under dedup |
| H3 | Pure ICE/NAT after signaling | Does not explain **offer send** toast |

## Non-goals

Fixing dead 3rd relay · claiming TURN · video L3 Pass

_Last updated: 2026-10-19T14:45:00Z_
