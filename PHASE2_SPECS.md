# Phase 2 Specs: Rust Core Boundary Tightening (Full Rust Publish Lane)

Status: Completed (2026-03-17)
Roadmap linkage: `ROADMAP_v0.9.0-beta.md` -> Phase 2

## Scope Summary

Phase 2 tightens protocol ownership boundaries so security/performance-sensitive protocol paths are Rust-owned while TS remains orchestration owner.

In scope:
- Rust-owned quorum publish evaluation from native relay evidence (no simulation).
- Native relay ACK evidence tracking for protocol publish (`OK` evidence, timeout, disconnect cleanup).
- TS publish owner tightening:
  - protocol owner path when `protocolCoreEnabled && hasNativeRuntime()`,
  - deterministic legacy path for non-native runtime.
- Storage health/recovery owner alignment:
  - protocol-core owner path when protocol owner is active,
  - legacy JS owner path for non-native/legacy mode.

Out of scope:
- Kotlin/Swift adapter migration (Phase 3).
- Protocol contract shape breaking changes.
- Router/runtime supervisor rewrites beyond publish/storage owner selection.

## Spec P2.1: Ownership Map Completed

Requirements:
- Canonical owners are explicit and deterministic:
  - Rust protocol core owns quorum publish evaluation and protocol storage primitives.
  - Desktop native relay runtime owns publish attempt execution and `OK` evidence collection.
  - TS messaging/storage services own orchestration and owner-path selection only.
- Web/PWA runtime without native bridge must not attempt protocol-core command execution.

Acceptance criteria:
- Protocol owner selection in messaging publish path is based on `protocolCoreEnabled && hasNativeRuntime()`.
- When protocol owner is active, generic fallback to alternate publish owners is not used.
- Non-native runtime behavior remains deterministic and explicit.

## Spec P2.2: Contract Hardening Landed

Requirements:
- `ProtocolCommandResult<T>` shape remains stable.
- `publish_with_quorum` simulation is removed from protocol core behavior.
- Publish outcomes are derived from real per-relay attempt evidence provided by native boundary.
- Deterministic failure classes are represented via evidence/failure messages for:
  - no writable relay connection,
  - timeout waiting for `OK`,
  - relay disconnected before `OK`,
  - malformed event payload.
- Native pending ACK tracking is keyed by runtime scope + relay URL + event id and is cleaned on disconnect/recycle.

Acceptance criteria:
- Desktop protocol command `protocol_publish_with_quorum` validates payload shape and relay scope.
- Desktop relay layer resolves `OK` acknowledgements and prevents pending ACK leaks on teardown.
- Rust protocol core records deterministic quorum reports to protocol storage.

## Spec P2.3: Boundary Tests Passing

Required evidence:
- Rust protocol tests:
  - quorum met with majority success,
  - deterministic no-writable failure mapping,
  - input validation (empty payload / relay scope).
- PWA tests:
  - protocol-owner path used in native runtime,
  - deterministic legacy path when runtime is non-native,
  - storage health/recovery owner alignment tests.
- Desktop crate check includes protocol + relay ACK integration compile coverage.

Planned validation commands:
```bash
pnpm.cmd -C apps/pwa exec vitest run app/features/runtime/protocol-core-adapter.test.ts app/features/runtime/protocol-acl-parity.test.ts app/features/messaging/controllers/outgoing-dm-publisher.test.ts app/features/profile/hooks/use-profile-publisher.test.ts app/features/messaging/services/storage-health-service.test.ts
cargo test --manifest-path packages/libobscur/Cargo.toml protocol -- --nocapture
cargo check --manifest-path apps/desktop/src-tauri/Cargo.toml
pnpm.cmd release:test-pack -- --skip-preflight
pnpm.cmd ci:scan:pwa:head
pnpm.cmd version:check
pnpm.cmd docs:check
```

Execution evidence:
- `pnpm.cmd -C apps/pwa exec vitest run app/features/runtime/protocol-core-adapter.test.ts app/features/runtime/protocol-acl-parity.test.ts app/features/messaging/controllers/outgoing-dm-publisher.test.ts app/features/profile/hooks/use-profile-publisher.test.ts app/features/messaging/services/storage-health-service.test.ts`
- `cargo test --manifest-path packages/libobscur/Cargo.toml protocol -- --nocapture`
- `cargo check --manifest-path apps/desktop/src-tauri/Cargo.toml`
- `pnpm.cmd release:test-pack -- --skip-preflight`
- `pnpm.cmd ci:scan:pwa:head`
- `pnpm.cmd version:check`
- `pnpm.cmd docs:check`
