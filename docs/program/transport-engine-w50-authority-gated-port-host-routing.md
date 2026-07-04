# Transport Engine W50 — Authority-Gated Port Host Routing

**Status:** Implemented behind maintainer authority gate  
**Last updated:** 2026-06-25  
**Band:** ENGINE-LAB / transport-engine post-B5

## Goal

Wire `shouldUseHostTransportPublishAuthority()` into `relay-standalone-publish-port.ts` so Phase D host publish routing is available when the maintainer authority env is enabled, without changing production defaults.

## Routing (pinned)

In `publishToRelayStandalone` / `publishToUrlsStandalone`:

1. Legacy path when `shouldUseLegacyStandaloneRelayPublish()`.
2. Host path when `shouldRouteHostTransportPublish()` — authority **or** W38 shim.
3. Standalone kernel owner otherwise.

`shouldRouteHostTransportPublish()` = `shouldUseHostTransportPublishAuthority() || shouldUseHostTransportPublishShim()`.

Host path uses `publishHostTransportShimToRelayUrls` / `publishHostTransportShimToRelay` (shared host adapter). W46 async routing applies when network env is also set.

## Defaults preserved

- Authority env off + shim env off → standalone owner (unchanged production path).
- Authority env is maintainer opt-in only (`NEXT_PUBLIC_OBSCUR_TRANSPORT_HOST_PUBLISH_AUTHORITY=1`).

## Non-goals for W50

- No standalone owner deletion.
- No silent fallback from host failures to standalone.
- No production enablement of authority env.

## Contract expectations (pinned in w50 tests)

W50 tests must assert:

- This charter exists.
- Port imports `shouldRouteHostTransportPublish` and routes to host shim when authority gate is on.
- Standalone owner still used when both authority and shim gates are off.
