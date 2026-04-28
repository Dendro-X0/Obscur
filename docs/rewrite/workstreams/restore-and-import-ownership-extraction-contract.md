# Restore and Import Ownership Extraction Contract

_Last reviewed: 2026-04-22 (baseline commit a3f16b10)._

Status: active rewrite workstream

## Purpose

This workstream defines how to extract restore and import ownership from the
current overlapping account-sync and messaging recovery paths into one explicit
owner model.

It exists because restore currently overlaps across:

1. encrypted backup parsing,
2. compatibility chat-state restore,
3. canonical event append,
4. projection read authority,
5. persisted and indexed fallback paths.

The goal is to preserve complete product behavior while making restore truth
singular and durable.

## Current Owner Set

Current primary owners and participants:

1. `apps/pwa/app/features/account-sync/services/encrypted-account-backup-service.ts`
2. `apps/pwa/app/features/account-sync/services/account-sync-migration-policy.ts`
3. `apps/pwa/app/features/account-sync/services/account-projection-read-authority.ts`
4. `apps/pwa/app/features/messaging/providers/messaging-provider.tsx`
5. `apps/pwa/app/features/messaging/hooks/use-conversation-messages.ts`
6. `apps/pwa/app/features/messaging/services/chat-state-store.ts`
7. `apps/pwa/app/features/messaging/services/message-persistence-service.ts`

Supporting modules:

1. `apps/pwa/app/features/account-sync/services/account-projection-selectors.ts`
2. `apps/pwa/app/features/messaging/services/conversation-list-authority.ts`
3. `apps/pwa/app/features/messaging/services/conversation-history-authority.ts`
4. `apps/pwa/app/features/groups/providers/group-provider.tsx`

## Current Failure Classes

This workstream is responsible for eliminating:

1. partial DM history restore,
2. conversation list and timeline disagreement after restore,
3. restore states that thin later during hydration or projection cutover,
4. compatibility bridges that survive too long without explicit diagnostics,
5. community restore paths that still depend on weaker fallback assembly.

## Current Runtime Blocker

The currently documented runtime blocker is:

1. fresh-device or cross-device login can still restore one-sided DM history,
2. the restored sidebar/timeline may show only peer-authored history or only
   self-authored history for the affected thread,
3. fixes at the timeline-authority layer alone are insufficient when the
   fetched encrypted relay backup payload is already incomplete,
4. the restore path is still too backup-bound and does not guarantee a
   restore-time historical DM backfill before the thread becomes user-visible.

What is currently landed but not yet runtime-verified:

1. backup payload hydration now corrects both outgoing-only and incoming-only
   indexed restore skew through canonical account-event projection fallback,
2. conversation history authority now has explicit thin-window restore reasons
   for missing incoming and missing outgoing history,
3. the remaining unknown is whether real relay backup contents and startup
   replay order actually allow those fixes to change fresh-device UX.

This blocker should remain explicit until runtime replay proves:

1. restored DM threads contain both self-authored and peer-authored history for
   the affected conversation,
2. list and timeline agree during restore,
3. later projection/indexed catch-up does not thin the restored thread again.

## Future Owner Set

The future architecture should converge on one restore/import owner stack:

1. `backup import contract`
2. `restore materialization coordinator`
3. `projection hydration pipeline`
4. `compatibility bridge registry`
5. `restore diagnostics surface`

The key property is singularity:

1. one owner parses restore input,
2. one owner materializes durable state,
3. projection becomes the canonical read model after explicit parity checks,
4. compatibility bridges are named and temporary.

## Required Future Contracts

This workstream should ultimately produce:

1. `restore-import-contracts`
2. `projection-materialization-contracts`
3. `compatibility-bridge-contracts`
4. `restore-read-authority-contracts`

Minimum contract fields should cover:

1. restore source,
2. migration phase,
3. selected owner,
4. compatibility domains still enabled,
5. projection readiness,
6. drift counts,
7. post-restore parity state.

## Extraction Sequence

### Phase 1. Import Contract Lock

Lock the restore phases and import inputs into one typed contract.

Outputs:

1. contract doc,
2. typed import payload decisions,
3. explicit restore source semantics,
4. explicit compatibility domain flags.

### Phase 2. Materialization Split

Separate restore parsing from durable materialization.

Outputs:

1. backup parsing module,
2. materialization module,
3. projection hydration module,
4. compatibility application module.

### Phase 3. Read Authority Convergence

Align conversation list and timeline owners so they make the same restore
parity decision from the same evidence.

Outputs:

1. one richer-than-projection policy,
2. one projection cutover rule,
3. one restore parity diagnostic packet.

### Phase 4. Compatibility Retirement

Retire direct compatibility domains only when projection parity is proven in
runtime.

Outputs:

1. bridge retirement checklist,
2. retired bridge registry,
3. regression probes proving no restore thinning.

## Compatibility Retirement Sequence

Retire in this order:

1. redundant list/timeline fallback disagreement,
2. unscoped chat-state compatibility writes,
3. projection read cutover assumptions that outrun runtime truth,
4. any remaining restore bridge not covered by explicit diagnostics.

Do not retire compatibility until:

1. fresh-device DM history replay is stable,
2. conversation list and timeline agree,
3. community restore no longer depends on page-level fallback assembly.

## Test Ladder

Minimum test set:

1. unit tests for restore-owner selection,
2. unit tests for read-authority parity,
3. integration tests for backup restore materialization,
4. integration tests for messaging provider hydration scope,
5. cross-device restore replay.

Current tests to preserve and extend:

1. `apps/pwa/app/features/account-sync/services/encrypted-account-backup-service.test.ts`
2. `apps/pwa/app/features/messaging/providers/messaging-provider.hydration-scope.test.tsx`
3. `apps/pwa/app/features/messaging/hooks/use-conversation-messages.integration.test.ts`

## Minimum Runtime Acceptance Packet

This workstream is only complete when runtime replay proves:

1. fresh restore keeps full DM timeline,
2. sidebar/list and timeline agree on restored conversations,
3. post-restore hydration does not thin the state later,
4. projection cutover only happens after parity is good enough,
5. community restore remains intact while DM restore is stabilized.

Primary evidence probes:

1. `window.obscurAppEvents.findByName("account_sync.backup_restore_owner_selection", 30)`
2. `window.obscurAppEvents.findByName("messaging.conversation_list_authority_selected", 30)`
3. `window.obscurAppEvents.findByName("messaging.conversation_history_authority_selected", 30)`
4. `window.obscurAppEvents.getCrossDeviceSyncDigest(400).summary.selfAuthoredDmContinuity`

## Definition Of Done

This workstream is done only when:

1. restore/import has one owner,
2. compatibility bridges are explicitly listed,
3. list and timeline authority agree,
4. runtime restore parity is verified,
5. future threads can continue from docs alone.
