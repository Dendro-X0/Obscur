# 14 Module Owner Index

_Last reviewed: 2026-03-19 (baseline commit 0a799f5)._

## Purpose

This file maps monorepo modules to their primary owner files so work can start with the right boundary.

For critical lifecycle invariants, still treat:
- `docs/12-core-architecture-truth-map.md`

as the canonical contract.

For relay foundation execution order and phase gates:
- `docs/15-relay-foundation-hardening-spec.md`

## App Surfaces

| Surface | Primary runtime entry | Notes |
| --- | --- | --- |
| `apps/pwa` | `apps/pwa/app/layout.tsx` | Main product/runtime composition surface |
| `apps/desktop` | `apps/desktop/src-tauri/src/lib.rs` | Native host boundary for relay/session/protocol |
| `apps/coordination` | `apps/coordination/src/index.ts` | Invite coordination + upload/auth utility endpoints |
| `apps/relay-gateway` | `apps/relay-gateway/src/index.ts` | Optional relay proxy in some dev/local topologies |
| `apps/website` | `apps/website/src/app/page.tsx` | Website surface |

## Core Runtime Owners (PWA)

| Domain | Canonical owner |
| --- | --- |
| Window lifecycle | `apps/pwa/app/features/runtime/services/window-runtime-supervisor.ts` |
| Startup profile binding lifecycle | `apps/pwa/app/features/profiles/components/desktop-profile-bootstrap.tsx` |
| Startup auth-shell recovery lifecycle | `apps/pwa/app/features/runtime/components/profile-bound-auth-shell.tsx` |
| Runtime activation/degraded transition | `apps/pwa/app/features/runtime/components/runtime-activation-manager.tsx` |
| Relay runtime and recovery projection | `apps/pwa/app/features/relays/services/relay-runtime-supervisor.ts` |
| Relay transport | `apps/pwa/app/features/relays/hooks/enhanced-relay-pool.ts` |
| Messaging transport ownership invariant | `apps/pwa/app/features/messaging/services/messaging-transport-runtime.ts` |
| Account sync orchestration | `apps/pwa/app/features/account-sync/hooks/use-account-sync.ts` |
| Account backup publish/restore | `apps/pwa/app/features/account-sync/services/encrypted-account-backup-service.ts` |
| Group membership durability | `apps/pwa/app/features/groups/providers/group-provider.tsx` |

## PWA Feature Modules

| Feature root | Primary owner/entry files |
| --- | --- |
| `auth` | `apps/pwa/app/features/auth/components/auth-gateway.tsx`, `apps/pwa/app/features/auth/hooks/use-identity.ts` |
| `runtime` | `apps/pwa/app/features/runtime/services/window-runtime-supervisor.ts`, `apps/pwa/app/features/runtime/components/unlocked-app-runtime-shell.tsx` |
| `relays` | `apps/pwa/app/features/relays/providers/relay-provider.tsx`, `apps/pwa/app/features/relays/services/relay-recovery-policy.ts` |
| `account-sync` | `apps/pwa/app/features/account-sync/hooks/use-account-sync.ts`, `apps/pwa/app/features/account-sync/services/account-rehydrate-service.ts` |
| `messaging` | `apps/pwa/app/features/messaging/controllers/enhanced-dm-controller.ts`, `apps/pwa/app/features/messaging/providers/messaging-provider.tsx` |
| `groups` | `apps/pwa/app/features/groups/providers/group-provider.tsx`, `apps/pwa/app/features/groups/services/community-membership-recovery.ts` |
| `network` | `apps/pwa/app/features/network/providers/network-provider.tsx` |
| `search` | `apps/pwa/app/features/search/hooks/use-global-search.ts`, `apps/pwa/app/features/search/services/discovery-engine.ts` |
| `invites` | `apps/pwa/app/features/invites/utils/invite-manager.ts`, `apps/pwa/app/features/invites/hooks/use-invites.ts` |
| `main-shell` | `apps/pwa/app/features/main-shell/main-shell.tsx`, `apps/pwa/app/features/main-shell/hooks/use-main-shell-state.ts` |
| `profiles`/`profile` | `apps/pwa/app/features/profiles/services/profile-scope.ts`, `apps/pwa/app/features/profile/hooks/use-profile.ts` |
| `settings` | `apps/pwa/app/features/settings/services/privacy-settings-service.ts` |
| `vault` | `apps/pwa/app/features/vault/services/local-media-store.ts` |
| `query` | `apps/pwa/app/features/query/providers/tanstack-query-runtime-provider.tsx` |
| `desktop` | `apps/pwa/app/features/desktop/hooks/use-tauri.ts`, `apps/pwa/app/features/desktop/utils/tauri-api.ts` |
| `native` | `apps/pwa/app/features/native/lib/native-error-store.ts` |
| `notifications` | `apps/pwa/app/features/notifications/hooks/use-notification-preference.ts` |
| `onboarding` | `apps/pwa/app/features/onboarding/utils/fetch-bootstrap-config.ts` |
| `navigation` | `apps/pwa/app/features/navigation/public-routes.ts` |
| `social-graph` | `apps/pwa/app/features/social-graph/services/social-graph-service.ts` |
| `crypto` | `apps/pwa/app/features/crypto/crypto-service.ts` |
| `dev-tools` | `apps/pwa/app/features/dev-tools/hooks/use-dev-mode.ts` |

## Rust/Native Owners

| Domain | Owner file |
| --- | --- |
| Native relay transport and ACK handling | `apps/desktop/src-tauri/src/relay.rs` |
| Native network runtime (Tor/proxy path) | `apps/desktop/src-tauri/src/net.rs` |
| Native protocol publish quorum command bridge | `apps/desktop/src-tauri/src/protocol.rs` |
| Shared Rust protocol runtime | `packages/libobscur/src/protocol/mod.rs` |
| Shared protocol data contracts | `packages/libobscur/src/protocol/types.rs` |

## Shared TS Package Owners

| Package | Anchor |
| --- | --- |
| `packages/dweb-core` | `packages/dweb-core/src/security-foundation-contracts.ts` |
| `packages/dweb-crypto` | `packages/dweb-crypto/src/derive-public-key-hex.ts` |
| `packages/dweb-nostr` | `packages/dweb-nostr/src/create-nostr-event.ts` |
| `packages/dweb-storage` | `packages/dweb-storage/src/indexed-db.ts` |
| `packages/ui-kit` | `packages/ui-kit/src/components` |

## Usage Rules

1. Start changes from the owner row for the failing behavior.
2. If more than one owner appears to mutate the same lifecycle, isolate non-canonical paths first.
3. Add diagnostics and focused tests at owner boundaries before broad refactors.
