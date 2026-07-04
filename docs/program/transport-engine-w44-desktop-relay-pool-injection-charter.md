# Transport Engine W44 — Desktop Relay Pool Injection Charter

**Status:** Charter + contract pins (design for W45 implementation)  
**Last updated:** 2026-06-25  
**Band:** ENGINE-LAB / transport-engine post-B5

## Goal

Define how **desktop `RelayPool`** supplies real per-relay publish attempts to the transport host publish network path, replacing W43 headless `No writable relay connection` placeholders when the network lab gate is enabled on desktop.

## Problem (post-W43)

- Sync `engine_invoke` cannot call async `RelayPool::publish_event_with_ack`.
- W43 `assemble_transport_publish_relay_event_network` uses `collect_headless_transport_publish_attempts` — honest quorum assembly without network I/O.
- Production relay I/O today lives in `protocol_publish_with_quorum` (`apps/desktop/src-tauri/src/protocol.rs`).

## Target wiring (W45+)

| Layer | Responsibility |
|-------|----------------|
| **libobscur** | `assemble_transport_publish_relay_event_network_with_attempts(payload, attempts, elapsed_ms)` — protocol quorum + result mapping (no relay I/O) |
| **Desktop async command** | `engine_invoke_transport_publish_relay_event` — mirror `protocol_publish_with_quorum` attempt loop via `RelayPool`, then call libobscur attempts API |
| **Sync `engine_invoke`** | Unchanged default: dry-run when network env off; headless network assembly when network env on (headless / non-desktop) |
| **TS host routing** | Deferred to W46 — `@obscur/engine-host` selects async desktop command when network env on |

## Sequencing

1. **W44 (this wave):** charter + contract pins only.
2. **W45:** export attempts API + register async desktop command behind network lab gate.
3. **W46:** TS routes `publishRelayEvent` to async command when network env enabled on desktop.
4. **Later:** network parity harness vs standalone owner; authority flip per W41.

## Non-goals for W44

- No TS host routing change.
- No port authority flip.
- No deletion of `transport-kernel-standalone-publish.ts` or sync `engine_invoke`.

## Contract expectations (pinned in w44 tests)

W44 tests must assert:

- This charter exists and references `RelayPool`, `publish_event_with_ack`, and `assemble_transport_publish_relay_event_network_with_attempts`.
- W43 headless collector remains in `engine_invoke.rs` for sync path until W45 desktop command is used.
- `protocol_publish_with_quorum` remains the existing protocol publish surface.
