# Design — Skip Phase-1 sendToOpen when onConfirmed

**Date (UTC):** 2026-08-04  
**Investigation:** [voice-invite-peer-invisible-investigation-2026-08.md](./voice-invite-peer-invisible-investigation-2026-08.md)

---

## Contract

In `dm-send-pipeline.sendDm`:

| `onConfirmed` | Phase-1 `sendToOpen` | Phase-2 `publishToRelays` |
|---------------|----------------------|---------------------------|
| absent | yes (legacy sync await path) | await inline |
| present | **no** | background; callback on OK |

`firedToOpenCount` stays 0 when Phase-1 skipped (honest `partialWireDelivery`).

## Callers

`dm-controller` always supplies `onConfirmed` → all interactive DMs (including voice invite) use confirmed-only publish.

## Proof

- L1: dm-send-pipeline — with `onConfirmed`, `sendToOpen` not called; confirmation still invoked  
- L3: dual profile → voice invite appears on peer thread (and preferably ACK / no provisional-only toast)

## Out of scope

Soft L3 Docker Pass · public Nostr SLA claims
