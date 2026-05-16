# 36 Resilient Infrastructure and Technical Protocols

_Last reviewed: 2026-04-22 (baseline commit a3f16b10)._

Status: target infrastructure and protocol contract

## Purpose

This document defines the infrastructure and protocol direction for the future
rewrite.

It is intentionally separate from current relay-first implementation details.

It answers:

1. which technical protocols should exist,
2. which backend services should exist,
3. how privacy and sovereignty are preserved,
4. how the system remains maintainable and scalable.

## Protocol Restraint Rule

Future backend design must not add novel protocol machinery merely because it
is architecturally elegant.

Every backend protocol or coordination service must justify itself by improving:

1. maintainability,
2. scaling characteristics,
3. debuggability,
4. recovery determinism,
5. operational simplicity.

If a protocol family is difficult to maintain, difficult to scale, or likely to
recreate overlapping truth owners, it should not be part of the backend target,
even if it appears more decentralized on paper.

## Target Infrastructure Layers

### 1. Client Runtime

Responsibilities:

1. local UI,
2. local encrypted cache,
3. local key usage,
4. ephemeral compose state,
5. projection consumption.

Must not own:

1. cross-device coordination truth,
2. community directory truth,
3. session continuity truth,
4. transport retry strategy beyond the canonical transport owner.

### 2. Native Host

Responsibilities:

1. secure storage/keychain,
2. local filesystem/media,
3. native networking and proxy/Tor,
4. OS notifications,
5. window/profile runtime.

Must stay thin:

1. native host exposes capabilities,
2. product logic remains in shared contracts and services.

### 3. Coordination Backend

Responsibilities:

1. account/session coordination metadata,
2. invite lifecycle,
3. community membership and participant directory coordination,
4. canonical indexing for restore and discovery,
5. consistency-oriented public metadata services.

Must not require:

1. private message plaintext,
2. user private keys,
3. room-key plaintext.

Must prefer:

1. explicit service boundaries,
2. simple sequencing contracts,
3. replay-friendly indexing,
4. storage/query models that ordinary maintainers can reason about.

### 4. Relay Interop Layer

Responsibilities:

1. bridge to Nostr ecosystem,
2. backup delivery path,
3. public profile or public registry propagation where desired,
4. optional proxy or edge transformations.

Must not be the only product truth source.

## Target Protocol Families

### A. Identity and Session Protocol

Purpose:

1. device login persistence,
2. session restore,
3. profile binding,
4. secure session mismatch handling.

Canonical operations:

1. `session.bootstrap.scan`
2. `session.restore`
3. `session.lock`
4. `session.invalidate`
5. `session.profile_bind`

Hard rules:

1. session restore cannot depend on UI hints,
2. remember-me metadata and native session state must agree or fail visibly,
3. session truth has one owner.

### B. Sovereign Backup Protocol

Purpose:

1. export/import user-private state,
2. encrypted portable bundles,
3. deterministic recovery materialization,
4. cross-device continuity.

Canonical operations:

1. `backup.export.encrypted`
2. `backup.import.encrypted`
3. `backup.import.portable`
4. `backup.materialize.projection`
5. `backup.materialize.local_cache`

Hard rules:

1. backup import feeds one restore owner,
2. backup import cannot silently thin history later,
3. canonical import and compatibility restore must be explicitly distinguished.

### C. DM Timeline and Delivery Protocol

Purpose:

1. deterministic DM list/timeline behavior,
2. reliable restore and replay,
3. attachment/media continuity,
4. deletion convergence.

Canonical operations:

1. `dm.timeline.read`
2. `dm.timeline.restore`
3. `dm.timeline.reconcile`
4. `dm.delivery.publish`
5. `dm.delete.apply`

Hard rules:

1. list and timeline share one authority model,
2. message identity aliases are explicit,
3. sender-local optimistic state is not recipient truth.

### D. Community Membership and Directory Protocol

Purpose:

1. participant visibility,
2. joined/left/expelled state,
3. community coordination,
4. room-key/sendability prerequisites.

