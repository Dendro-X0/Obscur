# 25 Community Ledger and Projection Architecture Spec

_Last reviewed: 2026-04-18 (baseline commit a3f16b10)._

Status: architecture target and implementation guide

This document defines the community-system architecture Obscur should move
toward if the goal is:

1. easier maintenance,
2. clearer ownership,
3. deterministic cross-device recovery,
4. stronger privacy and governance semantics,
5. scalable future growth for rooms, moderation, media, and governance.

This is not a claim that the full architecture is already implemented.

## Purpose

The current community system already has basic functionality, but future growth
will become fragile unless communities are explicitly split into:

1. canonical event inputs,
2. deterministic projections,
3. encrypted content/key planes,
4. local-only UI state,
5. cache layers that never compete as truth.

The main goal is to avoid repeating the same architectural failure class that
appeared in DM/account-sync:

1. multiple overlapping owners,
2. fallback-heavy state assembly,
3. local cache being mistaken for canonical truth.

## Design Goals

The community system should support:

1. deterministic create / invite / join / leave / recover behavior,
2. one canonical reducer-driven membership truth,
3. one canonical projection consumed by UI,
4. encrypted community content with explicit room-key epochs,
5. scalable addition of:
   - roles or governance extensions,
   - moderation events,
   - room/thread structure,
   - media/file delivery,
   - multi-device restore,
6. local-only UX preferences without redefining global community truth.

## Non-Goals

This architecture should not:

1. let optimistic UI state define membership or governance truth,
2. let room-key possession redefine membership truth,
3. let persisted chat/group blobs act as long-term canonical truth,
4. let community navigation or sendability depend on hidden side effects,
5. mix governance, membership, content, and local preferences in one owner path.

## Canonical Owners

Current/future owner chain should stay explicit:

1. community lifecycle and local persistence owner
   - `apps/pwa/app/features/groups/providers/group-provider.tsx`
2. community event ingest/runtime owner
   - `apps/pwa/app/features/groups/hooks/use-sealed-community.ts`
3. membership and governance reducer owner
   - `apps/pwa/app/features/groups/services/community-ledger-reducer.ts`
4. community event construction/signing owner
   - `apps/pwa/app/features/groups/services/group-service.ts`
5. membership ledger durability owner
   - `apps/pwa/app/features/groups/services/community-membership-ledger.ts`
6. tombstone suppression owner
   - `apps/pwa/app/features/groups/services/group-tombstone-store.ts`
7. room-key durability owner
   - `apps/pwa/app/features/crypto/room-key-store.ts`
8. backup/import bridge owner
   - `apps/pwa/app/features/account-sync/services/encrypted-account-backup-service.ts`

Hard rule:
1. no second mutation owner may be introduced for community lifecycle,
   membership truth, or room-key truth.

## Community Planes

Communities should be split into explicit planes.

### 1. Community Identity Plane

Owns:
1. `communityId`
2. `groupId`
3. relay scope
4. canonical name/avatar/description metadata
5. policy/version references

Rules:
1. identity is explicit and stable,
2. hashed/canonical identity must survive replay and restore,
3. metadata changes are reducer-consumed signed events, not local overrides.

### 2. Membership and Governance Plane

Owns:
1. joined/left/expelled state
2. invite acceptance state
3. member roster truth
4. governance votes and outcomes
5. moderation state that changes global community truth

Rules:
1. membership truth is reducer-driven,
2. explicit leave/expel/tombstone evidence outranks local fallback,
3. governance outcomes are signed-event results, never UI-local assertions,
4. member mute/hide remains local-only and must not redefine global truth.

### 3. Room-Key Plane

Owns:
1. active room-key epoch
2. pending distribution state
3. superseded/revoked key state
4. send-block reasons when key state is missing or stale

Rules:
1. membership truth and room-key truth are separate,
2. sendability requires both joined membership and active room-key availability,
3. only one active room key exists per community epoch,
4. room-key distribution happens through private direct envelopes, not public
   visible control fields.

### 4. Community Content Plane

Owns:
1. encrypted community messages
2. encrypted announcements
3. room-scoped or community-scoped content
4. moderation content when content privacy matters

Rules:
1. content uses room-key lineage explicitly,
2. content replay never invents membership truth,
3. content visibility may lag behind membership visibility if keys have not
   converged yet,
4. UI must degrade explicitly when content is unavailable due to key state.

### 5. Community Media Plane

Owns:
1. community attachment descriptors
2. encrypted file references
3. source-community ownership
4. local cache/Vault indexing for community-origin media

Rules:
1. media ownership derives from canonical message/community truth,
2. file storage hosts are not community truth owners,
3. media restore must not fabricate membership or room-key state,
4. Vault is a local aggregated surface, not authoritative community state.

### 6. Local UI Preference Plane

Owns only:
1. mute/hide preferences
2. pinned communities
3. last opened community
4. drafts and ephemeral compose state
5. local-only sort/filter affordances

Rules:
1. these preferences are scoped to the active account/profile,
2. these preferences must never redefine joined membership,
3. these preferences must be sanitized against canonical projection ids,
4. they remain local-only and are not sync truth by default.

## Canonical Event Families

The community system should converge on a small set of explicit event families.

### A. Community Descriptor Event

