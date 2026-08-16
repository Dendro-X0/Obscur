# Transport Engine W43 — Rust Network Publish Protocol Wiring

**Status:** Implemented behind network lab gate (headless evidence path)  
**Last updated:** 2026-06-25  
**Band:** ENGINE-LAB / transport-engine post-B5

## Goal

Replace the W42 `transport_publish_network_not_wired` stub with **protocol-backed publish assembly** when the network lab gate is enabled.

## Wiring (pinned)

When `NEXT_PUBLIC_OBSCUR_TRANSPORT_HOST_PUBLISH_NETWORK=1`:

1. Parse/validate publish payload (W31).
2. Open `ProtocolRuntime` (env `OBSCUR_PROTOCOL_DB_PATH` or temp db).
3. Collect per-relay publish attempts (headless: honest `No writable relay connection` until desktop relay pool injection wave).
4. Call `publish_with_quorum_attempts`.
5. Map `QuorumPublishReport` → `TransportPublishRelayEventResult`.

When network env is unset, W37 dry-run assembly remains the path.

## Non-goals for W43

- No desktop `RelayPool` injection into `engine_invoke` yet.
- No port authority flip.
- No standalone owner deletion.

## Contract expectations (pinned in w43 tests)

W43 tests must assert:

- `assemble_transport_publish_relay_event_network` and `publish_with_quorum_attempts` present in `engine_invoke.rs`.
- Network gate enabled returns structured publish result (not `transport_publish_network_not_wired`).
- Headless network path records `No writable relay connection` per relay.
