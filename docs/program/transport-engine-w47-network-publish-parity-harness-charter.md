# Transport Engine W47 — Network Publish Parity Harness Charter

**Status:** Executable harness + contract pins (no authority flip)  
**Last updated:** 2026-06-25  
**Band:** ENGINE-LAB / transport-engine post-B5

## Goal

Provide an **executable network publish parity harness** that compares outcomes from:

1. **Standalone owner** — `publishTransportKernelToRelayUrls` (`transport-kernel-standalone-publish.ts`)
2. **Host network path** — `publishHostTransportShimToRelayUrls` with mocked `TransportPublishRelayEventResult` shaped like W45/W46 network assembly

Both paths must align on shared semantics via `mapLegacyPublishResultToRelayPublishResult` (W41 exit checklist item 5).

## Parity dimensions (network fixtures)

For identical per-relay attempt evidence, harness must assert alignment on:

1. `quorumRequired` / `metQuorum`
2. `success` / `successCount` / `totalRelays`
3. `results` / `failures` per relay
4. Mapped `status` / `reasonCode` (`quorum_not_met`, `relay_degraded`, `ok`)

## Harness constraints

- Deterministic headless mocks only (no live relay I/O).
- Fixture builder `buildHostNetworkPublishResultFromAttempts` mirrors Rust quorum math (`max(1, ceil(n/2))`).
- Lab gates documented but not enabled in production routing:
  - `NEXT_PUBLIC_OBSCUR_TRANSPORT_HOST_PUBLISH_NETWORK=1` (W46 async routing)
  - Shim gate remains separate opt-in (W38).

## Non-goals for W47

- No port authority flip (`relay-standalone-publish-port.ts` default unchanged).
- No deletion of standalone owner.
- No live desktop integration test.

## Contract expectations (pinned in w47 tests)

W47 tests must assert:

- This charter exists and references standalone + host shim + shared mapper.
- `transport-engine-network-publish-parity.ts` harness helpers exist.
- Harness compares at least quorum-not-met and relay-degraded fixture sets.
- Standalone owner remains present; shim gate off by default.

## Sequencing after W47

- W41 authority flip remains blocked until maintainer sign-off on network parity evidence + subtraction plan.
- Next waves may extend fixture catalog or add live desktop smoke (separate gate).
