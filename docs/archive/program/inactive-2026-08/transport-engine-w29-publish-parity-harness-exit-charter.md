# Transport Engine W29 — Publish Parity Harness Exit Charter

**Status:** Charter + contract pins (design-only; no runtime wiring)  
**Last updated:** 2026-06-25  
**Band:** ENGINE-LAB / transport-engine post-B5

## Goal

Declare **parity harness exit criteria** now that executable harness slices W24–W28 are green, without changing runtime owners or wiring Rust publish execution for valid invokes.

W29 is design + contract only.

## Harness slices (pinned evidence)

| Wave | Harness focus | Contract test |
|------|---------------|---------------|
| W24 | Fixture parity + headless `transport_engine_host_unavailable` | `transport-engine-w24.contract.test.ts` |
| W25 | Reason/status fixtures + `transport_publish_invalid_result` | `transport-engine-w25.contract.test.ts` |
| W26 | Mocked valid `TransportPublishRelayEventResult` acceptance | `transport-engine-w26.contract.test.ts` |
| W27 | Mocked `transport_publish_not_wired` fail-closed | `transport-engine-w27.contract.test.ts` |
| W28 | Mocked `transport_publish_invoke_failed` fail-closed | `transport-engine-w28.contract.test.ts` |

## Required failure-mode coverage (exit checklist)

Before Rust publish wiring for valid invokes may begin:

1. **Acceptance path** — well-formed host results pass `isTransportPublishRelayEventResult` and map through shared mapper.
2. **Host unavailable** — headless path returns `transport_engine_host_unavailable`.
3. **Not wired** — explicit `transport_publish_not_wired` preserved until controlled wiring wave.
4. **Invalid result shape** — incomplete `ok: true` data fails as `transport_publish_invalid_result`.
5. **Generic invoke failure** — unrecognized error codes map to `transport_publish_invoke_failed`.
6. **Semantic baseline unchanged** — `transport-kernel-standalone-publish.ts` + `publish-outcome-mapper.ts` remain owners.

## Exit criteria for Phase B (Rust validation / assembly)

Subsequent waves may add Rust-side validation and result assembly only after:

- This exit charter is pinned in engine-lab contracts.
- W24–W28 harness tests remain green in `verify:transport-engine-w29`.
- `packages/libobscur/src/engine_invoke.rs` still returns `transport_publish_not_wired` for **valid** publish payloads (until explicit wiring wave).

## Non-goals for W29

- No Rust publish network execution.
- No port routing changes in `relay-standalone-publish-port.ts`.
- No authority flip away from transport-kernel standalone publish owner.

## Contract expectations (pinned in w29 tests)

W29 tests must assert:

- This charter exists and lists W24–W28 harness slices plus exit checklist.
- Harness contract files W24–W28 exist on disk.
- Rust `publishRelayEvent` remains `transport_publish_not_wired` for valid invokes.
- Standalone publish owner and shared mapper remain semantic baseline.
