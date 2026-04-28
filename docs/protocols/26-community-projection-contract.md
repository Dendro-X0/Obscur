# 26 Community Projection Contract

_Last reviewed: 2026-04-19 (baseline commit a3f16b10)._

Status: design and implementation contract

This document formalizes the canonical projection model for Obscur
communities.

It should be read together with:

1. `docs/protocols/25-community-ledger-and-projection-architecture-spec.md`
2. `docs/10-community-and-groups-overhaul.md`
3. `docs/16-cross-device-group-visibility-incident.md`
4. `docs/releases/core-verification-communities-and-membership-integrity.md`

## Purpose

The community system needs one explicit projection contract so that:

1. UI reads come from one canonical structure,
2. reducers and replay behavior are explainable,
3. restore/recovery does not depend on provider-local assembly,
4. future room/governance/media work has a stable read model,
5. local-only UI state stays separated from canonical community truth.

Without this contract, community state will continue to drift across:

1. membership ledger,
2. tombstones,
3. persisted group/chat fallback,
4. room-key state,
5. local provider state,
6. navigation/UI affordances.

## Canonical Role

The community projection is the single read authority for:

1. community visibility,
2. membership state,
3. roster state,
4. governance outcome state,
5. room-key sendability state,
6. community content timeline state,
7. community media ownership state.

The projection is not:

1. a transport protocol,
2. a cache blob format,
3. a UI component state bag,
4. a local-only preference store.

## Canonical Owners

Projection write/compute owner chain:

1. community event ingest/runtime owner
   - `apps/pwa/app/features/groups/hooks/use-sealed-community.ts`
2. membership/governance reducer owner
   - `apps/pwa/app/features/groups/services/community-ledger-reducer.ts`
3. group lifecycle/persistence owner
   - `apps/pwa/app/features/groups/providers/group-provider.tsx`
4. room-key durability owner
   - `apps/pwa/app/features/crypto/room-key-store.ts`
5. backup/import bridge owner
   - `apps/pwa/app/features/account-sync/services/encrypted-account-backup-service.ts`

Hard rule:
1. no second owner may directly invent projection truth outside the reducer /
   canonical recovery chain.

## Projection Inputs

The projection may be built only from explicit inputs:

1. community descriptor events,
2. membership control events,
3. governance events,
4. room-key lifecycle evidence,
5. community content events,
6. community media descriptor events,
7. tombstones / terminal-state evidence,
8. bounded persisted fallback input when canonical evidence is incomplete.

Inputs that are never projection truth by themselves:

1. local optimistic UI flags,
2. generic provider component state,
3. hidden/pinned local preferences,
4. stale persisted group rows without higher-order evidence,
5. timeout-only convergence markers.

## Projection Shape

The canonical community projection should contain at least the following
top-level collections.

### 1. `communitiesById`

Purpose:
1. canonical descriptor and lifecycle state for each visible or historically
   known community.

Minimum fields per community:
1. `communityId`
2. `groupId`
3. `conversationId`
4. `relayScope`
5. `displayName`
6. `about`
7. `avatarUrl`
8. `lifecycleState`
   - `active`
   - `left`
   - `expelled`
   - `disbanded`
   - `tombstoned`
9. `visibilityState`
   - `visible`
   - `recovering`
   - `hidden_by_terminal_state`
10. `lastDescriptorEventId`
11. `lastDescriptorAtUnixMs`

### 2. `membershipByCommunityId`

Purpose:
1. canonical membership truth for the active account.

Minimum fields:
1. `communityId`
2. `status`
   - `joined`
   - `invited`
   - `pending`
   - `left`
   - `expelled`
   - `unknown`
3. `sourceOfTruth`
   - `tombstone`
   - `ledger`
   - `reducer_replay`
   - `persisted_fallback`
4. `joinedAtUnixMs`
5. `leftAtUnixMs`
6. `expelledAtUnixMs`
7. `lastMembershipEventId`
8. `lastMembershipEvidenceAtUnixMs`

### 3. `membersByCommunityId`

Purpose:
1. canonical roster view and member evidence summaries.

Minimum fields:
1. `communityId`
2. `members`
   - list of:
     - `memberPublicKeyHex`
     - `status`
     - `lastEvidenceAtUnixMs`
     - `lastEventId`
3. `rosterVersion`
4. `lastRosterEvidenceAtUnixMs`

### 4. `governanceByCommunityId`

Purpose:
1. governance outcomes and policy-sensitive state.

Minimum fields:
1. `communityId`
2. `activeVotes`
3. `resolvedVotes`
4. `policyState`
5. `moderationState`
6. `lastGovernanceEventId`
7. `lastGovernanceAtUnixMs`

### 5. `roomKeyStateByCommunityId`

Purpose:
1. sendability and content-decrypt readiness.

Minimum fields:
1. `communityId`
2. `keyEpoch`
3. `state`
   - `missing`
   - `pending_distribution`
   - `active`
   - `superseded`
   - `revoked`
4. `rotationReason`
5. `sendability`
   - `sendable`
   - `blocked`
6. `sendBlockReasonCode`
7. `activatedAtUnixMs`
8. `supersededAtUnixMs`

### 6. `contentTimelineByCommunityId`

Purpose:
1. ordered content state for community rendering.

Minimum fields per timeline item:
1. `logicalMessageId`
2. `communityId`
3. `keyEpoch`
4. `contentState`
   - `visible`
   - `pending_key`
   - `quarantined`
   - `deleted`
