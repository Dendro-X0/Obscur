# 27 Community Control and Governance Event Family

_Last reviewed: 2026-04-19 (baseline commit a3f16b10)._

Status: design and implementation contract

This document defines the canonical control-plane event family for Obscur
communities.

It should be read together with:

1. `docs/protocols/25-community-ledger-and-projection-architecture-spec.md`
2. `docs/protocols/26-community-projection-contract.md`
3. `docs/protocols/23-private-direct-envelope-and-community-room-key-contract.md`
4. `docs/10-community-and-groups-overhaul.md`

## Purpose

The community system needs one explicit write/input contract for:

1. descriptor changes,
2. membership transitions,
3. governance and moderation decisions,
4. room-key lifecycle control signals,
5. terminal lifecycle actions like leave/disband.

Without this contract, community behavior will continue to drift across:

1. UI-local intent,
2. relay-visible tags,
3. sealed payload semantics,
4. backup restore heuristics,
5. membership ledger durability,
6. projection reducer assumptions.

## Scope

This contract covers control-plane and governance-plane community events only.

It does not cover:

1. encrypted community content timeline messages,
2. media descriptor payloads,
3. local-only UI preferences,
4. direct 1:1 DM envelopes except where private direct envelopes distribute
   room keys.

## Canonical Owners

Write-side/control-side owner chain:

1. community event construction/signing owner
   - `apps/pwa/app/features/groups/services/group-service.ts`
2. community event ingest/runtime owner
   - `apps/pwa/app/features/groups/hooks/use-sealed-community.ts`
3. membership/governance reducer owner
   - `apps/pwa/app/features/groups/services/community-ledger-reducer.ts`
4. membership ledger durability owner
   - `apps/pwa/app/features/groups/services/community-membership-ledger.ts`
5. backup/import bridge owner
   - `apps/pwa/app/features/account-sync/services/encrypted-account-backup-service.ts`

Hard rule:
1. no second owner may invent canonical control event semantics outside this
   chain.

## Control Event Families

Community control events should be standardized into the following families.

### A. Descriptor Events

Purpose:
1. create a community,
2. update metadata,
3. apply descriptor-sensitive policy changes.

Canonical types:
1. `COMMUNITY_CREATED`
2. `COMMUNITY_DESCRIPTOR_UPDATED`

Required fields:
1. `communityId`
2. `groupId`
3. `relayScope`
4. `actorPublicKeyHex`
5. `logicalEventId`
6. `createdAtUnixMs`
7. `descriptorVersion`
8. `metadata`

Reducer effects:
1. create/update `communitiesById`,
2. advance descriptor timestamps,
3. preserve stable canonical identity.

### B. Membership Events

Purpose:
1. invite members,
2. accept membership,
3. leave,
4. expel/remove,
5. reconstruct member roster truth.

Canonical types:
1. `COMMUNITY_MEMBER_INVITED`
2. `COMMUNITY_MEMBER_JOINED`
3. `COMMUNITY_MEMBER_LEFT`
4. `COMMUNITY_MEMBER_EXPELLED`
5. `COMMUNITY_MEMBERSHIP_RESTATED`

Required fields:
1. `communityId`
2. `groupId`
3. `relayScope`
4. `actorPublicKeyHex`
5. `subjectPublicKeyHex`
6. `logicalEventId`
7. `createdAtUnixMs`
8. `membershipVersion`

Additional rules:
1. `COMMUNITY_MEMBER_INVITED`
   - may carry private distribution references, but is not itself proof of join
2. `COMMUNITY_MEMBER_JOINED`
   - must be the canonical joined-state input
3. `COMMUNITY_MEMBER_LEFT`
   - must not implicitly disband a community
4. `COMMUNITY_MEMBER_EXPELLED`
   - is terminal for the member until later explicit rejoin policy allows
5. `COMMUNITY_MEMBERSHIP_RESTATED`
   - is for roster convergence and replay correction, not optimistic overwrite

Reducer effects:
1. update `membershipByCommunityId`,
2. update `membersByCommunityId`,
3. drive sendability prerequisites together with room-key state.

### C. Governance Events

Purpose:
1. represent proposals and votes,
2. reach explicit governance outcomes,
3. handle moderation/governance transitions in a reducer-safe way.

Canonical types:
1. `COMMUNITY_GOVERNANCE_PROPOSED`
2. `COMMUNITY_GOVERNANCE_VOTE_CAST`
3. `COMMUNITY_GOVERNANCE_RESOLVED`

Required fields:
1. `communityId`
2. `groupId`
3. `relayScope`
4. `actorPublicKeyHex`
5. `logicalEventId`
6. `createdAtUnixMs`
7. `governanceProposalId`
8. `governanceActionType`

`COMMUNITY_GOVERNANCE_PROPOSED` additional fields:
1. `targetPublicKeyHex` or `targetMetadataField` or other action target
2. `quorumThreshold`
3. `proposalExpiresAtUnixMs`

`COMMUNITY_GOVERNANCE_VOTE_CAST` additional fields:
1. `vote`
   - `approve`
   - `reject`
   - `abstain`
2. `voterPublicKeyHex`

`COMMUNITY_GOVERNANCE_RESOLVED` additional fields:
1. `resolution`
   - `accepted`
   - `rejected`
   - `expired`
2. `appliedEffects`

Reducer effects:
1. update `governanceByCommunityId`,
2. apply accepted governance outcomes to membership/descriptor state only when
   explicit resolution evidence exists.

### D. Room-Key Lifecycle Events

