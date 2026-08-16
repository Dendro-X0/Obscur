# Transport Engine W23 — Headless Publish Parity Harness Charter

**Status:** Charter + contract pins (design-only; no runtime wiring)  
**Last updated:** 2026-06-25  
**Band:** ENGINE-LAB / transport-engine post-B5

## Goal

Define and pin a **headless parity harness plan** that compares host publish outcomes with the current standalone publish semantics, without changing runtime owners or wiring Rust publish execution.

W23 is planning and contract evidence only. It does not introduce new publish behavior.

## Scope

- Establish a parity harness specification for future waves using engine-lab/headless surfaces.
- Pin what must be compared between:
  - Host publish path (`publishRelayEventViaTransportEngineHost`)
  - Existing standalone publish semantics owner (`transport-kernel-standalone-publish.ts` + shared mapper)
- Keep runtime unchanged:
  - `packages/libobscur/src/engine_invoke.rs` continues to return `transport_publish_not_wired` for `publishRelayEvent`.

## Required parity dimensions

Future parity harnesses must compare at least:

1. **Relay normalization parity**
   - Same effective relay set after trim/dedupe.
2. **Quorum parity**
   - Same `quorumRequired` and `metQuorum` interpretation for identical relay outcomes.
3. **Result shape parity**
   - `success`, `successCount`, `totalRelays`, per-relay `results`, `failures`, and `overallError` compatibility.
4. **Reason/status parity**
   - Alignment with shared outcome mapping semantics (`quorum_not_met`, `relay_degraded`, etc.).
5. **Failure-mode parity**
   - Fail-closed behavior for unavailable host / not-wired / invalid-result states is explicit and testable.

## Harness design constraints

- Run in deterministic headless/contract mode (no flaky runtime dependencies).
- Avoid introducing a second source of truth for publish semantics.
- Use existing shared mapping owner as reference:
  - `apps/pwa/app/features/relays/lib/publish-outcome-mapper.ts`
- Keep the canonical runtime owner unchanged until parity evidence is complete.

## Non-goals for W23

- No Rust publish implementation.
- No host/standalone authority switch.
- No production routing changes for publish paths.

## Contract expectations (pinned in w23 tests)

W23 tests must assert:

- This charter exists and explicitly defines parity dimensions and constraints.
- Rust publish remains stubbed (`transport_publish_not_wired`).
- Existing standalone publish owner and shared mapper remain present as the semantic baseline.

## Exit criteria for wiring wave

Before runtime publish wiring can start:

- A concrete parity harness test suite is implemented and green.
- Parity expectations are encoded as executable comparisons, not only prose.
- Maintainer sign-off confirms owner migration sequencing from current standalone owner to host path.

