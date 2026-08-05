# Investigation — Voice call invite still fails after honesty Pass

**Date (UTC):** 2026-08-04  
**Status:** Findings → implement  
**Evidence:** Screenshot — invite card “Voice call invitation sent” + single toast “Failed to send voice call invitation.” (no second “Delivery could not be confirmed”)

---

```text
HANDOFF ATOMIC STEP: Voice note dark contrast + single-step mic (user pivots)
PRIOR SLICE:         Voice call invite send honesty (pending_ack + waitForConfirmation)
PAUSED / CANCELLED:  COM-RUN-* · O-2/O-4 · RIW-8 · Dev Lab · AUTH-SESSION · groups/**
CANONICAL OWNER:     handleSendVoiceCallInvite · voice-call-invite-delivery · VoiceCallInviteCard
PROOF BEFORE DONE:   L1 invite-delivery helpers · L3 desktop invite → ring or honest failed card
OUT OF SCOPE:        Claiming public Nostr SLA · Soft L3 Docker · video · AUTH-SESSION
```

---

## What the honesty Pass already fixed

- Phase-1 returns `pending_ack` (not `failed`).
- Voice invite awaits ACK (`waitForConfirmation`) and suppresses duplicate publish toasts.
- Screenshot shows **one** fail toast → that path is live (not the old double-toast bug).

## Residual root causes

### 1. ACK-strict invite vs public-path wire reality

`buildSendConfirmation` only yields `sent_quorum` or `failed`. On public relays, Phase-2 OK ACK often fails while Phase-1 `sendToOpen` already put the EVENT on open sockets (`partialWireDelivery`).

| Path | Behavior |
|------|----------|
| Normal DM | Optimistic bubble; ACK upgrades checkmarks later |
| Voice invite | Awaits ACK; **only** `sent_quorum`/`sent_partial` start ringing → hard fail when ACK missing |

So voice calls are blocked by F-ACK strictness even when wire fire may have succeeded — same class as DELIVERY-1 / Soft L3, but invite UX is stricter than chat.

### 2. Card copy ignores delivery status

`VoiceCallInviteCard` default outgoing subtitle is always `voiceCallInviteSent` while `cardState === "active"`. Optimistic paint + failed ACK → contradictory “sent” card + fail toast.

## Fix direction

1. Plumb `partialWireDelivery` (+ reasonCode) on wait-resolved `SendResult`.
2. Accept invite for ringing when confirmed **or** provisional wire (`partialWireDelivery` + event id) with warning toast — hard fail only with no wire evidence.
3. Pass `message.status` into invite card: sending / sent / failed copy for outgoing.

See [voice-call-invite-wire-provisional-design-2026-08.md](./voice-call-invite-wire-provisional-design-2026-08.md).
