# 02 Repository Map

_Last reviewed: 2026-03-17 (baseline commit 1f075aa)._

## Top-Level Layout

- `apps/`: runtime applications and shells.
- `packages/`: shared libraries and contracts.
- `scripts/`: quality/release utilities.
- `docs/`: canonical project docs.
- `infra/`: infrastructure assets.

## Apps

- `apps/pwa`
: Main feature implementation surface (auth, runtime, messaging, account sync, relays, search, settings, vault).

- `apps/desktop`
: Tauri host and native command boundary.
  - Native command registration: `apps/desktop/src-tauri/src/lib.rs`
  - Network and relay commands: `apps/desktop/src-tauri/src/net.rs`, `apps/desktop/src-tauri/src/relay.rs`
  - Session/auth commands: `apps/desktop/src-tauri/src/session.rs`
  - Upload bridge: `apps/desktop/src-tauri/src/upload.rs`
  - Protocol/profile commands: `apps/desktop/src-tauri/src/protocol.rs`, `apps/desktop/src-tauri/src/profiles.rs`

- `apps/website`
: Website/docs-facing app.

- `apps/relay-gateway`
: Relay integration service layer.

- `apps/coordination`
: Auxiliary coordination surface.

## Shared Packages

- `packages/dweb-core`
: shared product contracts and base types (`packages/dweb-core/src/security-foundation-contracts.ts`).

- `packages/dweb-crypto`
: key derivation, encryption wrappers, PoW helpers.

- `packages/dweb-nostr`
: Nostr event creation/verification and protocol helpers.

- `packages/dweb-storage`
: storage utility primitives.

- `packages/ui-kit`
: reusable UI components.

- `packages/libobscur`
: Rust native core and protocol implementation.

## High-Value PWA Feature Roots

- Runtime: `apps/pwa/app/features/runtime`
- Auth: `apps/pwa/app/features/auth`
- Account sync: `apps/pwa/app/features/account-sync`
- Messaging: `apps/pwa/app/features/messaging`
- Relays: `apps/pwa/app/features/relays`
- Search/discovery: `apps/pwa/app/features/search`
- Profile/settings: `apps/pwa/app/features/profile`, `apps/pwa/app/features/settings`
- Vault/media: `apps/pwa/app/features/vault`

## Tooling and Gates

- Docs validation: `scripts/docs-check.mjs`
- Version sync/check: `scripts/sync-versions.mjs`, `scripts/check-version-alignment.mjs`
- Release preflight: `scripts/release-preflight.mjs`
- Release test pack: `scripts/run-release-test-pack.mjs`
