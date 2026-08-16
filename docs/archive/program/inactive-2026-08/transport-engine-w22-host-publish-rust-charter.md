# Transport Engine W22 — Rust Host Publish Wiring Charter

**Status:** Charter + contract pins (design-only; no runtime wiring)  
**Last updated:** 2026-06-25  
**Band:** ENGINE-LAB / transport-engine post-B5

## Goal

Define and pin the **Rust-side wiring plan** for the transport-engine host publish method (`publishRelayEvent`) — including result shape, error codes, and mapping responsibilities — **without** changing runtime behavior in this wave.

W22 does **not** send any relay messages from Rust. The existing `transport_publish_not_wired` stub remains the only runtime behavior.

## Current state

- **Engine host boundary (TS):**
  - `@obscur/engine-contracts`
    - Request: `TransportPublishRelayEventPayload` + `buildTransportPublishRelayEventRequest`
    - Result contract: `TransportPublishRelayEventResult`, `TransportPublishRelayEventRelayResult`
    - Guard: `isTransportPublishRelayEventResult(...)`
- **Desktop host port (TS):**
  - `features/transport-kernel/transport-engine-host-port.ts`
    - `invokeTransportPublishRelayEvent(...)` → raw `EngineInvokeResult`
    - `publishRelayEventViaTransportEngineHost(...)` → typed wrapper returning `TransportPublishRelayEventHostResult`
- **Rust invoke boundary:**
  - `packages/libobscur/src/engine_invoke.rs`
    - `dispatch_transport` handles `listRelayCheckpoints`, `listConfiguredRelayUrls`
    - `"publishRelayEvent"` branch returns:
      - `error_code = "transport_publish_not_wired"`
      - No result payload; no routing or persistence logic

## Target Rust responsibilities (future waves)

When host publish is eventually wired in Rust, the responsibilities should be:

1. **Input validation (shared with TS validator)**
   - Ensure `relayUrls` and `payload` are non-empty after normalization.
   - Fail with a specific `invalid_payload` error if inputs are structurally invalid.

2. **Publish execution**
   - Map input `relayUrls` to per-relay attempts:
     - Respect deduplication and normalization rules defined on the JS side.
   - Execute per-relay publish (network or protocol layer) with:
     - Success/failure per relay (URL, success flag, optional error string, optional latency).

3. **Result assembly**
   - Compute `successCount`, `totalRelays`, `quorumRequired`, `metQuorum` according to the parity rules already owned by the shared publish-outcome mapper.
   - Package a value structurally compatible with `TransportPublishRelayEventResult` for return via `EngineInvokeResult.data`.

4. **Error semantics**
   - Distinguish:
     - Input/validation errors (`invalid_payload`)
     - Storage/state errors (`db_error`)
     - Network/protocol failures that still yield a structured publish outcome.

5. **Correlation and observability**
   - Propagate an optional `correlationId` from `TransportPublishRelayEventPayload` into the result.
   - Emit structured logs or metrics that can be correlated with host-side evidence when needed.

## Non-goals / constraints for W22

W22 is design + contract only.

- Do **not**:
  - Implement the actual Rust logic for `publishRelayEvent`.
  - Change `engine_invoke.rs` behavior for `publishRelayEvent` (must still return `transport_publish_not_wired`).
  - Introduce new error codes that conflict with the existing JS host adapter or shared mappers.
- W22 is **design + contract** only:
  - Wiring and implementation belong to later waves once parity tests are in place.

## Contract expectations (pinned in w22 tests)

W22 engine-lab contract tests must assert:

- This charter file exists and explicitly:
  - Identifies the future Rust responsibilities for `publishRelayEvent`.
  - States that `transport_publish_not_wired` remains the only runtime behavior for this wave.
- `packages/libobscur/src/engine_invoke.rs` still contains the `"publishRelayEvent"` match arm returning `transport_publish_not_wired`.
- No additional publish-related Rust result wiring has been introduced yet (no accidental implementation).

## Exit criteria for wiring waves

Subsequent waves may begin Rust wiring only after:

- Parity requirements (W19 charter + W20 result contract + W21 typed host adapter) remain satisfied.
- New contract tests explicitly cover:
  - End-to-end mapping from Rust per-relay outcomes into `TransportPublishRelayEventResult`.
  - Alignment between Rust-computed quorum fields and the shared publish-outcome mapper.
- The `transport_publish_not_wired` stub is replaced in a controlled wave with:
  - A concrete implementation that still fails closed on unexpected conditions.

