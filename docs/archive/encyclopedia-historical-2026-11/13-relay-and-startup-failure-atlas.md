# 13 Relay and Startup Failure Atlas

_Last reviewed: 2026-03-19 (baseline commit 0a799f5)._

This is the runtime triage map for startup stalls, relay degradation, and cross-device convergence issues.

## Startup Owner Stack (Current)

1. `apps/pwa/app/components/providers.tsx`
2. `apps/pwa/app/features/profiles/components/desktop-profile-bootstrap.tsx`
3. `apps/pwa/app/features/auth/components/auth-gateway.tsx`
4. `apps/pwa/app/features/runtime/components/profile-bound-auth-shell.tsx`
5. `apps/pwa/app/features/runtime/components/runtime-activation-manager.tsx`
6. `apps/pwa/app/features/runtime/services/window-runtime-supervisor.ts`

## Relay Owner Stack

1. Relay runtime owner
: `apps/pwa/app/features/relays/services/relay-runtime-supervisor.ts`

2. Relay recovery policy owner
: `apps/pwa/app/features/relays/services/relay-recovery-policy.ts`

3. Relay transport owner
: `apps/pwa/app/features/relays/hooks/enhanced-relay-pool.ts`

## State Surfaces and Meaning

- Window runtime snapshot
: `window.obscurWindowRuntime.getSnapshot()`
: profile/identity/runtime activation truth.

- Relay runtime snapshot
: `window.obscurRelayRuntime.getSnapshot()`
: writable/subscribable relay truth and recovery state.

- Relay transport journal
: `window.obscurRelayTransportJournal.getSnapshot()`
: subscription replay and outbound transport evidence.

- App event digest
: `window.obscurAppEvents.getDigest(300)`
: compact diagnostics when raw logs are too large.

## Failure Classes

## 1) Infinite or very long startup

Primary boundaries:
- `desktop-profile-bootstrap.tsx` (profile refresh deadline and retry)
- `open-identity-db.ts` (IndexedDB timeout/blocked guard)
- `use-identity.ts` (recoverable bootstrap errors fail-open to locked state)
- `profile-bound-auth-shell.tsx` (stall recovery UI and lock-to-login action)
- `runtime-activation-manager.tsx` (activation timeout to degraded)

## 2) Relay degraded but app appears responsive/inconsistent

Primary boundaries:
- `relay-runtime-supervisor.ts`
- `relay-recovery-policy.ts`
- `runtime-activation-manager.tsx` (`relay_runtime_degraded` emission)

Rule:
- do not infer relay health from banners or page visuals; use runtime snapshot evidence.

## 3) Page transitions freeze under relay/event churn

Primary boundaries:
- `apps/pwa/app/components/app-shell.tsx` (transition watchdog + auto-disable effects)
- `apps/pwa/app/components/page-transition-recovery.ts`
- `apps/pwa/app/features/relays/providers/relay-provider.tsx` (refresh cadence)
- `apps/pwa/app/features/account-sync/services/account-projection-runtime.ts` (replay backpressure)

## 4) Cross-device DM history loses self-authored messages

Primary boundaries:
- `dm-subscription-manager.ts`
- `dm-sync-orchestrator.ts`
- `incoming-dm-event-handler.ts`
- `encrypted-account-backup-service.ts`
- `message-persistence-service.ts`

## 5) Group membership visible in one surface but not another

Primary boundaries:
- `community-membership-recovery.ts`
- `community-membership-reconstruction.ts`
- `group-provider.tsx`

## 6) Account switch shows empty chats but previous-account Vault/media

Primary boundaries:
- `messaging-provider.tsx`
- `chat-state-store.ts`
- `message-persistence-service.ts`
- `use-vault-media.ts`
- `local-media-store.ts`

Signal:
- active account/profile changed, but derived message/media caches did not rebuild.

## 7) Discover cannot resolve `OBSCUR-*` or routes people into empty chat

Primary boundaries:
- `search-page-client.tsx`
- `search-page-helpers.ts`
- `identity-resolver.ts`
- `search-result-card.tsx`

Signal:
- deterministic add-contact token is treated like generic search input, or a
  person-result action routes into chat-shell navigation instead of the public
  profile page.

## Minimal Runtime Capture (Copy-Safe)

```js
window.obscurWindowRuntime?.getSnapshot?.()
window.obscurRelayRuntime?.getSnapshot?.()
window.obscurRelayTransportJournal?.getSnapshot?.()
window.obscurAppEvents?.getDigest?.(300)
```

For sync regressions:

```js
window.obscurAppEvents?.findByName?.("account_sync.backup_restore_merge_diagnostics", 20)
window.obscurAppEvents?.findByName?.("account_sync.backup_restore_apply_diagnostics", 20)
window.obscurAppEvents?.findByName?.("messaging.legacy_migration_diagnostics", 20)
window.obscurAppEvents?.findByName?.("relay.runtime_performance_gate", 20)
```

## Triage Order

1. Identify canonical owner for the failing state.
2. Confirm failure layer: startup, relay runtime, projection/sync, or UI liveness.
3. Collect compact runtime snapshots before long logs.
4. Isolate overlapping mutation paths before behavior patches.
5. Land fix with focused tests and docs updates in the same change set.
