# Design — K6 SendConfirmation on PAL (2026-11)

**Status:** Landed (L1)  
**Parent:** [platform-boundary-map-2026-11.md](./platform-boundary-map-2026-11.md)

```text
HANDOFF ATOMIC STEP: K6 SendConfirmation PAL export — DONE L1
PAUSED / CANCELLED: Soft L3 · Tor Verified · Matrix promote · Continuity promote
CANONICAL OWNER:     PAL · send-confirmation.ts
PROOF:               platform-k6-send-confirmation-pal.contract.test.ts Pass
```

## 1. Problem

`SendConfirmation` is defined in the messaging send pipeline (correct rich owner) but **re-exported through `nostr-adapter` → layer**. Shell (`dm-controller`) correctly imports from the layer, yet the type path still narrates “Nostr adapter owns confirmation.”

Boundary map: *Rich type leak → Canonical send result on PAL*.

## 2. Goal

Make **PAL** the public export owner for `SendConfirmation`. Keep the structural type in `dm-send-pipeline` (relay evidence fields stay rich). Remove the `nostr-adapter` hop from `layer.ts` exports.

## 3. L1 slice

1. Add `protocol-adaptation/send-confirmation.ts` — re-exports `SendConfirmation` from the send pipeline.
2. `layer.ts` — `export type { SendConfirmation } from "./send-confirmation"`.
3. `nostr/nostr-adapter.ts` — import the type from `../send-confirmation` (or pipeline); stop being layer’s export source.
4. Contract: layer source must not export `SendConfirmation` from `./nostr-adapter`; messaging may import the type only from `protocol-adaptation/layer` or `send-confirmation` / pipeline (not `nostr-adapter`).

## 4. Deferred

- Slimming `relayResults` out of shell DTOs (true canonical-only confirmation)
- Renaming `SendConfirmation` → `CanonicalSendConfirmation`

## 5. Non-claims

- Not Soft L3 / Tor Verified / Matrix promote
- Not multi-protocol delivery semantics change
