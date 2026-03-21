# 16 Cross-Device Group Visibility Incident

_Last reviewed: 2026-03-19 (baseline commit 0a799f5)._

Status: Mitigated in active `v0.9.2` lane, monitor for regressions.

## Incident Summary

Historical failure:
- after login on a new device, previously joined groups disappeared from `Network -> Groups`.

Primary impact:
- users appeared to be in-community in some views, but group list hydration dropped to empty.

## Landed Mitigations

1. Membership recovery precedence is explicit:
: tombstone -> membership ledger -> persisted chat fallback.
2. Missing ledger coverage can be reconstructed from backup chat/group evidence.
3. Group provider hydration uses canonical precedence and avoids stale empty snapshot promotion.
4. Cross-device integration tests now cover delayed restore/replay membership reconstruction.

## Canonical Owners

- `apps/pwa/app/features/groups/providers/group-provider.tsx`
- `apps/pwa/app/features/groups/services/community-membership-recovery.ts`
- `apps/pwa/app/features/groups/services/community-membership-reconstruction.ts`
- `apps/pwa/app/features/account-sync/services/encrypted-account-backup-service.ts`

## Residual Risk

The incident class can reappear if startup/profile scope timing causes stale replay ordering.

Watch for:
- `groups.membership_recovery_hydrate`
- `messaging.chat_state_groups_update`
- `account_sync.backup_restore_merge_diagnostics`

## Closure Criteria

1. New-device login deterministically restores joined groups.
2. Group list does not drop from non-empty to empty unless explicit leave/tombstone evidence exists.
3. Two-device integration coverage remains green in group membership lanes.
