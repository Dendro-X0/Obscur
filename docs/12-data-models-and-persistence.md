# Data Models and Persistence

_Last reviewed: 2026-03-03 (baseline commit 7f57b32)._


This document summarizes persistent data and storage behavior relevant to maintainers.

## 1) Message Persistence (`messages` store)

Primary implementation:

- `packages/dweb-storage/src/indexed-db.ts`
- `apps/pwa/app/features/messaging/services/message-persistence-service.ts`

Expected fields in persisted message records:

- `id` (key)
- `conversationId`
- `timestampMs` (number)
- message payload fields (`content`, `kind`, status metadata, etc.)

Indexes:

- `conversationId`
- `timestampMs`
- `conversation_timestamp` (compound `[conversationId, timestampMs]`)

Usage:

- newest-page hydration by reverse cursor using compound index.
- `loadEarlier` pagination by upper timestamp bound.

## 2) Legacy State and Migration

Migration helper exists in:

- `apps/pwa/app/features/messaging/services/message-persistence-service.ts`

It can hydrate the new `messages` store from legacy `chatState` blobs where available.

Policy:

- avoid destructive migrations in alpha unless required.
- prefer additive migration helpers with rollback-safe behavior.

## 3) Privacy Settings Storage

Source:

- `apps/pwa/app/features/settings/services/privacy-settings-service.ts`

Storage key:

- `obscur.settings.privacy`

Behavior:

- reads merge persisted values over defaults.
- writes emit `privacy-settings-changed` browser event.

## 4) Identity/Auth Storage

Relevant utilities:

- `apps/pwa/app/features/auth/utils/open-identity-db.ts`
- `apps/pwa/app/features/auth/utils/get-stored-identity.ts`
- `apps/pwa/app/features/auth/utils/save-stored-identity.ts`
- `apps/pwa/app/features/auth/utils/clear-stored-identity.ts`

Maintenance guidance:

- treat identity schema changes as high-risk.
- require explicit migration/backward-compat review before shipping.

## 5) Vault/Local Media Index

Source:

- `apps/pwa/app/features/vault/services/local-media-store.ts`

Role:

- maps remote attachment URLs to local cache/index metadata (including display file name).

Guidance:

- preserve URL-to-local-entry lookup semantics used by message rendering.

## 6) Persistence Change Checklist

Before merging persistence changes:

1. verify hydration, pagination, and delete behavior.
2. run targeted messaging/group tests.
3. confirm no ordering/duplication regressions under burst tests.
4. update changelog and docs contracts if behavior changed.
