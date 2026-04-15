# 12 Core Architecture Truth Map

_Last reviewed: 2026-03-29 (baseline commit cad5779e)._

This document is the architecture contract for current development and release work.

Companion docs:
1. `docs/13-relay-and-startup-failure-atlas.md` (failure triage map)
2. `docs/14-module-owner-index.md` (owner/module lookup)
3. `docs/history/version-context.md` (history and consolidation rules)

## Canonical Owner Table

1. Window lifecycle owner
: `apps/pwa/app/features/runtime/services/window-runtime-supervisor.ts`
2. Startup profile-binding owner
: `apps/pwa/app/features/profiles/components/desktop-profile-bootstrap.tsx`
3. Startup auth-shell recovery owner
: `apps/pwa/app/features/runtime/components/profile-bound-auth-shell.tsx`
4. Runtime activation/degradation owner
: `apps/pwa/app/features/runtime/components/runtime-activation-manager.tsx`
5. Relay recovery owner
: `apps/pwa/app/features/relays/services/relay-runtime-supervisor.ts`
6. Relay transport owner
: `apps/pwa/app/features/relays/hooks/enhanced-relay-pool.ts`
7. Account backup publish/restore owner
: `apps/pwa/app/features/account-sync/services/encrypted-account-backup-service.ts`
8. Account sync orchestration owner
: `apps/pwa/app/features/account-sync/hooks/use-account-sync.ts`
9. Chat state persistence owner
: `apps/pwa/app/features/messaging/services/chat-state-store.ts`
10. Group/community membership durability owner
: `apps/pwa/app/features/groups/providers/group-provider.tsx`
: `apps/pwa/app/features/groups/services/community-membership-recovery.ts`

Hard rule:
1. do not add a second owner for any row above,
2. remove or isolate parallel mutation paths before behavior fixes.

## Critical Runtime Invariants

1. Identity/profile scope resolves before account-scoped stores mount.
2. Signed-out windows stay light (no heavy sync/transport ownership).
3. Recovery completion is never inferred from timeout-only signals.
4. Restore/replay cannot silently shrink self-authored history.
5. Startup must fail-open to actionable state (`locked`, `degraded`, `fatal`).
6. Relay runtime truth and window runtime truth are separate; UI state is not transport truth.
7. Derived `messages`/Vault caches must never outlive the active account/profile scope.
8. Deterministic add-contact tokens (`OBSCUR-*`, contact card, `npub`, hex pubkey) must converge on one canonical resolver path.
9. Discovery person-entry navigation must converge on the public profile route, not a chat-shell shortcut.

## Startup and Runtime Flow (Current)

1. `AppProviders` composes startup path.
2. `DesktopProfileBootstrap` resolves and bounds profile refresh.
3. `AuthGateway` + `useIdentity` resolve identity lock/unlock.
4. `ProfileBoundAuthShell` handles startup stall/fatal recovery actions.
5. `UnlockedAppRuntimeShell` mounts relay/groups/network/messaging owners.
6. `RuntimeActivationManager` emits ready/degraded transitions.

## Required Diagnostics (Do Not Remove)

1. Runtime snapshots:
: `window.obscurWindowRuntime.getSnapshot()`
: `window.obscurRelayRuntime.getSnapshot()`
2. Transport journal:
: `window.obscurRelayTransportJournal.getSnapshot()`
3. App event digest:
: `window.obscurAppEvents.getDigest(300)`
4. Sync/restore convergence:
: `account_sync.backup_restore_merge_diagnostics`
: `account_sync.backup_restore_apply_diagnostics`

## Architecture Change Gate (Before Merge)

1. Which canonical owner changed?
2. Which overlapping mutation paths were removed or isolated?
3. Which invariant is protected?
4. Which diagnostics verify runtime convergence?
5. Which focused tests cover sender/receiver or two-device behavior?

If these are not explicitly answered, the change is not architecture-safe.

## Minimal Verification Set

```bash
pnpm -C apps/pwa exec tsc --noEmit
pnpm -C apps/pwa exec vitest run app/features/runtime/components/runtime-activation-manager.test.tsx app/features/runtime/components/profile-bound-auth-shell.test.tsx app/features/auth/hooks/use-identity.test.ts app/features/account-sync/hooks/use-account-sync.test.ts app/features/account-sync/services/encrypted-account-backup-service.test.ts app/features/groups/providers/group-provider.cross-device-membership.integration.test.tsx
pnpm docs:check
```

## Anti-Drift Policy

1. Prefer subtraction over compatibility layering.
2. Do not claim fixes from tests alone; include runtime evidence.
3. Update this file, `docs/03-runtime-architecture.md`, and `CHANGELOG.md` together when owner boundaries change.