5. `plaintextPreview`
6. `senderPublicKeyHex`
7. `createdAtUnixMs`
8. `lastObservedAtUnixMs`
9. `sourceEventId`
10. `attachmentDescriptorIds`

### 7. `mediaByCommunityId`

Purpose:
1. community-scoped media ownership derived from canonical content truth.

Minimum fields:
1. `mediaDescriptorId`
2. `communityId`
3. `sourceLogicalMessageId`
4. `storageUrl`
5. `encryptedMetadataState`
6. `localCacheState`
7. `contentAvailabilityState`

### 8. `removedCommunityIds`

Purpose:
1. prevent resurrection through stale replay/fallback.

Minimum fields:
1. `communityId`
2. `removedAtUnixMs`
3. `reasonCode`

## Projection Invariants

The following invariants are mandatory.

### Visibility Invariants

1. A community is visible only if the projection says it is visible or
   recovering.
2. A community must not disappear from the visible list unless explicit
   terminal evidence exists or the projection reclassifies it deterministically.
3. Persisted fallback may seed visibility only when stronger evidence is absent
   and must be overtaken once ledger/reducer evidence arrives.

### Membership Invariants

1. Membership truth is reducer-driven.
2. Explicit `left`, `expelled`, or tombstoned evidence suppresses weaker
   fallback visibility.
3. Membership truth and room-key truth are separate outputs.

### Sendability Invariants

1. Joined membership alone is insufficient for sendability.
2. Sendability requires:
   - joined membership,
   - active community descriptor,
   - active room-key state.
3. UI must never infer sendability from chat presence alone.

### Content Invariants

1. Content timeline entries must bind to community id and key epoch.
2. Missing keys must yield explicit `pending_key` or `quarantined` states,
   never silent blanking.
3. Content replay must not redefine membership truth.

### Media Invariants

1. Media ownership derives from canonical content entries.
2. Vault/community media visibility must not fabricate joined membership.
3. Restored media may appear only if source message/community truth remains
   valid.

### Removal Invariants

1. Removed/disbanded/tombstoned communities must not resurrect through stale
   persisted rows.
2. Removed content/media must not reappear through weaker replay paths.

## Projection Authority Contract

Community UI should follow a single authority rule:

1. projection is the canonical read authority,
2. provider state may cache projection output for render efficiency,
3. local-only preferences may filter or decorate projection output,
4. no component should merge arbitrary persisted fallback directly into visible
   community state once projection is available.

## Fallback Contract

Persisted fallback is allowed only as bounded recovery input.

Allowed uses:
1. bootstraping a community row before ledger/replay catches up,
2. reconstructing community identity when canonical replay is temporarily
   unavailable,
3. recovering historical content/media references as import inputs.

Disallowed uses:
1. long-lived visible truth that outranks membership ledger,
2. inventing joined membership after explicit leave/expel,
3. inventing sendability,
4. inventing roster truth,
5. resurrecting removed communities.

## Local-Only UI State Contract

The following remain local-only:

1. pinned communities,
2. hidden/muted communities,
3. last selected/opened community,
4. drafts,
5. local sort/filter preferences.

Rules:
1. they are scoped by active account/profile,
2. they are sanitized against canonical projection ids,
3. they must never delete, create, or redefine canonical community truth.

## Recovery and Restore Contract

Restore should target projection truth, not direct provider truth.

Therefore:

1. restore/import should feed canonical community events where feasible,
2. direct write compatibility bridges must be temporary and explicit,
3. if direct restore remains for some domains, those domains must be named and
   justified,
4. community projection must make recovery source visible in diagnostics.

Temporary staging rule:
1. keep direct restore longer for community/group domains that do not yet have
   a clean canonical import path,
2. do not extend that direct path back into DM truth lanes,
3. retire direct restore domain-by-domain as projection coverage improves.

## Diagnostics Contract

Projection-building code must emit enough diagnostics to answer:

1. why a community is visible,
2. why it is not sendable,
3. whether roster state came from ledger or fallback,
4. whether content is blocked on key state,
5. whether a removed community was suppressed correctly,
6. whether scope mismatch is present.

Recommended event families:

1. `groups.membership_recovery_hydrate`
2. `groups.projection_update`
3. `groups.projection_sendability_changed`
4. `groups.room_key_missing_send_blocked`
5. `groups.projection_scope_mismatch`
6. `groups.content_quarantined_pending_key`

## Implementation Direction

The next implementation order should be:

1. define shared typed projection shapes and selector inputs,
2. define community control event family inputs,
3. define projection reducer behavior and precedence,
4. move provider reads to projection-first authority,
5. convert remaining direct restore domains to import-driven feeds where safe.

Suggested shared package location:

1. `packages/dweb-core`

Suggested initial TS modules:

1. `community-projection-contracts.ts`
2. `community-control-event-contracts.ts`
3. `community-sendability-contracts.ts`

## Validation Expectations

Future tests should prove:

1. a joined community does not disappear on a fresh device without explicit
   non-joined evidence,
2. explicit leave/tombstone suppresses persisted fallback visibility,
3. sendability blocks when room keys are missing even if visibility is joined,
4. provider/UI never shows a community not present in canonical projection once
   projection is ready,
5. local-only pinned/hidden state cannot resurrect stale community ids,
6. community media visibility follows canonical content ownership.
