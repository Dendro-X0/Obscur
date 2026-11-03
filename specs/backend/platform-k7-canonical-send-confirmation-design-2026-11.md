# Design — K7 CanonicalSendConfirmation (2026-11)

**Status:** Landed (L1)  
**Parent:** [platform-k6-send-confirmation-pal-design-2026-11.md](./platform-k6-send-confirmation-pal-design-2026-11.md)

```text
HANDOFF ATOMIC STEP: K7 slim CanonicalSendConfirmation — DONE L1
PAUSED / CANCELLED: Soft L3 · Tor Verified · Matrix promote · Continuity promote
CANONICAL OWNER:     PAL · send-confirmation.ts
PROOF:               mapper unit + K7 contract Pass; rich SendConfirmation remains Obscur-Nostr
```

## 1. Goal

Give protocol-neutral shell code a **slim** confirmation DTO without per-relay `relayResults`, while keeping rich `SendConfirmation` for the Obscur-Nostr pipeline / evidence UI.

## 2. Shape

```ts
CanonicalSendConfirmation = {
  success, deliveryStatus, error?, reasonCode?,
  partialWireDelivery?, successCount, totalRelays
}
```

No `relayResults`. Mapper: `toCanonicalSendConfirmation(rich)`.

## 3. L1 slice

1. Define + export from `send-confirmation.ts` / layer.
2. Unit test mapper.
3. Contract: Canonical type source has no `relayResults`; layer exports both names.
4. Defer: change `sendDm` `onConfirmed` callback to Canonical-only (dm-controller still on rich).

## 4. Non-claims

- Not delivery semantics change
- Not Soft L3 / Tor / Matrix promote