Carries:
1. community identity metadata,
2. avatar/name/description updates,
3. metadata versioning.

Reducer output:
1. canonical community descriptor state.

### B. Membership Control Event

Carries:
1. invite,
2. join,
3. leave,
4. expel/remove,
5. roster evidence,
6. membership tombstone references.

Reducer output:
1. canonical membership status by member,
2. visible member roster,
3. membership sendability status.

### C. Governance Event

Carries:
1. governance proposals,
2. votes,
3. quorum outcomes,
4. policy-sensitive state changes.

Reducer output:
1. governance state,
2. accepted/rejected policy outcomes,
3. auditable moderation/governance truth.

### D. Room-Key Lifecycle Event

Carries:
1. key epoch,
2. rotation notice,
3. activation/supersession metadata,
4. wrapped key references where appropriate.

Reducer output:
1. room-key state machine and send-block state.

### E. Community Content Event

Carries:
1. encrypted content payload,
2. logical message id,
3. community/group binding,
4. key epoch binding.

Reducer output:
1. content timeline projection,
2. content visibility state,
3. decrypt-required pending/quarantine state when keys are missing.

### F. Community Media Descriptor Event

Carries:
1. encrypted media descriptor,
2. source message/community binding,
3. file-key references.

Reducer output:
1. attachment visibility in community content and Vault.

## Canonical Projection Model

UI should not assemble community truth ad hoc.

The system should maintain one canonical community projection containing at
least:

1. `communitiesById`
   - descriptor + relay scope + lifecycle state
2. `membershipByCommunityId`
   - joined/left/expelled/pending state
3. `membersByCommunityId`
   - visible roster and evidence timestamps
4. `governanceByCommunityId`
   - active policy/governance outcomes
5. `roomKeyStateByCommunityId`
   - active epoch, pending distribution, send-block reason
6. `contentTimelineByCommunityId`
   - ordered encrypted/decrypted content projection
7. `mediaByCommunityId`
   - community-owned media descriptors
8. `removedCommunityIds`
   - tombstone/terminal state

Rules:
1. all community UI reads go through projection,
2. provider state may cache projection output, but must not independently
   invent truth,
3. direct persisted fallback is allowed only as bounded recovery input, not as
   a long-lived competing read authority.

## Recovery and Replay Model

Community recovery precedence remains:

1. tombstones / explicit non-joined evidence,
2. membership ledger,
3. signed replay/reducer evidence,
4. persisted chat/group fallback only when higher-order evidence is absent.

Additional rules:
1. restore/import should feed canonical community events where possible,
2. persisted fallback is a compatibility bridge, not future truth,
3. timeout alone cannot mark community convergence complete,
4. community visibility and community sendability are separate outputs,
5. new-device restore may show a joined community before keys/content fully
   converge, but it must do so explicitly.

## Sendability Contract

A community is send-capable only when all are true:

1. membership projection says `joined`,
2. community descriptor exists in canonical projection,
3. room-key projection says active epoch is available,
4. community is not tombstoned/disbanded/terminal,
5. runtime has the minimum relay scope needed for that community path.

Blocked send must emit deterministic reason codes, not vague UI fallback.

## Scalability Model

To stay maintainable as communities grow, the architecture should support:

1. room/thread partitioning without changing membership truth owners,
2. governance extensions without changing content reducers,
3. media/file evolution without changing membership recovery logic,
4. partial/lazy timeline hydration per community,
5. batched replay and reducer coalescing,
6. future native/mobile adapters that remain thin and projection-driven.

That means:
1. each plane scales independently,
2. reducers operate on typed event families,
3. providers consume projections instead of manually reassembling state from
   multiple storage layers.

## Local State and Cache Rules

Allowed caches:
1. local projection snapshots,
2. message/media indexes,
3. local drafts,
4. UI preferences.

Disallowed behavior:
1. stale cache resurrects joined visibility after explicit leave/tombstone,
2. persisted chat/group blobs outrank membership ledger,
3. local provider state overrides reducer truth,
4. hidden local state silently blocks canonical community visibility.

## Diagnostics Contract

The community architecture should remain diagnosable at these boundaries:

1. membership recovery hydrate,
2. reducer replay outcome,
3. room-key missing send block,
4. projection scope mismatch,
5. content decrypt/quarantine result,
6. media ownership/hydration result,
7. restore merge/apply diagnostics for community domains.

## Immediate Implementation Consequences

If this spec is adopted, the next implementation priorities should be:

1. formalize shared typed community event families,
2. formalize a community projection contract module,
3. move more provider/UI reads onto projection-only authority,
4. treat persisted group/chat fallback as import/recovery input rather than
   live truth,
5. keep local-only preferences explicit and scope-bound.

## Recommended Next Specs

The community system should next gain focused contract docs for:

1. community control event family,
2. governance/vote reducer contract,
3. community content envelope contract,
4. community media descriptor contract,
5. community recovery/import contract.

## Acceptance Standard

This architecture is only successful if it makes future work easier.

Success means:

1. a new community feature has one obvious owner path,
2. replay/recovery behavior is explainable from typed events and reducers,
3. cross-device restore does not depend on layered UI fallback,
4. local preferences remain local without distorting canonical truth,
5. community behavior can grow in depth without multiplying hidden owners.
