# Transport Engine W40 — Rust Network Publish Wiring Charter

**Status:** Charter + contract pins (design-only; no network execution)  
**Last updated:** 2026-06-25  
**Band:** ENGINE-LAB / transport-engine post-B5

## Goal

Define the **Rust network publish wiring plan** for `publishRelayEvent` — per-relay execution via existing protocol surfaces — without replacing W37 dry-run assembly in this wave.

W40 is design + contract only.

## Current state (post-W37)

- `engine_invoke.rs` validates payloads (W31) and returns **dry-run** `TransportPublishRelayEventResult` (W37).
- TS standalone owner (`transport-kernel-standalone-publish.ts`) still performs native relay I/O via `relayNativeAdapter`.
- Host shim (W35/W38/W39) can route to dry-run host results when lab gate is enabled.

## Target network wiring (future wave)

When network publish is wired in `engine_invoke.rs`:

1. **Reuse protocol quorum evidence** — delegate per-relay outcomes to `packages/libobscur/src/protocol` (`publish_with_quorum_attempts` / `QuorumPublishReport`), not a parallel publish stack.
2. **Per-relay execution** — for each normalized relay URL, attempt publish with measured latency; record success/failure per relay.
3. **Result assembly** — map protocol report into `TransportPublishRelayEventResult` using the same quorum math as `publish-outcome-mapper.ts` (W32 charter).
4. **Fail-closed** — validation errors remain `invalid_payload`; unexpected internal errors return invoke errors, not partial orphan payloads.
5. **Lab gate first** — network wiring must ship behind an explicit engine-lab env gate before any production authority flip.

## Sequencing constraints

| Phase | Requirement |
|-------|-------------|
| Pre-network | W24–W39 harness + dry-run assembly green |
| Network wiring wave | Replace dry-run assembly only behind lab env gate |
| Authority flip | Separate wave after network parity evidence (W30 Phase D) |

## Non-goals for W40

- No replacement of `assemble_transport_publish_relay_event_dry_run` in this wave.
- No port authority flip.
- No deletion of `transport-kernel-standalone-publish.ts`.

## Contract expectations (pinned in w40 tests)

W40 tests must assert:

- This charter exists and references protocol publish surfaces.
- `engine_invoke.rs` still uses dry-run assembly (no network publish calls).
- Standalone publish owner remains present as runtime baseline.
