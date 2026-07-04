# Transport Engine W42 — Rust Network Publish Lab Gate Charter

**Status:** Charter + contract pins (lab gate wiring; no network execution)  
**Last updated:** 2026-06-25  
**Band:** ENGINE-LAB / transport-engine post-B5

## Goal

Introduce an explicit **lab env gate** that selects the future Rust network publish path instead of W37 dry-run assembly, without implementing network I/O in this wave.

W42 adds gate wiring only.

## Lab gate policy (pinned)

Rust `publishRelayEvent` dispatch checks:

- `NEXT_PUBLIC_OBSCUR_TRANSPORT_HOST_PUBLISH_NETWORK === "1"` → **network path** (stubbed as `transport_publish_network_not_wired` until W43+).
- Otherwise → **dry-run assembly** (`assemble_transport_publish_relay_event_dry_run`).

Payload validation (W31) runs before either path.

## TS mirror (documentation / future parity)

`transport-kernel-publish-port.ts` exposes `isTransportHostPublishNetworkEnvEnabled()` mirroring the env flag for lab policy documentation. It does not enable production routing.

## Non-goals for W42

- No per-relay network execution.
- No replacement of dry-run when network env is unset.
- No port authority flip.

## Contract expectations (pinned in w42 tests)

W42 tests must assert:

- This charter exists and documents env-gated path selection.
- `engine_invoke.rs` contains `is_transport_host_publish_network_enabled` and `transport_publish_network_not_wired`.
- Default path remains dry-run assembly.
