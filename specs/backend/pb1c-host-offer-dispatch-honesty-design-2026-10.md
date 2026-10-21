# Design — PB1-C host offer dispatch honesty

**Date (UTC):** 2026-10-18  
**Status:** Implemented · L1 Pass  
**Parents:** [pre-b2b-capability-design-2026-10.md](./pre-b2b-capability-design-2026-10.md) §5 · [pb1c-peer-connection-start-honesty-design-2026-10.md](./pb1c-peer-connection-start-honesty-design-2026-10.md)

```text
HANDOFF ATOMIC STEP: more PB1-C — host offer create/send fail must not leave silent connecting dock
PAUSED / CANCELLED: Claim video shipped · M1-L3 · Soft L3 Fixed · S6
CANONICAL OWNER:     main-shell host offer path · voice-offer-dispatch-honesty
PROOF BEFORE DONE:   L1 mapper + host path uses it on !offerSent / offer create fail
SURFACE:             Desktop DM call dock (host)
```

## Gap

Peer connection start already toasts. Host offer create/send can still fail with only `join_offer_dispatch_failed` / early `return`, leaving ringing/connecting chrome up.

## Contract

| Failure | UI |
|---------|-----|
| `createOffer` / `setLocalDescription` throws (non-recoverable) | interrupted · `network_interrupted` · error toast · tear down RTC |
| Offer dispatch returns false (`!offerSent`) | same |
| m-line reset retry still fails | same |

Pure helper: `resolveVoiceOfferDispatchFailureUi()`.

## Non-goals

- Changing offer SDP shape  
- Camera / M1-L3  
- Weak-delivery warning while still connecting (joiner already has that)
