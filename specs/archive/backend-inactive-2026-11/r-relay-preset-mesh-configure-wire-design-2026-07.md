# Design — Wire preset-apply → Rust configureMeshConduits

**Status:** **L1 Pass** · 2026-07-30  
**Charter slice:** post–RUST-2 bridge (RUST-1b IPC already exists)

## Goal

When Settings applies a transport preset (or resets to product boot), desktop also calls `transport.configureMeshConduits` so Rust mesh registry matches the UI list.

## Owner

| Concern | Module |
|---------|--------|
| Preset → descriptors | `transport-kernel/build-mesh-conduits-from-preset.ts` |
| Invoke (Tauri only) | `transport-kernel/apply-rust-mesh-configure.ts` |
| Call site | `use-relays-settings-model` `applyRelayPreset` / reset |

## Rules

- Web / no Tauri: no-op (legacy pool still owns sockets).
- Fail soft: mesh configure errors do not roll back `replaceRelays`.
- Dialects: `ws(s)` → `nostr_ws`; `http(s)` → `custom`; Tor-required preset → `networkPolicy: tor_required`.
- One conduit per URL (RUST-1).
- `connect: true`; `maxRedundancy` from preset mode (basic=1, redundancy=3).

## Proof

L1: descriptor builder tests · apply helper no-op without host · mock invoke payload shape
