# Phase 3 Specs: Mobile Native Boundary Hardening (Full Mobile Core)

Status: Completed (2026-03-17)  
Roadmap linkage: `ROADMAP_v0.9.0-beta.md` -> Phase 3

## Scope Summary

Phase 3 hardens Kotlin/Swift mobile adapters so they are thin shells over Rust-owned contracts, with secure-key fail-closed behavior and Android/iOS parity validation.

In scope:
- Key-scoped Rust FFI contracts for push decrypt and background sync.
- Rust-owned background sync lane with relay I/O and checkpoint persistence.
- Mobile secure-key lifecycle migration away from plaintext persistence.
- Drift guards and parity checks for Android/iOS adapter files.

Out of scope:
- Kotlin/Swift business-logic ownership.
- Breaking TS API surface changes.
- Relaxing secure-storage fail-closed policy.

## Spec P3.1: FFI Adapter Path Standardization

Requirements:
- Mobile adapters call key-scoped Rust contracts (`decryptPushPayloadForKey`, `backgroundSyncForKey`).
- Placeholder/simulation paths are removed from Android and iOS adapter files.
- Adapter failure classes are deterministic (`locked_no_secure_key`, malformed payload, timeout/offline categories).

Acceptance criteria:
- Kotlin/Swift adapters no longer read secret key material from app prefs/defaults.
- FFI exports include key-scoped push decrypt and background sync entrypoints.

## Spec P3.2: Secure Storage Policy

Requirements:
- Mobile secret persistence uses Rust keystore interfaces only.
- Session rehydrate path is secure-store only.
- Missing secure keys produce deterministic locked behavior (fail closed).

Acceptance criteria:
- Mobile wallet path does not persist plaintext `nsec`.
- Locked state is surfaced consistently when secure key material is unavailable.

## Spec P3.3: Android/iOS Parity Matrix and Drift Guards

Requirements:
- Concise parity matrix documenting both platforms across key lifecycle, push decrypt, background sync, and fail-closed behavior.
- Automated drift checks:
  - no placeholders/simulation markers,
  - no direct secret reads in adapter layer,
  - key-scoped contract usage parity.

Acceptance criteria:
- Parity matrix doc exists in `/docs`.
- Drift guard tests pass in PWA test suite.

## Validation Gates

```bash
pnpm -C apps/pwa exec vitest run
cargo test --manifest-path packages/libobscur/Cargo.toml -- --nocapture
cargo check --manifest-path apps/desktop/src-tauri/Cargo.toml
pnpm release:test-pack -- --skip-preflight
pnpm ci:scan:pwa:head
pnpm version:check
pnpm docs:check
```

## Execution Evidence (2026-03-17)

Gate results:
- `pnpm --dir apps/pwa exec vitest run`: passing.
- `cargo test --manifest-path packages/libobscur/Cargo.toml -- --nocapture`: passing.
- `cargo check --manifest-path apps/desktop/src-tauri/Cargo.toml`: passing.
- `pnpm release:test-pack -- --skip-preflight`: passing.
- `pnpm ci:scan:pwa:head`: passing.
- `pnpm version:check`: passing.
- `pnpm docs:check`: passing.

Additional stabilization landed during this run:
- `packages/libobscur/src/crypto/nip04.rs` now delegates to canonical `nostr::nips::nip04` encrypt/decrypt to avoid intermittent ECDH/public-key mismatch and CBC unpad failures in `crypto::nip04::tests::test_nip04_roundtrip`.

Status interpretation:
- P3.1/P3.2/P3.3 implementation work is landed in this branch.
- Phase 3 gates are currently deterministic and green in this workspace run.
