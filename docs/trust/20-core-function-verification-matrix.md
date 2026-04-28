# 20 Core Function Verification Matrix

_Last reviewed: 2026-04-17 (baseline commit a3f16b10)._

This document defines the ordered verification plan for Obscur core
functionality during the pre-public phase.

Use this matrix when deciding what to inspect, test, and replay before
declaring a core lane trustworthy.

## Verification Order

Run core verification in this order:

1. identity, auth, and session ownership,
2. end-to-end encrypted direct messaging,
3. cross-device backup/restore and account sync,
4. account/profile isolation on the same device,
5. contacts and trust/request flows,
6. communities and membership integrity,
7. media and Vault durability,
8. deletion non-resurrection across all synchronized surfaces,
9. updater/download distribution path.

The order matters because later lanes depend on earlier ownership truth.

## Required Validation Types

Every core lane should be checked with all applicable forms of validation:

1. code inspection:
   - confirm canonical owner,
   - identify overlapping mutation paths,
   - verify explicit scope and evidence contracts.
2. automated tests:
   - focused unit/integration coverage for the touched owner path,
   - typecheck,
   - docs/release gates where relevant.
3. manual runtime replay:
   - required for relay-sensitive, lifecycle-sensitive, or cross-device flows.

## Lane 1: Identity, Auth, and Session Ownership

What must be true:

1. create/import/unlock succeeds locally first,
2. remember-me and restore reflect actual active identity,
3. stale authenticated identity is never shown when runtime is locked,
4. profile binding is explicit before account-scoped services mount.

Canonical owners:

1. `apps/pwa/app/features/auth/components/auth-gateway.tsx`
2. `apps/pwa/app/features/auth/hooks/use-identity.ts`
3. `apps/pwa/app/features/auth/utils/identity-profile-binding.ts`
4. `apps/pwa/app/features/runtime/services/window-runtime-supervisor.ts`

Minimum automated checks:

1. auth/identity unit tests,
2. profile-binding tests,
3. startup/runtime activation tests,
4. `pnpm -C apps/pwa exec tsc --noEmit --pretty false`

Manual replay:

1. create account,
2. import account,
3. lock/unlock,
4. restart and restore,
5. logout/login same device.

Execution packet:

1. `docs/releases/core-verification-identity-session.md`

## Lane 2: E2EE Direct Messaging

What must be true:

1. sender and receiver both converge on the same conversation truth,
2. incoming DMs are not dropped during restore catch-up,
3. direct messages do not route through stranger/request paths once trust is established,
4. local optimistic UI does not claim delivery truth by itself.

Canonical owners:

1. `apps/pwa/app/features/messaging/controllers/enhanced-dm-controller.ts`
2. `apps/pwa/app/features/messaging/controllers/incoming-dm-event-handler.ts`
3. `apps/pwa/app/features/messaging/controllers/outgoing-dm-publisher.ts`
4. `apps/pwa/app/features/messaging/providers/runtime-messaging-transport-owner-provider.tsx`

Minimum automated checks:

1. incoming/outgoing DM controller suites,
2. transport-owner suite,
3. deterministic DM delivery suite,
4. request/acceptance routing tests.

Manual replay:

1. `A -> B` send,
2. `B -> A` send,
3. restart/restore during receive,
4. relay degraded receive path.

Execution packet:

1. `docs/releases/core-verification-e2ee-direct-messaging.md`

## Lane 3: Cross-Device Backup, Restore, and Sync

What must be true:

1. fresh-device login restores the correct account truth,
2. restored history does not become thinner than canonical local truth,
3. restore and live relay catch-up do not fight each other,
4. restore completion requires evidence-backed state, not timeout alone.

Canonical owners:

1. `apps/pwa/app/features/account-sync/services/encrypted-account-backup-service.ts`
2. `apps/pwa/app/features/account-sync/services/account-event-bootstrap-service.ts`
3. `apps/pwa/app/features/account-sync/services/account-projection-runtime.ts`
4. `apps/pwa/app/features/messaging/hooks/use-conversation-messages.ts`

Minimum automated checks:

1. backup-service tests,
2. account-event bootstrap/reducer tests,
3. projection-read-authority tests,
4. conversation hydration integration tests.

Manual replay:

1. login on fresh device/window,
2. allow restore and relay catch-up,
3. verify sidebar, thread history, previews, and open-thread refresh.

Execution packet:

1. `docs/releases/core-verification-cross-device-restore-and-non-resurrection.md`

## Lane 4: Same-Device Account and Profile Isolation

What must be true:

1. switching accounts does not leak old contacts, history, or media,
2. derived caches rebuild when scope changes,
3. storage keys remain account/profile scoped at access time.

Canonical owners:

1. `apps/pwa/app/features/messaging/providers/messaging-provider.tsx`
2. `apps/pwa/app/features/messaging/services/message-persistence-service.ts`
3. `apps/pwa/app/features/vault/hooks/use-vault-media.ts`
4. `apps/pwa/app/features/profiles/services/profile-scope.ts`

Minimum automated checks:

1. hydration-scope tests,
2. message-persistence scope tests,
3. Vault active-identity refresh tests.

Manual replay:

1. logout,
2. login different account,
3. switch back,
4. verify no previous-account drift in chats, groups, or Vault.

Execution packet:

1. `docs/releases/core-verification-same-device-account-isolation.md`