Canonical operations:

1. `community.membership.join`
2. `community.membership.leave`
3. `community.membership.expel`
4. `community.directory.read`
5. `community.directory.restate`

Hard rules:

1. omission is not removal evidence,
2. participant list reads from one projection,
3. explicit leave/expel/tombstone outrank weaker evidence,
4. room-key possession is not itself membership truth.

### E. Transport and Routing Protocol

Purpose:

1. relay delivery,
2. proxy/Tor adaptation,
3. subscription replay,
4. degraded-mode resilience.

Canonical operations:

1. `transport.connect`
2. `transport.recover`
3. `transport.replay_subscriptions`
4. `transport.publish`
5. `transport.route_mode.detect`

Routing modes:

1. `direct`
2. `privacy_routed`

Hard rules:

1. transport mode is explicit in diagnostics,
2. proxy/Tor cadence differs from direct transport,
3. transport health is evidence, not UI truth.

## Proposed Backend Services

The future backend can stay modular without pretending every service is
decentralized.

The preferred backend style is:

1. modular,
2. operator-hostable,
3. privacy-preserving,
4. coordination-authoritative where needed,
5. boring enough to maintain.

### 1. Session Service

Owns:

1. device/session restore metadata,
2. remember-me coordination,
3. profile-to-session binding metadata.

### 2. Restore Index Service

Owns:

1. canonical restore index for DM/community history,
2. replay sequencing metadata,
3. deterministic import checkpoints.

### 3. Community Coordination Service

Owns:

1. participant directory,
2. membership coordination,
3. community metadata coordination,
4. governance result indexing if needed.

### 4. Discovery Service

Owns:

1. searchable public metadata,
2. friend/invite code resolution,
3. profile/community lookup.

### 5. Media Descriptor Service

Owns:

1. attachment descriptor indexing,
2. storage host abstraction,
3. source-message ownership references.

## Shared Contracts Direction

Future shared contracts should be promoted into a small, explicit package set.

Suggested contract modules:

1. session contracts,
2. restore-import contracts,
3. DM read-model contracts,
4. community-membership contracts,
5. community-directory contracts,
6. transport-routing contracts,
7. media-descriptor contracts.

## Protocol Design Rules

Every protocol in the rewrite should follow these rules:

1. one canonical owner,
2. typed request/response/event contracts,
3. explicit degraded states,
4. explicit source-of-truth labels,
5. diagnostics on every owner boundary,
6. replay-safe idempotency keys,
7. account/profile scope on every scoped operation.

And additionally:

8. reject complexity that does not buy clear reliability or scaling wins,
9. prefer backend-authoritative sequencing over distributed ambiguity when the
   state being coordinated is not private plaintext,
10. keep the number of protocol families as small as possible.

## State Separation Rules

Keep these separate:

1. transport state,
2. restore/import state,
3. projection state,
4. local UI state,
5. local encrypted cache,
6. backend coordination truth.

A bug in one plane should not require reading all other planes just to know
what is happening.

## Resilience Rules

A resilient future system should satisfy:

1. startup session survives relaunch without credential prompts when remember-me
   is valid,
2. restore never thins DM/community truth after initial success,
3. community participant list does not collapse without explicit removal
   evidence,
4. proxy/Tor transport stays slower but stable rather than thrashing,
5. degraded transport does not corrupt product truth.

## Scalability Rules

The future architecture should scale by module, not by patch chain.

That means:

1. community features can expand without touching session logic,
2. transport calibration can evolve without touching message list rendering,
3. backup/import can evolve without changing route pages,
4. backend service contracts remain inspectable and replaceable.

## Immediate Refactor Guidance

Near-term work should stay aligned to this order:

1. codebase atlas first,
2. target architecture second,
3. protocol/infrastructure contract third,
4. then module-by-module extraction.

No broad refactor should proceed without naming:

1. current owner,
2. future owner,
3. compatibility bridge,
4. retirement condition.
