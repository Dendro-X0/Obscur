# Transport Engine W19 — Host Publish Parity Verification Charter

**Status:** Charter + contract pins (design-only)  
**Last updated:** 2026-06-25  
**Band:** ENGINE-LAB / transport-engine post-B5

## Goal

Define and **pin the parity verification surface** for the transport-engine host publish method (`publishRelayEvent`) **before** any runtime wiring or ownership flip.

W19 does **not** attempt to publish via the transport-engine host method. It exists to stop “thin wrapper” wiring from landing without a proof plan.

## Current state (pre-wiring)

- **Contract exists (TS):**
  - `packages/obscur-engine-contracts/src/transport-engine-methods.ts`
    - `TRANSPORT_ENGINE_METHODS.publishRelayEvent`
    - `TransportPublishRelayEventPayload`
    - `buildTransportPublishRelayEventRequest`
- **Desktop invoke surface exists (Rust):**
  - `apps/desktop/src-tauri/src/commands/engine.rs` → `libobscur::engine_invoke::dispatch(...)`
  - `packages/libobscur/src/engine_invoke.rs` recognizes `"publishRelayEvent"` and returns `transport_publish_not_wired`
- **Canonical native publish owner remains (runtime):**
  - `apps/pwa/app/features/transport-kernel/transport-kernel-standalone-publish.ts`
  - Routed by `apps/pwa/app/features/relays/hooks/relay-standalone-publish-port.ts`

## Parity definition (what “equivalent” must mean)

When host publish wiring is introduced in a later wave, parity is achieved only if:

1. **Target selection parity**
   - Relay URL normalization/deduping must match the current standalone path’s expectations.
   - Publishing to a single relay vs. many relays must preserve per-relay attribution in the returned evidence.

2. **Outcome mapping parity**
   - Host publish must map to the same semantics used today by the transport-kernel standalone owner:
     - `apps/pwa/app/features/relays/lib/publish-outcome-mapper.ts`
       - `mapLegacyPublishResultToRelayPublishResult(...)`
       - Reason codes: `quorum_not_met`, `relay_degraded` (and related status mapping rules)

3. **Quorum parity**
   - The computed \(quorumRequired\) and `metQuorum` must align with the shared mapper’s current rule:
     - \(quorumRequired = \max(1, \lceil \frac{totalRelays}{2} \rceil)\)
   - If that rule changes later, the host method must follow the shared owner, not fork it.

4. **Non-wired error semantics**
   - Until wiring is complete, attempts to invoke `publishRelayEvent` through desktop/native must fail explicitly as **not wired**:
     - Rust error code: `transport_publish_not_wired`
     - No “unknown transport method” fall-through for this method.

## Contract obligations (pinned by w19 tests)

W19 contract tests must assert:

- This charter exists and remains explicit about **no runtime wiring** in w19.
- The shared publish outcome mapper is referenced as the semantic owner (no duplicate publish mapping).
- The transport-kernel standalone publish owner is still the canonical runtime path.
- `libobscur` still recognizes the method name but returns `transport_publish_not_wired`.

## Non-goals / forbidden drift (w19)

- Do **not** add a Rust implementation that actually sends relay messages.
- Do **not** change the canonical runtime owner (`transport-kernel-standalone-publish`).
- Do **not** introduce a third publish owner or a parallel outcome mapper.

## Exit criteria (to start wiring in later waves)

Wiring work may begin only after:

- A pinned parity test surface exists (this charter + contract tests).
- A proposed **result contract** is specified (payload → result evidence shape) without duplicating mapper logic.
- A single-owner migration plan is documented (host publish becomes the shim target, then standalone owner is subtracted).

