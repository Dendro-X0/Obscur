# Design — Soft L3 subscribe honesty (H6a) (2026-11-08)

```text
HANDOFF ATOMIC STEP: Soft L3 subscribe honesty (activeSubs>0 when exclusive healthy)
PAUSED / CANCELLED: Soft L3 Fixed · Tor · Matrix promote · Continuity · packaged Pass
CANONICAL OWNER: createConduitMeshNostrWsClient · use-conduit-mesh-relay-pool
PROOF BEFORE DONE: L1 vitest · user manual Soft L3 demote soak
```

## Problem

Soft L3 runtime reports `activeSubscriptionCount=0` while `phase=healthy` / `writable=1` because the mesh pool **stubs** the count. Browser pool is honest. Soft L3 exclusive demote diagnosis and listen readiness are blind.

## Invariant

`EnhancedRelayPoolResult.getActiveSubscriptionCount()` MUST equal the number of live subscription IDs held by the pool's subscribe path (mesh: `nostrClient` active map; browser: `SubscriptionManager`). Never hardcode `0` when a real map exists.

## Contract

| Call | Result |
|------|--------|
| no `subscribe` yet | `0` |
| `subscribe` once | `1` |
| `subscribe` twice | `2` |
| `unsubscribe` one | decrements by 1 |
| `dispose` | `0` |

Soft L3 exclusive: after unlock + Soft L3 open + DM auto-subscribe, product expect `activeSubs ≥ 1` before Remove. If still `0` after this slice → H6b (out of scope here).

## Implementation (subtractive)

1. Add `getActiveSubscriptionCount(): number` on `ConduitMeshNostrWsClient` → `activeSubscriptions.size`.
2. Wire `useConduitMeshRelayPool` → `() => nostrClient.getActiveSubscriptionCount()`.
3. Do **not** change `buildTransportSnapshot` / phase rules in this slice.
4. Do **not** change DM subscribe effects (already arm on writable).

## Non-goals

- Soft L3 Fixed / contact rows Pass claims
- Lookback lifecycle idempotency (H6c)
- Phase=degraded when `writable && activeSubs===0` (H6b follow-up if soak still shows real 0)
- CDP dual-window agent soaks (user owns manual validation)

## Proof

| Layer | Gate |
|-------|------|
| L1 | `conduit-mesh-nostr-ws-client.test.ts` — count tracks subscribe/unsubscribe/dispose |
| L2 | User manual Soft L3 demote: both peers Soft L3 open · `activeSubs>0` · T1 Remove → T2 Network not TRUSTED |

## Status

- **L1:** Pass (2026-11-09) — `conduit-mesh-nostr-ws-client.test.ts` 13
- **Manual demote soak:** owed (user) — `docs/handoffs/p1-o4b-soft-l3-subscribe-honesty-2026-11-08.md`
