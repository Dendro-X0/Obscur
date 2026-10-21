# Design — Coalesce host offer on accept (join-request race)

**Date (UTC):** 2026-10-19  
**Status:** Implemented · L1 + wire (await dual-profile retest)  
**Depends:** `realtime-call-accept-offer-race-investigation-2026-10.md`

```text
HANDOFF ATOMIC STEP: Fix accept→offer tear-down under concurrent join
PAUSED / CANCELLED: Claim video usable · Soft L3 Fixed · Twilio TURN landlord
CANONICAL OWNER:     voice-call-host-offer-coalesce · main-shell join-request
PROOF BEFORE DONE:   L1 coalesce · L1 invalid-state resend · vitest · static rebuild
SURFACE:             Host path only when join-request arrives
```

## Contract

1. **One in-flight host offer dispatch per `roomId`.** Concurrent join-request handlers await the same promise; do not start a second `createOffer`.
2. **If `createOffer`/`setLocalDescription` fails with have-local-offer / m-line / InvalidState and local offer SDP already exists → resend that offer; do not `failVoiceOfferDispatch`.**
3. **`sendVoiceSignal` retry** waits ≥600ms (past 500ms DM dedup) and stamps a fresh `sentAtUnixMs` so plaintext differs.

## Non-goals

TURN · third relay repair · changing PB1-C toast copy when dispatch truly fails twice

_Last updated: 2026-10-19T14:50:00Z_
