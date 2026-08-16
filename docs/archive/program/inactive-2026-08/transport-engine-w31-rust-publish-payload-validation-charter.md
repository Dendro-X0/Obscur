# Transport Engine W31 — Rust Publish Payload Validation Charter

**Status:** Charter + contract pins (validation-only; no publish execution)  
**Last updated:** 2026-06-25  
**Band:** ENGINE-LAB / transport-engine post-B5

## Goal

Add **Rust-side input validation** for `publishRelayEvent` in `engine_invoke.rs`, returning `invalid_payload` for structurally invalid requests, while preserving `transport_publish_not_wired` for valid payloads.

W31 does **not** send relay messages or assemble publish outcomes.

## Validation rules (pinned)

`publishRelayEvent` must reject with `invalid_payload` when:

1. Request `payload` is missing.
2. `relayUrls` is missing, not an array, or empty after trim/dedupe.
3. `payload` (event string) is missing or empty after trim.

Valid payloads continue to return:

- `error_code = "transport_publish_not_wired"`
- No result data; no network execution.

## TS host adapter mapping

`invalid_payload` from Rust is a generic invoke error at the host boundary. The typed adapter maps it to `transport_publish_invoke_failed` (fail-closed, no silent fallback to standalone owner).

## Non-goals for W31

- No per-relay publish execution.
- No `TransportPublishRelayEventResult` assembly in Rust.
- No routing changes in `relay-standalone-publish-port.ts`.

## Contract expectations (pinned in w31 tests)

W31 tests must assert:

- This charter exists and states validation-only scope.
- `engine_invoke.rs` returns `invalid_payload` for empty/malformed publish payloads.
- Valid publish payloads still return `transport_publish_not_wired`.
- Cargo unit tests cover both paths.
