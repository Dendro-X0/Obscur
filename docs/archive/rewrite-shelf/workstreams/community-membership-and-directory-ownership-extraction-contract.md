# Community Membership and Directory Ownership Extraction Contract

_Last reviewed: 2026-04-22 (baseline commit a3f16b10)._

Status: active rewrite workstream

## Purpose

This workstream defines how to extract community participant visibility,
membership, and directory truth from the current overlapping community stack
into one explicit read-model owner.

It exists because community membership has historically drifted across:

1. relay roster events,
2. local membership ledger state,
3. DM invite/accept evidence,
4. persisted group rows,
5. provider-owned participant directories,
6. page-local participant visibility logic.

The goal is to preserve all community features while making participant
visibility deterministic and durable.

## Current Owner Set

Current primary owners and participants:

1. `apps/pwa/app/features/groups/providers/group-provider.tsx`
2. `apps/pwa/app/features/groups/hooks/use-sealed-community.ts`
3. `apps/pwa/app/features/groups/services/community-membership-recovery.ts`
4. `apps/pwa/app/features/groups/services/community-member-roster-projection.ts`
5. `apps/pwa/app/features/groups/services/community-known-participant-directory.ts`
6. `apps/pwa/app/groups/[...id]/group-home-page-client.tsx`
7. `apps/pwa/app/features/groups/components/group-management-dialog.tsx`

Supporting modules:

1. `apps/pwa/app/features/groups/services/community-membership-ledger.ts`
2. `apps/pwa/app/features/groups/services/community-visible-members.ts`
3. `apps/pwa/app/features/groups/services/group-service.ts`
4. `apps/pwa/app/features/crypto/room-key-store.ts`
5. `apps/pwa/app/features/groups/services/group-tombstone-store.ts`

## Current Failure Classes

This workstream is responsible for eliminating:

1. participant lists collapsing to one visible member,
2. page and modal/dialog community surfaces disagreeing,
3. relay roster omission being mistaken for leave evidence,
4. participant directories being thinner after navigation or reload,
5. room-key and joined membership drifting apart in user-visible ways.

## Future Owner Set

The future architecture should converge on one community membership and
directory owner stack:

1. `community-membership read owner`
2. `participant-directory read owner`
3. `community-sendability owner`
4. `community-governance visibility owner`
5. `projection-to-ui adapter`

The key property is singularity:

1. participant lists must read from one projection-backed authority,
2. weaker evidence may seed but not overrule stronger evidence,
3. explicit leave/expel/tombstone evidence is the only removal truth.

## Required Future Contracts

This workstream should ultimately produce:

1. `community-membership-read-model-contracts`
2. `participant-directory-contracts`
3. `community-sendability-contracts`
4. `community-governance-visibility-contracts`
5. `community-recovery-precedence-contracts`

Minimum contract fields should cover:

1. community id,
2. group id,
3. relay scope,
4. joined membership status,
5. participant roster entries,
6. evidence timestamps,
7. source-of-truth labels,
8. sendability and send-block reason.

## Extraction Sequence

### Phase 1. Contract Lock

Lock the participant and membership read-model shape into one contract.

Outputs:

1. participant directory contract,
2. roster precedence contract,
3. source-of-truth reason codes,
4. page/modal parity diagnostics shape.

### Phase 2. Membership Evidence Consolidation

Converge relay roster, invite evidence, persisted rows, and known-participant
inputs into one evidence reducer or projection path.

Outputs:

1. explicit evidence import contract,
2. additive roster seed rules,
3. explicit removal-only evidence rules,
4. stable participant continuity contract.

### Phase 3. Directory and Sendability Unification

Move page surfaces and management surfaces onto the same participant and
sendability adapters.

Outputs:

1. one page participant authority,
2. one management-dialog participant authority,
3. one sendability visibility contract,
4. room-key and membership parity diagnostics.

### Phase 4. Compatibility Retirement

Retire local directory heuristics and page-level merge logic only after runtime
replay proves participant visibility is stable.

Outputs:

1. bridge retirement checklist,
2. retained-compatibility registry,
3. replay proof that participant collapse no longer occurs.

## Compatibility Retirement Sequence

Retire in this order:

1. page-specific participant merge heuristics,
2. directory recomputation paths that bypass the shared projection,
3. relay-roster omission handling that still acts like removal,
4. any remaining UI continuity caches once projection truth is stable enough.

Do not retire compatibility until:

1. participant list survives reload and navigation,
2. page and dialog surfaces agree,
3. explicit leave/expel still removes members deterministically.

## Test Ladder

Minimum test set:

1. unit tests for roster projection precedence,
2. unit tests for participant visibility filtering,
3. provider integration tests for recovery and snapshot application,
4. hook integration tests for live community ingest,
5. two-user community replay.

Current tests to preserve and extend:

1. `apps/pwa/app/features/groups/services/community-member-roster-projection.test.ts`
2. `apps/pwa/app/features/groups/services/community-visible-members.test.ts`
3. `apps/pwa/app/features/groups/providers/group-provider.test.tsx`
4. `apps/pwa/app/features/groups/hooks/use-sealed-community.integration.test.ts`

## Minimum Runtime Acceptance Packet

This workstream is only complete when runtime replay proves:

1. participant list does not collapse after initial visibility,
2. page and management dialog show the same participants,
3. relay roster omission without explicit removal evidence does not demote the list,
4. explicit leave/expel still removes participants correctly,
5. room-key/sendability state does not mislead users about membership truth.

Primary evidence probes:

1. `window.obscurAppEvents.findByName("groups.membership_recovery_hydrate", 30)`
2. `window.obscurAppEvents.findByName("groups.membership_roster_seed_result", 30)`
3. `window.obscurAppEvents.findByName("groups.page.participant_projection_state", 30)`
4. `window.obscurAppEvents.getCrossDeviceSyncDigest(400).summary.membershipSendability`

## Definition Of Done

This workstream is done only when:

1. participant visibility reads from one projection-backed owner,
2. relay omission is never treated as removal evidence,
3. page and dialog surfaces remain aligned,
4. participant continuity is runtime-verified,
5. future threads can continue from docs alone.
