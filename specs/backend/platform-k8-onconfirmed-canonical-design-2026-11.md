# Design — K8 onConfirmed → Canonical (2026-11)

**Status:** Landed (L1)  
**Parent:** [platform-k7-canonical-send-confirmation-design-2026-11.md](./platform-k7-canonical-send-confirmation-design-2026-11.md)

```text
HANDOFF ATOMIC STEP: K8 migrate sendDm onConfirmed to Canonical-only — DONE L1
PAUSED / CANCELLED: Soft L3 · Tor Verified · Matrix promote · Continuity promote
CANONICAL OWNER:     dm-send-pipeline · layer · dm-controller
PROOF:               dm-send-pipeline + K8 contract Pass (19 tests with pipeline suite)
```

## 1. Goal

`sendDm` / `sendDmNostrOnly` `onConfirmed` delivers **`CanonicalSendConfirmation` only**. Rich per-relay evidence stays inside the pipeline for sync `SendResult.relayResults` when awaiting without callback.

## 2. Changes

1. Pipeline: `onConfirmed?: (c: CanonicalSendConfirmation) => void`; map via `toCanonicalSendConfirmation` before invoke.
2. Layer matrix/private_dc shim: emit Canonical shape (`successCount`/`totalRelays`).
3. `dm-controller` / `dm-send-with-retry`: consume Canonical; toast uses counts; message `relayResults` cleared or left unchanged on confirm (status still updates).
4. Contract: pipeline source `onConfirmed` types Canonical, not rich `SendConfirmation` alone.

## 3. Non-claims

- Not Soft L3 / Tor / Matrix promote
- Not removing `SendResult.relayResults` on sync returns
