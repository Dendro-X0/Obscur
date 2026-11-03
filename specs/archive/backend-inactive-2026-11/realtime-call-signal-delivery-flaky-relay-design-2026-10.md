# Design — Voice signal delivery under flaky relays (E2E answer fail)

**Date (UTC):** 2026-10-19  
**Status:** Implemented · L1 + wire (await dual-profile retest under 2/3)  
**Evidence:** Screenshot — `Could not answer the call. Check relays and try again.` (= `voiceCallAnswerSendFailed`) + `network_interrupted` + **2/3** relays.

```text
HANDOFF ATOMIC STEP: Unable to communicate E2E — answer send fails on 2/3 relays
PAUSED / CANCELLED: Claim video usable · Soft L3 Fixed · Twilio TURN landlord
CANONICAL OWNER:     sendVoiceSignal · voice-call-signal-delivery
PROOF BEFORE DONE:   L1 acceptance helper · wire sendVoiceSignal + one answer retry
SURFACE:             offer/answer/ice/join/leave signal DM publish
```

## Problem

`sendVoiceSignal` only treats `sent_quorum` / `sent_partial` as success. Under a degraded pool, Phase-1 may leave `pending_ack` or `failed` + `partialWireDelivery` — same class as voice **invite** provisional acceptance. Joiner then hits `failVoiceAnswerDispatch` → red toast → interrupted, so **no E2E media**.

## Contract

`isVoiceCallSignalDeliveryAccepted(result)` true when:

| deliveryStatus | Extra |
|----------------|--------|
| `sent_quorum` / `sent_partial` | yes |
| `pending_ack` | yes (provisional — log warn) |
| `failed` | only if `partialWireDelivery === true` and `eventId` non-empty |

One **immediate retry** (same payload) when first attempt fails acceptance, before `failVoiceAnswerDispatch` / host offer fail paths that already retry elsewhere.

## Non-goals

Fixing the dead third relay · ICE restart · presence OFFLINE vs last-active mismatch

_Last updated: 2026-10-19T13:30:00Z_
