# 18 Account-Scope and Discovery Guardrails

_Last reviewed: 2026-04-15 (baseline commit 177b3200)._

This document records two regression classes that resurfaced in production and
must not be reintroduced:

1. account-switch data-source corruption,
2. Discovery regressions around deterministic friend-code and profile routing.

These are not cosmetic issues. They break privacy boundaries, user trust, and
basic product navigation.

## Regression Class A: Account-Switch Data-Source Corruption

Observed failure:

1. user logs out,
2. user logs into a different or older account,
3. contacts/groups/chat history appear missing,
4. Vault still shows media from the previous account.

Root cause pattern:

1. canonical account-scoped state (`chatState` by `publicKeyHex`) and derived
   caches (`messages`, Vault aggregation) drift apart,
2. scoped metadata cache may be empty while richer IndexedDB state still exists,
3. derived caches can retain prior-account rows when account/profile scope
   changes unless explicitly rebuilt.

Guardrails:

1. Any derived message/media cache must be treated as scope-derived, not
   durable truth.
2. On account or profile scope change, derived caches must be rebuilt or
   cleared before UI reads from them.
3. Messaging hydration must fall back to the active account's IndexedDB
   `chatState` when scoped metadata is thin or empty.
4. Vault/media surfaces must follow the active identity and never aggregate
   media from a stale prior-account scope.
5. Do not scope privacy-critical localStorage state by `profileId` alone when
   account identity can change underneath that profile.

Canonical owners involved:

1. `apps/pwa/app/features/messaging/providers/messaging-provider.tsx`
2. `apps/pwa/app/features/messaging/services/chat-state-store.ts`
3. `apps/pwa/app/features/messaging/services/message-persistence-service.ts`
4. `apps/pwa/app/features/vault/hooks/use-vault-media.ts`
5. `apps/pwa/app/features/vault/services/local-media-store.ts`

Required replay before release claims:

1. logout -> login previous account,
2. confirm contacts/groups/history repopulate for the active account,
3. confirm Vault clears or repopulates only with active-account media,
4. capture:
: `messaging.chat_state_replaced`
: `messaging.legacy_migration_diagnostics`
: active `publicKeyHex`

## Regression Class B: Deterministic Discovery Drift

Observed failure:

1. `OBSCUR-*` friend codes stop resolving on Discover,
2. result cards sometimes route to an empty chat shell instead of the contact's
   public profile page.

Root cause pattern:

1. deterministic add-contact tokens are routed through feature-flag or rollout
   drift instead of a stable compatibility contract,
2. page-level query classification and resolver behavior drift apart,
3. fallback card actions keep legacy chat-shell routes after primary card
   navigation was repaired.

Guardrails:

1. `OBSCUR-*` friend codes are a compatibility contract. Do not silently
   disable them behind rollout drift.
2. Deterministic add-contact inputs must resolve through one canonical path:
: contact card
: friend code
: `npub`
: hex pubkey
3. Search-result person entries must route to the public profile route by
   default, not `/?pubkey=...` or any chat-shell shortcut.
4. If a result card exposes multiple affordances, all person-entry routes must
   agree on the same canonical destination.

Canonical owners involved:

1. `apps/pwa/app/search/search-page-client.tsx`
2. `apps/pwa/app/search/search-page-helpers.ts`
3. `apps/pwa/app/features/search/services/identity-resolver.ts`
4. `apps/pwa/app/features/search/components/search-result-card.tsx`

Required replay before release claims:

1. search a real `OBSCUR-*` code on Discover,
2. verify exact-match identity resolution succeeds,
3. click:
: result card body
: chevron side
: quick-add action
4. confirm all person-entry navigation lands on the public profile page.

## Non-Negotiable Rules

1. No second owner for account-scoped history truth.
2. No rollout flag may silently invalidate an existing user-facing compatibility
   token without an explicit migration path.
3. No Discovery affordance may open a chat shell as the first navigation target
   for an unresolved person result.
4. If a future fix touches any owner listed above, update:
: `CHANGELOG.md`
: `docs/12-core-architecture-truth-map.md`
: `docs/13-relay-and-startup-failure-atlas.md`
: `docs/handoffs/current-session.md`
