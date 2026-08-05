# Design — DM publish ACK honesty (v1.9.15 D2)

**Date:** 2026-08-01  
**Investigation:** [dm-publish-ack-honesty-investigation-2026-08.md](./dm-publish-ack-honesty-investigation-2026-08.md)  
**Invariant:** P-evidence — no relay success without OK ACK when pool is writable / publish attempted.

---

## Contracts

### `buildSendConfirmation`

| Input | Output |
|-------|--------|
| `publishSuccess === true` | `success: true`, `deliveryStatus: "sent_quorum"` |
| `publishSuccess === false` && `firedToOpenCount > 0` | `success: false`, `deliveryStatus: "failed"`, `partialWireDelivery: true` |
| else | `success: false`, `deliveryStatus: "failed"` |

Do **not** OR `firedToOpenCount` into `effectiveSuccess`.

### Optimistic `sendDm` (`onConfirmed` set)

Return immediately:

- `success: false` (controller keeps `sending` until confirmation)
- `deliveryStatus: "sent_partial"` **removed** as fake success — use `"failed"` only if we must pick an enum **before** confirm; prefer staying semantically “pending” via `success: false` + empty/honest `relayResults` (open URLs with `success: false` optional) so controller does not flip to `accepted`
- Do **not** map open connections to `{ success: true }`

Controller already: `immediateStatus = result.success ? "accepted" : "sending"`.

### `publishToRelays` last resort

After `sendToOpen`:

- `success: false`
- `successCount: 0`
- `outcomes`: open URLs with `success: false`, `error: "no_relay_ok_ack"` (or equivalent)
- `overallError`: clear “fire-and-forget without OK”

`partialWireDelivery` still comes from Phase-1 `firedToOpenCount` in confirmation.

---

## Mental simulation

1. User sends DM with open sockets, writable pool.
2. Bubble shows **sending** (local echo OK).
3. If `publishToUrls` gets ≥1 OK → `onConfirmed` → **accepted**; journal may advance `lastSuccessfulPublishAtUnixMs`.
4. If publish fails → **failed** + toast; never green from wire alone.
5. Neighbor: delete/connection-request paths that **await** confirmation (no `onConfirmed`) still use confirmation result only — unchanged once confirmation is honest.

---

## Proof

| Layer | Command / evidence |
|-------|-------------------|
| L1 | `pnpm exec vitest run apps/pwa/app/features/messaging/controllers/v2/dm-send-pipeline.test.ts` (+ transport last-resort case if added) |
| L2 | Soft L3 / manual: after send with open pool, bubble stays sending until OK or fails; no accepted + null publish ACK |
| L3 | `pnpm verify:s-pool-delivery-l3` — **D1 claim**, not D2 alone |

**Claim language:** D2 Implemented L1 ≠ Soft L3 Pass ≠ delivery fixed.
