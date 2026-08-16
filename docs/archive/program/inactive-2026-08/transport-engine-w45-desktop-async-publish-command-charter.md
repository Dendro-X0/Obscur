# Transport Engine W45 — Desktop Async Publish Command Charter

**Status:** Implemented behind network lab gate  
**Last updated:** 2026-06-25  
**Band:** ENGINE-LAB / transport-engine post-B5

## Goal

Wire **real desktop relay pool evidence** into transport host publish when `NEXT_PUBLIC_OBSCUR_TRANSPORT_HOST_PUBLISH_NETWORK=1`, via an async Tauri command that mirrors `protocol_publish_with_quorum`.

## Wiring (pinned)

When network lab gate is enabled and desktop invokes `engine_invoke_transport_publish_relay_event`:

1. Parse/validate `publishRelayEvent` payload (W31 semantics via libobscur).
2. For each normalized relay URL, `RelayPool::publish_event_with_ack` (same timeout as protocol command).
3. Call `assemble_transport_publish_relay_event_network_with_attempts` with collected attempts + elapsed ms.
4. Return `EngineInvokeResult` (ok + `TransportPublishRelayEventResult` or invoke error).

When network lab gate is **disabled**, command falls back to sync `dispatch` (dry-run default).

## Non-goals for W45

- No TS `@obscur/engine-host` routing to this command (W46).
- No port authority flip.
- No standalone owner deletion.

## Contract expectations (pinned in w45 tests)

W45 tests must assert:

- `assemble_transport_publish_relay_event_network_with_attempts` exported from `engine_invoke.rs`.
- `engine_invoke_transport_publish_relay_event` registered in desktop `lib.rs` and `permissions/app.toml`.
- `commands/transport_engine.rs` references `RelayPool` and libobscur attempts assembly.
