# Core Verification: Same-Device Account and Profile Isolation

_Last reviewed: 2026-04-17 (baseline commit a3f16b10)._

This packet covers Lane 4 from:

1. `docs/trust/20-core-function-verification-matrix.md`

The goal is to prove that switching accounts or profiles on the same device
does not cause history, contacts, groups, or media from one scope to leak into
another.

## Scope

This lane verifies:

1. logout/login account switching on the same device,
2. profile scope switching for the same account,
3. derived message cache rebuild behavior,
4. Vault/media refresh against active identity,
5. fallback hydration from the active account's canonical state only.

## Canonical Owners

1. `apps/pwa/app/features/messaging/providers/messaging-provider.tsx`
2. `apps/pwa/app/features/messaging/services/message-persistence-service.ts`
3. `apps/pwa/app/features/vault/hooks/use-vault-media.ts`
4. `apps/pwa/app/features/profiles/services/profile-scope.ts`

Reference guardrails:

1. `docs/18-account-scope-and-discovery-guardrails.md`

## Required Invariants

1. Logging into account `B` must not retain account `A` chats, contacts,
   groups, or Vault media.
2. Logging back into account `A` must restore only `A`'s scoped truth.
3. Profile scope changes for the same account must remap reads/writes to the
   correct scoped storage and not reuse stale derived caches.
4. Derived `messages`/Vault caches are scope-derived and must be rebuilt or
   cleared when account/profile scope changes.
5. If scoped metadata cache is empty but the active account's IndexedDB
   `chatState` is richer, hydration must fall back to that active account's
   canonical state rather than another account's stale cache.

## Automated Verification Set

Run:

```bash
pnpm -C apps/pwa exec vitest run app/features/messaging/providers/messaging-provider.hydration-scope.test.tsx app/features/messaging/services/message-persistence-service.test.ts app/features/vault/hooks/use-vault-media.test.tsx
pnpm -C apps/pwa exec tsc --noEmit --pretty false
pnpm docs:check
```

Expected focus:

1. `messaging-provider.hydration-scope.test.tsx`
   - account switch rehydrate,
   - profile scope switch rehydrate,
   - indexed chat-state fallback for active account only.
2. `message-persistence-service.test.ts`
   - scope-aware message index rebuild,
   - migration preference for active account state,
   - no stale cross-scope message retention.
3. `use-vault-media.test.tsx`
   - sign-out clearing,
   - account-switch media refresh,
   - active-identity-only aggregation.

## Manual Replay Set

Run on the same device/window family:

1. log into account `A`,
2. confirm chats, contacts, groups, and Vault contents for `A`,
3. log out,
4. log into account `B`,
5. verify:
   - no account `A` conversations remain visible,
   - no account `A` groups remain visible,
   - Vault shows only `B` media or an empty `B` state,
6. switch back to account `A`,
7. verify `A`'s scoped data returns without contamination from `B`,
8. if profile switching is supported in the runtime, repeat the same checks
   across two profiles for the same account.

## Evidence To Capture

Required probes:

1. `messaging.chat_state_replaced`
2. `messaging.legacy_migration_diagnostics`
3. active `publicKeyHex`
4. active `profileId`

Capture:

1. visible conversation list before and after switch,
2. visible group list before and after switch,
3. Vault item list before and after switch,
4. whether the derived message index was rebuilt for the active scope.

## Pass Criteria

This lane passes only if:

1. automated suites are green,
2. account `A` data does not remain visible after switching to `B`,
3. account `B` data does not contaminate `A` when switching back,
4. Vault/media follows the active identity only,
5. scoped fallback hydration never revives prior-account data.
