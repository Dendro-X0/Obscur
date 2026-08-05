# Design — Voice invite provisional wire + card honesty

**Date (UTC):** 2026-08-04  
**Investigation:** [voice-call-invite-ack-residual-investigation-2026-08.md](./voice-call-invite-ack-residual-investigation-2026-08.md)

---

## Contracts

### SendResult (waitForConfirmation resolve)

Add optional:

- `partialWireDelivery?: boolean`
- `reasonCode?: DeliveryReasonCode` (already inferred in confirmation)

### Acceptance helper

```ts
isVoiceCallInviteDeliveryAccepted(status) // sent_quorum | sent_partial

isVoiceCallInviteDeliveryProvisional(params: {
  deliveryStatus, partialWireDelivery?, eventId?
}) // failed + partialWireDelivery + non-empty eventId
```

Invite start ringing when **accepted OR provisional**.

| Outcome | Toast | Ring | Card |
|---------|-------|------|------|
| sent_quorum | success | yes | sent / ringing |
| provisional wire | warning (partialWire copy) | yes | sending→accepted when ACK later upgrades message |
| hard failed | error (reason copy) | no | failed |
| queued | warning | no | failed/queued |

### Card

Outgoing `message.status`:

- `sending` → “Sending voice call invitation…”
- `failed` → failed cardState / “Could not send invitation”
- `accepted` (and friends) → existing “invitation sent”

Do not claim “sent” while `sending` or `failed`.

## Proof

- L1: voice-call-invite-delivery provisional cases  
- L3: rebuild shell → start voice call → ring **or** failed card (not “sent” + fail toast)