## Lane 5: Contacts, Requests, and Trust Controls

What must be true:

1. outgoing/incoming requests converge on durable evidence,
2. accepted peers route to chat, not request limbo,
3. anti-abuse controls are local-first, reason-coded, and reversible,
4. privacy-sensitive flows do not rely on centralized moderation semantics.

Canonical owners:

1. `apps/pwa/app/features/network/providers/network-provider.tsx`
2. `apps/pwa/app/features/messaging/services/request-flow-evidence-store.ts`
3. `apps/pwa/app/features/messaging/services/incoming-request-anti-abuse.ts`
4. `apps/pwa/app/features/messaging/controllers/incoming-dm-event-handler.ts`

Minimum automated checks:

1. request transport/status tests,
2. anti-abuse tests,
3. trust/profile behavior tests.

Manual replay:

1. send request,
2. receive request,
3. accept/decline/cancel,
4. burst/quarantine replay.

Execution packet:

1. `docs/releases/core-verification-contacts-trust-and-request-flows.md`

## Lane 6: Communities and Membership Integrity

What must be true:

1. joined communities restore correctly across devices,
2. phantom groups are not fabricated from weak local evidence,
3. member leave/join truth converges from signed event evidence,
4. UI recovery routes through canonical preview/join owners.

Canonical owners:

1. `apps/pwa/app/features/groups/providers/group-provider.tsx`
2. `apps/pwa/app/features/groups/hooks/use-sealed-community.ts`
3. `apps/pwa/app/features/groups/services/community-membership-recovery.ts`
4. `apps/pwa/app/features/groups/services/community-ledger-reducer.ts`

Minimum automated checks:

1. community recovery tests,
2. provider cross-device integration tests,
3. sealed-community integration tests.

Manual replay:

1. create/invite/join,
2. exchange community messages,
3. fresh-device login,
4. leave and member-list convergence replay.

Execution packet:

1. `docs/releases/core-verification-communities-and-membership-integrity.md`

## Lane 7: Media and Vault Durability

What must be true:

1. message attachments remain visible after restore when they still exist,
2. Vault follows active identity and source conversation ownership,
3. local cache is not mistaken for remote durable truth,
4. download/save flows behave deterministically by runtime.

Canonical owners:

1. `apps/pwa/app/features/messaging/utils/logic.ts`
2. `apps/pwa/app/features/account-sync/services/encrypted-account-backup-service.ts`
3. `apps/pwa/app/features/vault/hooks/use-vault-media.ts`
4. `apps/pwa/app/features/vault/services/local-media-store.ts`

Minimum automated checks:

1. attachment parsing/compatibility tests,
2. backup attachment restore tests,
3. Vault hook/grid tests.

Manual replay:

1. media upload/send,
2. fresh-device restore,
3. Vault visibility and source badge checks,
4. file save/download replay.

Execution packet:

1. `docs/releases/core-verification-media-and-vault-durability.md`

## Lane 8: Deletion Non-Resurrection

What must be true:

1. deleted rows do not reappear after restore,
2. local delete and delete-for-everyone both suppress all canonical aliases,
3. command payload rows do not leak into timeline or preview,
4. deleted content does not reappear through backup restore, projection replay,
   or message hydration.

Canonical owners:

1. `apps/pwa/app/features/main-shell/hooks/use-chat-actions.ts`
2. `apps/pwa/app/features/account-sync/services/encrypted-account-backup-service.ts`
3. `apps/pwa/app/features/account-sync/services/account-event-bootstrap-service.ts`
4. `apps/pwa/app/features/messaging/services/message-delete-tombstone-store.ts`

Reference:

1. `docs/17-dm-delete-restore-divergence-incident.md`

Minimum automated checks:

1. delete-target derivation tests,
2. alias-contract tests,
3. backup restore/delete suppression tests,
4. persistence attachment + identity compatibility tests where relevant.

Manual replay:

1. delete-for-me,
2. delete-for-everyone,
3. fresh-device restore,
4. reopen/reload/new-message churn.

Execution packet:

1. `docs/releases/core-verification-cross-device-restore-and-non-resurrection.md`

## Lane 9: Updater and Download Distribution

What must be true:

1. if streaming install is available, the app can update in place safely,
2. if streaming install is unavailable, users are routed to the correct
   platform download target,
3. release website and app updater agree on current release truth,
4. updater failure preserves the current installed version.

Canonical owners:

1. `apps/pwa/app/components/desktop-updater.tsx`
2. `apps/pwa/app/features/updates/services/streaming-update-policy.ts`
3. `.github/workflows/release.yml`
4. `apps/website/src/app/download/page.tsx`

Minimum automated checks:

1. streaming update policy tests,
2. release download target tests,
3. release workflow contract checks,
4. website lint/build/typecheck.

Manual replay:

1. check for update,
2. install success path,
3. blocked/holdback path,
4. fallback download path,
5. post-release asset/feed verification.

Execution packet:

1. `docs/releases/core-verification-updater-and-download-distribution.md`

## Release Rule

Before broad promotion, do not describe these lanes as reliable unless:

1. owner-path code inspection is complete,
2. focused tests are green,
3. required docs are current,
4. manual replay evidence exists for the fragile/runtime-sensitive flows,
5. deleted content non-resurrection is still true after fresh-device restore.
