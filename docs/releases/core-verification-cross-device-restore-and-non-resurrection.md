# Core Verification: Cross-Device Restore, Sync, and Non-Resurrection

_Last reviewed: 2026-04-17 (baseline commit a3f16b10)._

This packet covers the highest-risk part of Lane 3 and Lane 8 from:

1. `docs/trust/20-core-function-verification-matrix.md`

The goal is to prove that cross-device restore and synchronization converge on
the right account data without restoring deleted content in any form.

## Scope

This lane verifies:

1. fresh-device login and backup restore,
2. chat/sidebar/conversation hydration after restore,
3. account sync and projection replay convergence,
4. same-account state only,
5. durable delete suppression across restore and replay,
6. non-resurrection of deleted history, command rows, previews, and media.

## Canonical Owners

1. `apps/pwa/app/features/account-sync/services/encrypted-account-backup-service.ts`
2. `apps/pwa/app/features/account-sync/services/account-event-bootstrap-service.ts`
3. `apps/pwa/app/features/account-sync/services/account-event-reducer.ts`
4. `apps/pwa/app/features/messaging/hooks/use-conversation-messages.ts`
5. `apps/pwa/app/features/messaging/services/message-delete-tombstone-store.ts`
6. `apps/pwa/app/features/main-shell/hooks/use-chat-actions.ts`

Reference incidents and guardrails:

1. `docs/17-dm-delete-restore-divergence-incident.md`
2. `docs/18-account-scope-and-discovery-guardrails.md`

## Required Invariants

1. Fresh-device restore must repopulate the correct account only.
2. Restored history must not silently shrink compared with the canonical same-account truth unless deletion evidence or explicit owner rules say so.
3. Command payload rows (`__dweb_cmd__`) must never appear as user-visible restored history.
4. Delete-for-me and delete-for-everyone suppression must survive:
   - backup publish,
   - backup restore,
   - projection replay,
   - live relay catch-up,
   - same-device re-open.
5. Deleted message content must not reappear in:
   - message timeline,
   - conversation preview/sidebar rows,
   - media/Vault surfaces,
   - cross-device restore on a new login.
6. Account sync timeout or delayed convergence must not mark restore complete by assumption alone.

## Automated Verification Set

Run:

```bash
pnpm -C apps/pwa exec vitest run app/features/account-sync/services/encrypted-account-backup-service.test.ts app/features/account-sync/services/encrypted-account-backup-service.attachments.test.ts app/features/account-sync/services/account-event-bootstrap-service.test.ts app/features/account-sync/services/account-event-reducer.test.ts app/features/messaging/hooks/use-conversation-messages.integration.test.ts app/features/main-shell/hooks/use-chat-actions.delete-targets.test.ts app/features/messaging/services/message-identity-alias-contract.test.ts app/features/messaging/utils/persistence.attachments.test.ts
pnpm -C apps/pwa exec tsc --noEmit --pretty false
pnpm docs:check
```

Expected focus:

1. backup parse/merge/hydrate/build behavior,
2. canonical event identity preference and alias handling,
3. command/delete suppression,
4. conversation rehydrate after `CHAT_STATE_REPLACED_EVENT`,
5. sparse/late restore hydration behavior,
6. attachment/media persistence contracts.

## Manual Replay Set

Run with at least two accounts (`A`, `B`) and a fresh device/window:

1. establish accepted contact state and normal DM history,
2. send normal text/media messages in both directions,
3. perform:
   - local delete for me,
   - delete for everyone,
   - media-containing history where possible,
   - voice/call-log invite rows if present,
4. log into a fresh device/window and allow account restore + relay catch-up,
5. verify:
   - contacts and conversations reappear for the correct account,
   - non-deleted messages remain visible,
   - deleted rows do not return,
   - previews do not leak deleted content,
   - media/Vault does not resurrect deleted items,
   - already-open conversation refreshes after replace event without reload.

## Evidence To Capture

Required probes:

1. `account_sync.backup_restore_merge_diagnostics`
2. `account_sync.backup_restore_apply_diagnostics`
3. `account_sync.backup_restore_delete_target_unresolved`
4. `messaging.chat_state_replaced`
5. `messaging.legacy_migration_diagnostics`
6. `messaging.delete_for_everyone_remote_result`

Capture:

1. restored conversation row count,
2. whether deleted rows reappeared,
3. survivor `id` / `eventId` pairs if any resurrection occurs,
4. whether a missing row is truly gone or present with broken displayability,
5. whether Vault/media still references deleted content.

## Pass Criteria

This lane passes only if:

1. automated suites are green,
2. fresh-device restore converges on the correct account data,
3. deleted messages and deleted media do not reappear in any synchronized
   surface,
4. command payload rows do not leak into UI history or previews,
5. non-deleted history still survives restore normally,
6. runtime replay confirms the result, not just the tests.