Purpose:
1. represent room-key epoch changes,
2. bind room-key state to membership/governance outcomes,
3. drive sendability and decryptability state.

Canonical types:
1. `COMMUNITY_ROOM_KEY_ROTATION_REQUESTED`
2. `COMMUNITY_ROOM_KEY_ROTATION_ACTIVATED`
3. `COMMUNITY_ROOM_KEY_SUPERSEDED`

Required fields:
1. `communityId`
2. `groupId`
3. `keyEpoch`
4. `logicalEventId`
5. `createdAtUnixMs`
6. `rotationReason`

Rules:
1. room-key distribution to members remains private-direct-envelope work,
   but projection/reducer still needs these lifecycle control signals,
2. room-key events must not silently redefine membership truth.

Reducer effects:
1. update `roomKeyStateByCommunityId`,
2. update send-block reason state.

### E. Terminal Lifecycle Events

Purpose:
1. represent community disband/tombstone/terminal visibility changes.

Canonical types:
1. `COMMUNITY_DISBANDED`
2. `COMMUNITY_TOMBSTONED`

Required fields:
1. `communityId`
2. `groupId`
3. `logicalEventId`
4. `createdAtUnixMs`
5. `reasonCode`

Reducer effects:
1. mark projection terminal state,
2. suppress weaker fallback resurrection,
3. close sendability/content visibility as appropriate.

## Transport-Visible vs Encrypted Control Semantics

Community control events may involve both public-ish and private semantics.

Transport-visible control fields may include only what is necessary for:

1. routing,
2. relay scope,
3. replay ordering,
4. signature and ownership verification,
5. event family discrimination.

Encrypted/private fields must hold:

1. wrapped room-key payloads,
2. privacy-sensitive governance reasoning,
3. private invite details,
4. moderation content that should not be relay-visible,
5. target-specific private membership/bootstrap material.

Rule:
1. relay-visible fields are never authoritative by themselves when an encrypted
   private control payload is the semantic source of truth.

## Required Event Identity Fields

Every canonical community control event should expose:

1. `logicalEventId`
2. `communityId`
3. `groupId`
4. `relayScope`
5. `createdAtUnixMs`
6. `actorPublicKeyHex`
7. `eventFamily`
8. `eventType`
9. `idempotencyKey`
10. `source`
    - `relay_live`
    - `relay_sync`
    - `backup_import`
    - `legacy_bridge`

## Required Validation Rules

An incoming control/governance event must be rejected or quarantined if:

1. canonical identity fields are missing,
2. event family/type is unknown,
3. signature or ownership checks fail,
4. community/group binding is inconsistent,
5. room-key lifecycle event lacks epoch,
6. governance resolution arrives without proposal identity,
7. membership event lacks subject identity where required,
8. terminal-state event conflicts with impossible identity scope.

Required diagnostics on rejection:

1. event family,
2. event type,
3. communityId/groupId,
4. relay scope,
5. validation reason,
6. final reducer/apply decision.

## Reducer Rules

Reducer behavior must follow these rules.

### Descriptor Rules

1. newer descriptor evidence wins by explicit ordering rules,
2. hashed/canonical community identity must not downgrade to weaker identity,
3. descriptor updates must not implicitly change membership.

### Membership Rules

1. tombstone/terminal evidence outranks weaker join fallback,
2. explicit `left` / `expelled` suppress weaker persisted visibility,
3. joined evidence must be explicit or canonically reconstructable,
4. roster restatement must not invent member presence without a valid family.

### Governance Rules

1. proposals do not apply effects by themselves,
2. votes do not apply effects by themselves,
3. only explicit accepted resolution updates policy-sensitive projection truth,
4. expired/rejected proposals remain auditable but non-effective.

### Room-Key Rules

1. room-key state may block sendability even when membership is joined,
2. room-key activation does not imply joined membership by itself,
3. superseded key state must not remain sendable for new content.

### Terminal-State Rules

1. disband/tombstone are terminal for visibility unless explicit revive policy
   exists,
2. later weaker membership or descriptor replay must not resurrect terminal
   communities.

## Relationship to Projection Contract

These event families are the canonical write-side inputs that feed the
projection defined in:

1. `docs/protocols/26-community-projection-contract.md`

Mapping summary:

1. descriptor events -> `communitiesById`
2. membership events -> `membershipByCommunityId`, `membersByCommunityId`
3. governance events -> `governanceByCommunityId`
4. room-key lifecycle events -> `roomKeyStateByCommunityId`
5. terminal lifecycle events -> `removedCommunityIds`, terminal community state

## Restore and Import Staging Rule

During the current staged migration:

1. community/group restore may remain direct longer than DM restore where a
   clean canonical import path is not ready,
2. but any new community restore work should prefer canonical control event
   import over new direct provider truth writes,
3. direct restore compatibility bridges must not expand without an explicit
   written reason.

## Recommended Shared TS Modules

Suggested shared contract modules under `packages/dweb-core`:

1. `community-control-event-contracts.ts`
2. `community-governance-event-contracts.ts`
3. `community-room-key-lifecycle-contracts.ts`
4. `community-event-validation-contracts.ts`

## Validation Expectations

Future tests should prove:

1. joined membership is never inferred from optimistic UI alone,
2. leave does not implicitly disband a community,
3. governance outcomes apply only after explicit resolution events,
4. room-key lifecycle events block sendability correctly,
5. terminal community states suppress weaker replay resurrection,
6. backup import and relay replay produce the same reducer result for the same
   event family set.
