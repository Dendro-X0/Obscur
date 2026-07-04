# Transport Engine W36 — Rust Publish Dry-Run Assembly Charter

**Status:** Charter + contract pins (design-only; no runtime wiring)  
**Last updated:** 2026-06-25  
**Band:** ENGINE-LAB / transport-engine post-B5

## Goal

Define a **dry-run result assembly** step for `publishRelayEvent` in Rust — returning structurally valid `TransportPublishRelayEventResult` without relay network I/O — as the bridge between W31 validation and full publish execution.

W36 is design + contract only.

## Dry-run semantics (future wiring wave)

When enabled in a controlled wave, dry-run assembly must:

1. Accept validated payloads (W31 rules).
2. Normalize relay URLs consistent with TS shim/standalone owners.
3. Return per-relay results with `success: false` and explicit dry-run error (no network calls).
4. Compute quorum fields via shared mapper parity rules (no forked quorum math).
5. Replace `transport_publish_not_wired` only in the dry-run wave, not silently in production routing.

## Non-goals for W36

- No relay network I/O.
- No port authority flip (shim remains opt-in).
- No deletion of standalone publish owner.

## Contract expectations (pinned in w36 tests)

W36 tests must assert:

- This charter exists and scopes dry-run assembly only.
- `engine_invoke.rs` still returns `transport_publish_not_wired` for valid invokes in W36.
- No dry-run assembly implementation in Rust yet.
