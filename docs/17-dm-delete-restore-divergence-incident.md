# 17 DM Delete/Restore Divergence Incident (`v1.3.7` Blocker)

_Last reviewed: 2026-04-05 (baseline commit 67ce73ee)._

Status: Open, mitigation in progress. Release-blocking until two-account replay converges.

## Incident Summary

Observed user-visible failure:

1. Accounts `A` and `B` are already accepted contacts.
2. After re-login and account data synchronization, DM history diverges between devices.
3. Messages that were previously deleted can reappear on one side.
4. Timeline cards/previews can become asymmetric (`A` sees rows that `B` does not, or vice versa).

This is a history-integrity incident, not a pure UI rendering bug.

## Reproduction Envelope

The failure class appears most often when all are true:

1. long-lived test accounts with legacy data from multiple app iterations,
2. mixed deletion history (`Delete for everyone` + local-only deletes),
3. login/restore path runs while relay/account sync is still catching up,
4. backup payload contains message identity drift (`local row id` vs canonical event identity).

## Owner Path and Findings

Canonical owners:

- `apps/pwa/app/features/account-sync/services/encrypted-account-backup-service.ts`
- `apps/pwa/app/features/account-sync/services/account-event-bootstrap-service.ts`
- `apps/pwa/app/features/messaging/hooks/use-conversation-messages.ts`

Findings from code-level investigation:

1. Indexed backup hydration could prefer local row `id` over canonical `eventId`.
2. Delete-command quarantine in restore path could only match `targetMessageId` against persisted `id`.
3. Restore merge dedupe used local `id` only, allowing same canonical event to survive as duplicated logical messages if local ids differed.

Together, these create a mismatch window where delete evidence cannot reliably converge across devices.

## Landed Mitigation (This Thread)

1. Backup hydration now prefers canonical `eventId` as persisted message identity when available.
2. Persisted message contract now carries optional `eventId`.
3. Delete-command quarantine now checks both message `id` and `eventId` identity keys.
4. Restore merge dedupe now converges by canonical identity aliases (`eventId` + `id`) instead of local `id` only.
5. Added diagnostics event for unresolved delete targets:
   - `account_sync.backup_restore_delete_target_unresolved`
6. Added focused regression tests in:
   - `apps/pwa/app/features/account-sync/services/encrypted-account-backup-service.test.ts`

## Remaining Risk

Legacy payload rows that never stored canonical `eventId` can still be ambiguous if delete targets reference event identity only. Those rows are not always safely mappable after the fact.

## Investigation and Reflection

What this incident shows:

1. Deletion contracts are identity contracts first, UI contracts second.
2. Local DB row identity is not durable cross-device truth.
3. Backup/restore paths must preserve canonical transport identity, or replay semantics drift over time.
4. “Looks correct locally” is insufficient for cross-device DM invariants.

## `v1.3.7` Exit Criteria

Release cannot close until all pass:

1. Two-account replay (`A/B`) with historical deletes does not resurrect deleted DM rows after login+restore.
2. `Delete for everyone` convergence is symmetric after restore on both sides.
3. No command payload leak (`__dweb_cmd__`) into DM timeline or sidebar preview.
4. Diagnostic sweep confirms no unresolved delete-target bursts in nominal replay.

## Required Manual Replay (`A/B`)

1. Start from existing long-lived test accounts with historical delete activity.
2. Login both accounts on fresh windows; wait for restore + relay sync completion.
3. Compare the same DM thread on both sides:
   - visible rows,
   - ordering,
   - latest preview,
   - deleted-history absence.
4. Execute new delete operations:
   - `Delete for everyone` on a fresh outgoing message,
   - local-only delete of peer-authored row.
5. Re-login both sides and confirm convergence remains stable.

Evidence capture (required):

1. `account_sync.backup_restore_merge_diagnostics`
2. `account_sync.backup_restore_apply_diagnostics`
3. `account_sync.backup_restore_delete_target_unresolved`
4. `messaging.delete_for_everyone_remote_result`
