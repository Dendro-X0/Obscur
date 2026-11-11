# Design — Soft L3 exclusive subscribe: no public transient bleed (H6b) (2026-11-08)

```text
HANDOFF ATOMIC STEP: Soft L3 subscribe honesty → demote-ready (H6b exclusive listen)
PAUSED / CANCELLED: Soft L3 Fixed · Tor · Matrix promote · Continuity · packaged Pass
CANONICAL OWNER: subscribeToIncomingDMs (dm-relay-transport)
PROOF BEFORE DONE: L1 vitest · user Soft L3 demote soak
```

## Problem

H5 pinned Soft L3 **publish** to `:7000`. H6a made `activeSubs` honest. Remaining Soft L3 exclusive defect: `subscribeToIncomingDMs` always calls `pool.addTransientRelay` for `DM_DELIVERY_FALLBACK_RELAYS` (nos.lol / primal / damus). Mesh pool implements that as `setRelayUrls([...poolUrls, public])`, dialing public remotes under exclusive Soft L3 → public bleed (`Connected 2/2`), lookback from public history, and live cancel can miss Soft L3-only peers.

## Invariant

When the pool is Soft L3 exclusive (sole local WS lab), HTTP-only mesh, or sticky exclusive private-mesh intent is set, DM subscribe MUST NOT prime public delivery fallbacks via `addTransientRelay`.

## Contract

| Pool / intent | Prime `DM_DELIVERY_FALLBACK_RELAYS`? |
|---------------|-------------------------------------|
| configured = `[ws://localhost:7000]` | No |
| configured = `[http://127.0.0.1:8788]` | No |
| sticky `local_dev_mesh` intent | No |
| hybrid public pool | Yes (unchanged) |

## Implementation

1. Add `shouldPrimeDmDeliveryFallbackRelays(pool, profileId?)` next to exclusive publish helpers.
2. Gate the `addTransientRelay` loop in `subscribeToIncomingDMs`.
3. L1: Soft L3 exclusive / HTTP-only / sticky intent → `addTransientRelay` never called; hybrid still primes.

## Non-goals

- Soft L3 Fixed / contact Pass claims
- Phase=degraded when activeSubs=0 (optional later)
- Full lookback event-order engine (separate if soak still flaps)

## Proof

| Layer | Gate |
|-------|------|
| L1 | `dm-relay-transport.test.ts` — exclusive Soft L3 subscribe does not addTransient public · Pass |
| L1 | `use-conduit-mesh-relay-pool.http-writable.test.ts` — mesh rejects public transient · Pass |
| Manual | User Soft L3 demote soak after rebuild — `docs/handoffs/p1-o4b-soft-l3-demote-ready-soak-2026-11-08.md` |

## Status

- **L1:** Pass (2026-11-09)
- **Manual demote soak:** owed (user)
