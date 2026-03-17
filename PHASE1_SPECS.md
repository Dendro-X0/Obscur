# Phase 1 Specs: TanStack Query Integration (Conservative Adapter Lane)

Status: Completed (2026-03-17)  
Roadmap linkage: `ROADMAP_v0.9.0-beta.md` -> Phase 1

## Scope Summary

Phase 1 introduces TanStack Query into the PWA without changing canonical runtime owners.

In scope:
- Query-only integration (`@tanstack/react-query`).
- Guarded rollout with legacy fallback.
- Scoped query-key contract for profile/account isolation.
- First migration slices:
  - discovery search,
  - identity resolution,
  - relay diagnostics probe snapshots,
  - account-sync read snapshot bridge.

Out of scope:
- TanStack Router/Table.
- Runtime supervisor ownership rewrites.
- Transport/messaging ownership migration.
- Persisted query cache.

## Locked Decisions Implemented

- Next.js App Router remains the routing owner.
- TanStack is adapter-only in Phase 1; existing services remain source-of-truth owners.
- Cache policy is memory-only (no persisted query cache).
- Rollout is feature-flag guarded (`privacySettings.tanstackQueryV1`) with legacy fallback.

## Implementation Specs

## Spec P1.1: Query Foundation and Scope Contract

Requirements:
- One query runtime provider in authenticated runtime shell.
- Deterministic query key factory with explicit scope:
  - `profileId`
  - `publicKeyHex` or `anonymous`
  - feature namespace and params
- Cache reset on profile/sign-out scope transitions.

Landed:
- `apps/pwa/app/features/query/services/query-scope.ts`
- `apps/pwa/app/features/query/services/query-key-factory.ts`
- `apps/pwa/app/features/query/providers/tanstack-query-runtime-provider.tsx`
- `apps/pwa/app/features/runtime/components/unlocked-app-runtime-shell.tsx`

## Spec P1.2: Feature-Flag Guard and Diagnostics

Requirements:
- Dedicated rollout flag integrated with settings/rollout normalization.
- Runtime diagnostics marker showing active path (legacy vs tanstack).

Landed:
- `privacySettings.tanstackQueryV1` in privacy settings + defaults + tests.
- Stability-mode normalization disables TanStack flag.
- Runtime diagnostics surface via `window.obscurTanstackQueryDiagnostics`.

## Spec P1.3: Adapter Hooks (No Owner Replacement)

Requirements:
- Preserve public hook contracts; delegate internally to TanStack path when enabled.
- Keep canonical owners:
  - `DiscoveryEngine`,
  - identity resolver service,
  - relay probe service,
  - account-sync status store.

Landed:
- `use-global-search` guarded fetchQuery adapter with cancellation integration.
- `use-identity-resolver` guarded fetchQuery adapter with scoped cache keys.
- `use-relay-diagnostics-probe-state` hook for probe snapshot adapter.
- `use-account-sync-snapshot` query cache bridge (store remains source-of-truth).
- `dev-panel` wired to relay diagnostics adapter hook.

## Spec P1.4: Validation and Isolation Tests

Requirements:
- Query key determinism and scope inclusion tests.
- Adapter/hook parity tests in migrated slices.
- Release gates remain green.

Execution evidence:
- `pnpm.cmd -C apps/pwa exec vitest run app/features/query/services/query-key-factory.test.ts app/features/search/hooks/use-identity-resolver.test.ts app/features/account-sync/hooks/use-account-sync-snapshot.test.ts app/features/settings/services/privacy-settings-service.test.ts app/features/settings/services/v090-rollout-policy.test.ts app/features/search/hooks/use-global-search.test.ts`
- `pnpm.cmd release:test-pack -- --skip-preflight`
- `pnpm.cmd ci:scan:pwa:head`
- `pnpm.cmd version:check`
- `pnpm.cmd docs:check`

## Completion Definition

Phase 1 is complete when:
- P1.1-P1.4 are landed and test-gated.
- Root roadmap Phase 1 checklist is fully checked.
- Changes are committed and pushed.

