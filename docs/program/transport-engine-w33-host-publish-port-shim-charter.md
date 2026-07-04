# Transport Engine W33 — Host Publish Port Shim Charter

**Status:** Charter + contract pins (design-only; no default routing change)  
**Last updated:** 2026-06-25  
**Band:** ENGINE-LAB / transport-engine post-B5

## Goal

Define an **opt-in host publish shim** in `relay-standalone-publish-port.ts` that can route native standalone publish through `publishRelayEventViaTransportEngineHost`, without making the host path the default owner.

W33 is design + contract only.

## Shim gate (pinned policy)

A dedicated policy gate `shouldUseHostTransportPublishShim()` controls shim routing:

- **Default:** `false` — standalone kernel owner remains canonical.
- **When true:** port may invoke host publish shim instead of `transport-kernel-standalone-publish.ts`.
- Shim is independent of legacy web publish (`shouldUseLegacyStandaloneRelayPublish`).

## Shim responsibilities (future waves)

When the shim gate is enabled:

1. Normalize relay URLs (trim, dedupe) before host invoke.
2. Build `TransportPublishRelayEventPayload` and call `publishRelayEventViaTransportEngineHost`.
3. Map host results through `mapLegacyPublishResultToRelayPublishResult` only.
4. Fail closed on host errors — no silent fallback to standalone without explicit policy.

## Non-goals for W33

- No default enablement of the shim gate.
- No Rust publish network execution.
- No deletion of `transport-kernel-standalone-publish.ts`.

## Contract expectations (pinned in w33 tests)

W33 tests must assert:

- This charter exists and defines opt-in shim gating.
- `relay-standalone-publish-port.ts` still defaults to standalone kernel routing.
- Rust valid invokes remain `transport_publish_not_wired` until controlled assembly wave.
