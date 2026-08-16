# Transport Engine W32 — Rust Publish Result Assembly Charter

**Status:** Charter + contract pins (design-only; no runtime wiring)  
**Last updated:** 2026-06-25  
**Band:** ENGINE-LAB / transport-engine post-B5

## Goal

Define the **Rust result assembly plan** for `publishRelayEvent` — how per-relay outcomes become `TransportPublishRelayEventResult` — without implementing assembly or network execution in this wave.

W32 is design + contract only.

## Assembly responsibilities (future wiring wave)

When publish execution is wired, Rust must:

1. Normalize `relayUrls` (trim, dedupe) consistent with TS standalone publish.
2. Record per-relay `{ relayUrl, success, error?, latency? }` for all attempts.
3. Compute `successCount`, `totalRelays`, `quorumRequired`, `metQuorum` using the same quorum rule as `publish-outcome-mapper.ts` (no forked semantics).
4. Split `results` vs `failures` arrays matching contract shape.
5. Propagate optional `correlationId` from request to result.
6. Return structurally valid JSON compatible with `isTransportPublishRelayEventResult`.

## Error semantics during assembly

- Validation failures → `invalid_payload` (W31).
- Unexpected internal errors → structured invoke error; no partial orphan payloads.
- Per-relay network failures → reflected in result arrays, not as silent drops.

## Current state (W32)

- W31 validation may reject malformed payloads.
- Valid invokes still return `transport_publish_not_wired` only.
- No result assembly code in `engine_invoke.rs` yet.

## Non-goals for W32

- No relay network I/O.
- No port authority flip.
- No deletion of `transport-kernel-standalone-publish.ts`.

## Contract expectations (pinned in w32 tests)

W32 tests must assert:

- This charter exists and defines assembly responsibilities without implementation.
- `engine_invoke.rs` contains no `TransportPublishRelayEventResult` construction for `publishRelayEvent` yet.
- Valid invokes still return `transport_publish_not_wired`.
