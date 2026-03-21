# 12 Core Architecture Truth Map

_Last reviewed: 2026-03-19 (baseline commit 0a799f5)._

This document is the architecture contract for the active `v0.9.2` recovery lane.

Companion docs:
- `docs/13-relay-and-startup-failure-atlas.md` (failure triage map)
- `docs/14-module-owner-index.md` (owner/module lookup)
- `docs/17-v0.9.2-expansion-context.md` (expansion handoff)

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

Rule:
- Do not add a second owner for any row above.
- Remove or isolate parallel mutation paths before behavior fixes.

## Critical Runtime Invariants

1. Identity/profile scope must resolve before account-scoped stores mount.
2. Signed-out windows must stay light (no heavy sync/transport ownership).
3. Recovery completion cannot be inferred from timeout-only signals.
4. Restore and replay must not silently shrink self-authored history.
5. Startup must fail-open to actionable state (`locked`, `degraded`, `fatal`) instead of indefinite loading.
6. Relay runtime truth and window runtime truth are separate; UI state is not transport truth.

## Startup and Runtime Flow (Current)

1. `AppProviders` composes startup path.
2. `DesktopProfileBootstrap` resolves/bounds profile refresh.
3. `AuthGateway` and `useIdentity` resolve identity lock/unlock.
4. `ProfileBoundAuthShell` handles startup stall/fatal recovery actions.
5. `UnlockedAppRuntimeShell` mounts relay, groups, network, messaging owners.
6. `RuntimeActivationManager` emits ready/degraded transitions.

## Required Diagnostics (Do Not Remove)

1. Runtime snapshots:
: `window.obscurWindowRuntime.getSnapshot()`
: `window.obscurRelayRuntime.getSnapshot()`

2. Transport journal:
: `window.obscurRelayTransportJournal.getSnapshot()`

3. App event digest:
: `window.obscurAppEvents.getDigest(300)`

4. Account restore:
: `account_sync.backup_restore_merge_diagnostics`
: `account_sync.backup_restore_apply_diagnostics`

## Change Gate Checklist (Before Merge)

1. Which canonical owner changed?
2. Which overlapping mutation paths were removed or isolated?
3. Which invariant is protected by this change?
4. Which diagnostics verify convergence at runtime?
5. Which focused tests cover sender/receiver or two-device behavior?

If these answers are missing, the change is not architecture-safe.

## Minimal Verification Set

```bash
pnpm.cmd -C apps/pwa exec tsc --noEmit
pnpm.cmd -C apps/pwa exec vitest run app/features/runtime/components/runtime-activation-manager.test.tsx app/features/runtime/components/profile-bound-auth-shell.test.tsx app/features/auth/hooks/use-identity.test.ts app/features/account-sync/hooks/use-account-sync.test.ts app/features/account-sync/services/encrypted-account-backup-service.test.ts app/features/groups/providers/group-provider.cross-device-membership.integration.test.tsx
pnpm.cmd docs:check
```

## Anti-Drift Policy

- Prefer subtraction over compatibility layering.
- Do not claim fixes from tests only; include runtime evidence.
- Update this file, `docs/03-runtime-architecture.md`, and changelog together when owner boundaries change.
