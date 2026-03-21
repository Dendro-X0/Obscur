# 02 Repository Map

_Last reviewed: 2026-03-19 (baseline commit 0a799f5)._

## Top-Level Layout

- `apps/`: runtime applications and shells.
- `packages/`: shared libraries and contracts.
- `scripts/`: quality/release utilities.
- `docs/`: canonical project docs.
- `infra/`: infrastructure assets.

## Apps

- `apps/pwa`
: Main feature implementation surface and primary runtime composition.
: Startup composition roots:
  - `apps/pwa/app/layout.tsx`
  - `apps/pwa/app/components/providers.tsx`
  - `apps/pwa/app/features/runtime/components/unlocked-app-runtime-shell.tsx`

- `apps/desktop`
: Tauri host and native command boundary.
: Native command registration and owners:
  - `apps/desktop/src-tauri/src/lib.rs`
  - `apps/desktop/src-tauri/src/net.rs`
  - `apps/desktop/src-tauri/src/relay.rs`
  - `apps/desktop/src-tauri/src/session.rs`
  - `apps/desktop/src-tauri/src/protocol.rs`
  - `apps/desktop/src-tauri/src/profiles.rs`
  - `apps/desktop/src-tauri/src/upload.rs`

- `apps/coordination`
: Cloudflare Worker for invite coordination and upload/auth utility endpoints.
: Runtime entry:
  - `apps/coordination/src/index.ts`

- `apps/relay-gateway`
: Optional relay edge proxy used in some local/dev topologies.
: Current implementation:
  - `apps/relay-gateway/src/index.ts`

- `apps/website`
: Website surface.
: Current runtime entry:
  - `apps/website/src/app/page.tsx`

## Shared Packages

- `packages/dweb-core`
: shared product contracts and base types.
: `packages/dweb-core/src/security-foundation-contracts.ts`

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
: protocol/runtime boundary:
  - `packages/libobscur/src/protocol/mod.rs`
  - `packages/libobscur/src/protocol/types.rs`
  - `packages/libobscur/src/protocol/store.rs`

## PWA Feature Index

- Runtime/bootstrap: `apps/pwa/app/features/runtime`
- Auth/identity: `apps/pwa/app/features/auth`
- Account sync/projection: `apps/pwa/app/features/account-sync`
- Relay/transport: `apps/pwa/app/features/relays`
- Messaging/requests: `apps/pwa/app/features/messaging`
- Groups/communities: `apps/pwa/app/features/groups`
- Network/trust graph: `apps/pwa/app/features/network`
- Profiles/profile scope: `apps/pwa/app/features/profile`, `apps/pwa/app/features/profiles`
- Search/discovery: `apps/pwa/app/features/search`
- Invites and deep links: `apps/pwa/app/features/invites`
- Main shell orchestration: `apps/pwa/app/features/main-shell`
- Desktop integration hooks: `apps/pwa/app/features/desktop`
- Native error surface: `apps/pwa/app/features/native`
- Query runtime integration: `apps/pwa/app/features/query`
- Notifications: `apps/pwa/app/features/notifications`
- Vault/media: `apps/pwa/app/features/vault`
- Settings/privacy flags: `apps/pwa/app/features/settings`
- Onboarding/bootstrap config: `apps/pwa/app/features/onboarding`
- Navigation/public route contracts: `apps/pwa/app/features/navigation`
- Social graph auxiliary services: `apps/pwa/app/features/social-graph`
- Crypto service/runtime adapters: `apps/pwa/app/features/crypto`
- Dev tooling/mocks: `apps/pwa/app/features/dev-tools`

## Runtime Owner Anchors

- Window runtime owner: `apps/pwa/app/features/runtime/services/window-runtime-supervisor.ts`
- Startup profile binding owner: `apps/pwa/app/features/profiles/components/desktop-profile-bootstrap.tsx`
- Startup auth-shell recovery owner: `apps/pwa/app/features/runtime/components/profile-bound-auth-shell.tsx`
- Relay runtime owner: `apps/pwa/app/features/relays/services/relay-runtime-supervisor.ts`
- Messaging transport owner runtime: `apps/pwa/app/features/messaging/services/messaging-transport-runtime.ts`
- Account backup owner: `apps/pwa/app/features/account-sync/services/encrypted-account-backup-service.ts`
- Group membership durability owner: `apps/pwa/app/features/groups/providers/group-provider.tsx`

For full canonical table and invariants, use:
- `docs/12-core-architecture-truth-map.md`
- `docs/14-module-owner-index.md`

## Tooling and Gates

- Docs validation: `scripts/docs-check.mjs`
- Version sync/check: `scripts/sync-versions.mjs`, `scripts/check-version-alignment.mjs`
- Release preflight: `scripts/release-preflight.mjs`
- Release test pack: `scripts/run-release-test-pack.mjs`
