# Core Verification: Identity and Session Ownership

_Last reviewed: 2026-04-17 (baseline commit a3f16b10)._

This packet covers Lane 1 from:

1. `docs/trust/20-core-function-verification-matrix.md`

The goal is to prove that auth, unlock, restore, and profile binding behave
deterministically before broader promotion.

## Scope

This lane verifies:

1. create/import/unlock local success behavior,
2. remember-me and session restore behavior,
3. explicit profile binding before account-scoped services mount,
4. locked/unlocked state truth after restart or account switch,
5. mismatch handling between stored identity, native session, and bound profile.

## Canonical Owners

1. `apps/pwa/app/features/auth/components/auth-gateway.tsx`
2. `apps/pwa/app/features/auth/hooks/use-identity.ts`
3. `apps/pwa/app/features/auth/utils/identity-profile-binding.ts`
4. `apps/pwa/app/features/runtime/services/window-runtime-supervisor.ts`

## Required Invariants

1. Import/create/unlock succeeds locally first and is not redefined by later
   relay/account-sync work.
2. A locked runtime must not present stale unlocked identity UI.
3. Profile binding is resolved before account-scoped runtime owners are treated
   as active.
4. Same-pubkey rehydrate preserves unlocked identity continuity where valid.
5. Native/stored/private-key mismatches fail visibly into the correct locked or
   blocked state instead of silently switching identities.
6. Account/profile switching must not reuse another identity's remembered token
   candidates.

## Automated Verification Set

Run:

```bash
pnpm -C apps/pwa exec vitest run app/features/auth/components/auth-gateway.test.tsx app/features/auth/hooks/use-identity.test.ts app/features/auth/utils/identity-profile-binding.test.ts app/features/runtime/services/window-runtime-supervisor.test.ts
pnpm -C apps/pwa exec tsc --noEmit --pretty false
pnpm docs:check
```

Expected focus:

1. `auth-gateway.test.tsx`
   - auto-unlock candidate iteration,
   - remember-me preservation on failure,
   - profile-binding aware unlock behavior.
2. `use-identity.test.ts`
   - native mismatch diagnostics,
   - private-key mismatch rejection,
   - same-pubkey unlocked continuity.
3. `identity-profile-binding.test.ts`
   - scoped binding reuse,
   - same-account local-state remap,
   - explicit desktop profile-slot authority.
4. `window-runtime-supervisor.test.ts`
   - boot -> auth_required,
   - unlock -> activating_runtime -> ready,
   - late profile bind reconvergence.

## Manual Replay Set

Run in desktop and PWA where applicable:

1. Create new identity and confirm local success before any network sync.
2. Import existing identity and confirm bound profile selection is explicit.
3. Lock and unlock with expected credential path.
4. Restart with remember-me enabled and confirm:
   - correct profile binds,
   - no stale identity chip appears while locked,
   - runtime reaches the correct phase sequence.
5. Logout and log into another account on the same device/window family.
6. If native session restore exists, confirm mismatched native identity does not
   silently unlock the wrong account.

## Evidence To Capture

Preferred probes:

1. `window.obscurAppEvents.findByName("auth.auto_unlock_scan", 30)`
2. runtime snapshot via:

```js
window.obscurWindowRuntime?.getSnapshot?.()
```

Capture:

1. runtime phase,
2. identity status,
3. active profile id,
4. any mismatch reason,
5. whether unlock path succeeded locally before sync follow-up.

## Pass Criteria

This lane passes only if:

1. automated suites are green,
2. manual replay shows correct locked/unlocked/profile-bound truth,
3. no stale identity presentation appears during restore,
4. mismatches fail explicitly instead of silently rebinding to another account.
