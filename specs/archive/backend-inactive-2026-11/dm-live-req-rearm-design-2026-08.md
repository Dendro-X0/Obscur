# Design — DELIVERY-1 live REQ re-arm (F-RECV-LIVE)

**Date (UTC):** 2026-08-02  
**Parent:** [dm-delivery-1-public-path-investigation-2026-08.md](./dm-delivery-1-public-path-investigation-2026-08.md)  
**Charter:** [production-truth-release-recovery-2026-08.md](../../docs/program/production-truth-release-recovery-2026-08.md)

## Session gate

```text
NEXT ATOMIC STEP:     Production-truth recovery · R1 DELIVERY-1
PAUSED / CANCELLED:   Dev Lab · Soft L3 lab-only · COM-RUN-* · AUTH-SESSION
CANONICAL OWNER:      createConduitMeshNostrWsClient (+ useConduitMeshRelayPool.resubscribeAll)
PROOF BEFORE DONE:    L1 vitest · Soft L3 / dual-window live marker ≤45s without restart
OUT OF SCOPE:         F-ACK OK-timeout slice · COM-RUN · Relays UI polish
```

## Operator evidence (2026-08-02)

| Observation | Implication |
|-------------|-------------|
| After restart, older peer messages appear | Events **were stored** on relays; hydrate/history path works |
| New sends do not update peer live | Live **REQ push** path broken |
| `test 2` single grey check | Separate **F-ACK** (publish OK) — not this slice |
| Some older bubbles show double check | Confirmation can succeed sometimes |

## Root cause (F-RECV-LIVE)

Two bugs in `createConduitMeshNostrWsClient`:

1. **REQ not re-armed:** `subscribe` sends `REQ` only to sockets already open. `onopen` did not replay active REQs. Mesh pool `resubscribeAll` was `() => {}`.
2. **EVENT frame parse:** NIP-01 relay→client is `["EVENT", subId, event]`, but dispatch used `parsed[1]` as the event (the subscription id). Live handlers never saw real events.

Restart “fixes” visibility via history/hydrate, not live push.

## Fix (smallest)

1. On each relay `onopen`, send `REQ` for every `activeSubscriptions` entry.  
2. Parse EVENT as object at `parsed[1]` or `parsed[2]`.  
3. Implement client + pool `resubscribeAll`.  
4. L1: subscribe-while-connecting → open → REQ + live EVENT handler.

## Non-goals

- Changing `LIVE_SUBSCRIPTION_SINCE_SKEW_SECONDS` (5m) — separate.  
- Fixing publish OK timeout / Phase1 `sendToOpen` (F-ACK) — next slice.  
- NIP-65 outbox.

## Claim language

| May say | When |
|---------|------|
| Implemented | L1 green |
| Live receive **fixed** | Dual-window: send marker → peer sees ≤45s **without** restart |
| Delivery **fixed** | Soft L3 Row A+B + F-ACK also Pass |
