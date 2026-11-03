# Investigation — Voice call invite cannot initiate

**Date (UTC):** 2026-08-04  
**Status:** Findings → implement  
**Evidence:** Maintainer screenshots — invite card “Voice call invitation sent” + toasts “Failed to send voice call invitation” / “Delivery could not be confirmed”

---

```text
NEXT ATOMIC STEP:     (user pivot) Voice call invite send honesty
PAUSED / CANCELLED:   COM-RUN-* · O-2/O-4 · RIW-8 · Dev Lab · AUTH-SESSION · groups/**
CANONICAL OWNER:      dm-send-pipeline Phase-1 return · handleSendVoiceCallInvite
PROOF BEFORE DONE:    L1 pipeline + invite handler · L3 desktop voice invite ACK path
OUT OF SCOPE:         Public Nostr SLA guarantees · Soft L3 · video conferencing · AUTH-SESSION
```

---

## Symptom

Outgoing voice-call-invite bubble appears with “invitation sent,” while toasts report send failure and delivery unconfirmed.

## Root cause

1. `dmController.sendDm` always passes `onConfirmed` into `dm-send-pipeline.sendDm`.
2. With `onConfirmed`, Phase-1 returns **immediately** with `deliveryStatus: "failed"` and `awaiting_relay_ok_ack` (P-evidence: fire-and-forget ≠ OK ACK).
3. `handleSendVoiceCallInvite` treats only `sent_quorum` / `sent_partial` as success → **always** toasts `voiceCallInviteSendFailed` on Phase-1.
4. Optimistic message is already painted → contradictory “sent” card.
5. Later `handleConfirmed` failure toasts **again** (“Delivery could not be confirmed…”) → double error UX.

Not primarily a mic-consent regression; invite fails on publish-result interpretation.

## Fix direction

- Phase-1 async return uses explicit `pending_ack` (not `failed`).
- Voice invite `sendDm({ waitForConfirmation: true })` awaits real ACK; caller owns toast; suppress duplicate publish feedback for that send.
- On true failure, do not leave ringing / “sent” honesty without failed status.

See design companion in same file section below / implement directly (small contract fix).
