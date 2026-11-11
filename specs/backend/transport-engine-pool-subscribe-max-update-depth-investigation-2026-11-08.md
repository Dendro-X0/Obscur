# Investigation — React #185 on unlock (transport_engine_pool_subscribe) (2026-11-08)

**Status:** Fix landed · unlock soak **Pass** (`shell-2026-11-08T04:24:37Z`)  
**Related:** Soft L3 `0/1` leave L2 blocked; hung-CONNECTING helper separate  
**Evidence:** CDP console — `#185` after stampede of `relay.transport_engine_pool_subscribe`; NativeRelay `502` on `relay.primal.net` then browser fallback

## Claim bounds

- May say: unlock Oops correlated with subscribe stampede + public 502; hook deps no longer include `params.pool`
- Must not say: Soft L3 Fixed · leave L2 Pass · unlock Fixed until soak Pass

## Facts

1. Tester1 Sign-in reaches shell (`0/3` Connecting) then Oops within ~4–8s.
2. Console: dozens of `relay.transport_engine_pool_subscribe` for `wss://relay.primal.net` in milliseconds, then React `#185` (Maximum update depth).
3. NativeRelay primal returns Cloudflare **502**; falls back to browser WebSocket.
4. Soft L3 Apply via Settings did not land in time (applyCount 0 before crash).

## Root cause (code)

`useTransportEnginePoolSubscribe` effect deps include `params.pool` (object identity). When dial/fallback/snapshot updates recreate the pool result each render, the effect re-runs → `addTransientRelay` → snapshot notify → re-render → new `pool` → **infinite sync update depth**.

## Fix slice

1. Landed: `useRelayPoolRef(params.pool)`; effect deps `[params.enabled, subscribeUrls, subscribeUrlsKey, poolRef]` — omit pool identity. `addTransientRelay` skips no-op snapshot publish when already tracked.
2. L1: w5 contract asserts `useRelayPoolRef` + deps without pool identity.
3. Unlock soak: Sign-in stays past 15s without Oops (public may still be 0/N if 502).
4. Then Soft L3 Local Dev Mesh → local open for leave L2.

## Non-goals

- Soft L3 hung-CONNECTING dial wiring (separate; helper already L1)
- Claiming public Nostr SLA
