# Community System V2 Technical Specification

> Parent documents: [DESIGN_PATTERNS.md](./DESIGN_PATTERNS.md), [SECURITY_PROTOCOLS.md](./SECURITY_PROTOCOLS.md), [PHASE_1_STABILIZATION_SPEC.md](./PHASE_1_STABILIZATION_SPEC.md), [PHASE_2_MONOREPO_RESTRUCTURING_SPEC.md](./PHASE_2_MONOREPO_RESTRUCTURING_SPEC.md), [sealed-community-issues.md](./sealed-community-issues.md)
>
> Status: Draft (Pre-Implementation)
>
> Last updated: March 2, 2026

## 1. Executive Summary

This specification defines the next-generation decentralized Community System for Obscur. It upgrades the current sealed-community model to guarantee:

1. Canonical identity and lifecycle consistency (no ghost communities, no duplicate community records).
2. Reliable production operation across 4 default public relays, with user-configurable custom relays and storage providers.
3. Strong end-to-end encryption, metadata minimization, anti-monitoring, anti-censorship, and anti-association measures.
4. Strict community message containment (no cross-broadcast or accidental mixing with unrelated relay traffic).
5. Terminal disband behavior when the last member leaves.

No implementation is included in this document. This is the contract for implementation.

## 2. Scope and Non-Goals

### 2.1 In Scope

1. Community identity model and canonical IDs.
2. Event taxonomy, validation, ordering, and reducer rules.
3. Membership lifecycle (create, join, leave, expel, disband).
4. Relay scope enforcement and publication/ingestion policy.
5. Encryption and key-epoch rotation model for communities.
6. Migration strategy from existing persisted group/chat state.
7. Test and rollout gates.

### 2.2 Out of Scope (Next Phase)

1. Anti-fraud scoring engine and anti-spam enforcement logic.
2. Reputation sharing protocol and abuse intelligence exchange.
3. Full MLS/double-ratchet migration.

These are planned in the post-upgrade phase (see Section 16).

## 3. Design Principles

1. Local-first source of truth with deterministic replay.
2. Zero central admin model (egalitarian governance).
3. Relay as transport only, never authority.
4. Membership state is event-derived, never inferred from plain chat activity.
5. Strong cryptographic boundaries with explicit key epochs.
6. Strict identity and routing invariants across desktop and mobile.

## 4. Production Infrastructure Model

### 4.1 Relay Classes

1. `Default Communication Relays`: exactly 4 public relays shipped in production config.
2. `User Communication Relays`: optional relays added in settings by advanced users.
3. `Storage Providers`: NIP-96 providers for encrypted media payloads.

### 4.2 Community Relay Scope

Each community has immutable `relayScope` after genesis (except explicit scope migration event in a future extension). `relayScope` is the only set of relays allowed to carry that community's encrypted events.

### 4.3 Reliability Rules

1. Publish to all relays in scope.
2. Consider publish successful at `k-of-n` ACK threshold. Baseline recommendation: `k=2`, `n=4` for default pool.
3. Queue and retry failed relays asynchronously.
4. Never fail open by rerouting to non-scope relays.

## 5. Canonical Identity Model

### 5.1 Canonical Community ID

Each community is uniquely identified by:

`communityId = H(protocolVersion || genesisEventId || creatorPubkey)`

Properties:

1. Deterministic and immutable.
2. Independent of display name, invite code, and local cache state.
3. One lifecycle per `communityId`.

### 5.2 Conversation Identity

The only valid conversation key for community messages is:

`conversationId = "community:" + communityId`

No alternate keys are allowed (`groupId`, `group:<id>:<relay>`, or fuzzy substrings are invalid for message routing).

### 5.3 Duplicate Prevention Requirements

1. A single logical group cannot create a second community record with the same `communityId`.
2. After local data wipe, replay must rehydrate the same community identity.
3. Any attempted duplicate genesis for existing `communityId` must be rejected locally and tombstoned as invalid.

## 6. Data Model (Normative)

```ts
type CommunityMode = "private" | "public-discoverable";
type MembershipStatus = "active" | "left" | "expelled";

type CommunityRecord = {
  communityId: string;
  genesisEventId: string;
  creatorPubkey: string;
  mode: CommunityMode;
  relayScope: string[]; // normalized wss URLs
  createdAtUnix: number;
  disbandedAtUnix?: number; // terminal tombstone
};

type MemberState = {
  pubkey: string;
  status: MembershipStatus;
  latestStatusUnix: number;
  latestStatusEventId: string;
};

type MembershipProjection = {
  communityId: string;
  members: Record<string, MemberState>;
  activeCount: number;
};

type KeyEpochRecord = {
  communityId: string;
  epoch: number;
  keyRef: string; // local secure ref, not raw key in clear DB
  activatedAtUnix: number;
  retiredAtUnix?: number;
  reason?: "created" | "member_join" | "member_leave" | "expel" | "compromise";
};

type InviteCapability = {
  inviteId: string;
  communityId: string;
  targetPubkey?: string;
  issuedBy: string;
  issuedAtUnix: number;
  expiresAtUnix: number;
  epoch: number;
  revocable: boolean;
  usedAtUnix?: number;
};
```

## 7. Event Protocol and Validation

### 7.1 Outer Envelope

1. Use sealed encrypted event transport (Kind 10105 family for community payloads).
2. Event must be signed and signature-verified before reducer ingestion.
3. Relay URL must belong to the community's `relayScope`.

### 7.2 Inner Event Types

Required event names:

1. `community.created`
2. `member.joined`
3. `member.left`
4. `member.expelled` (derived from consensus vote result)
5. `key.epoch.rotated`
6. `message.sent`
7. `community.disbanded`

### 7.3 Actor Identity Binding

Reducer must trust outer signer identity as actor authority.

Rule:

1. If inner payload includes `actorPubkey`, it must equal outer `event.pubkey`.
2. If mismatch occurs, event is invalid and ignored.

### 7.4 Ordering Rule

Reducer ordering key:

1. `created_at` (ascending)
2. `relay_received_at` (ascending)
3. `event_id` (lexicographic tie-break)

Older events must never reverse a newer membership terminal state.

## 8. Reducer Invariants (Anti-Ghost Guarantees)

The reducer is authoritative and must satisfy all invariants:

1. Membership can only change via membership events (`member.joined`, `member.left`, `member.expelled`, `community.disbanded`).
2. `message.sent` never changes membership.
3. No auto-membership on key possession alone.
4. No auto-rehabilitation on message receipt.
5. `community.disbanded` is terminal; no subsequent membership transition allowed.
6. State transitions are idempotent under duplicate event delivery.
7. State converges deterministically under out-of-order relay streams.

## 9. Community Modes

### 9.1 Private

1. No required public discovery metadata.
2. Entry only through invite capability and key package.
3. Membership and messages remain sealed.

### 9.2 Public-Discoverable

1. Minimal discovery metadata may be published (name/about/avatar/relay hints).
2. Membership and messages are still sealed and E2EE.
3. Discovery metadata never includes room keys or member roster.

## 10. Lifecycle Flows

### 10.1 Create

1. Generate genesis event and derive canonical `communityId`.
2. Initialize epoch `1` key and local vault references.
3. Persist `CommunityRecord`, `MembershipProjection`, and `KeyEpochRecord`.
4. Publish `community.created` to `relayScope`.

### 10.2 Join

1. Receive invite capability (gift-wrapped/private route).
2. Validate invite expiry, scope, and epoch.
3. Persist key epoch reference.
4. Emit `member.joined`.
5. Transition local membership to active only after reducer applies `member.joined`.

### 10.3 Leave

1. Emit `member.left`.
2. Mark member status terminal for current epoch.
3. Rotate key epoch for remaining members when policy requires.

### 10.4 Auto-Disband (Last Member)

When active member count becomes zero:

1. Emit `community.disbanded`.
2. Mark community tombstoned (`disbandedAtUnix`).
3. Archive conversation locally as read-only history.
4. Remove active chat entry from primary inbox views.

## 11. Relay Scope Enforcement and Message Containment

### 11.1 Send-Side Rules

1. Publish only to `relayScope`.
2. Reject attempt to broadcast community event to non-scope relay.
3. Never auto-fallback to random relays.

### 11.2 Receive-Side Rules

1. Ignore community payload from non-scope relay.
2. Ignore payload failing signature or actor binding checks.
3. Ignore payload with unknown/invalid channel binding tag.

### 11.3 Cross-Community Isolation

1. Channel binding tag must be community-specific and scope-bound.
2. Event replay from unrelated communities must not enter reducer.

## 12. Encryption and Metadata Hardening

### 12.1 E2EE Baseline

1. Community payloads are encrypted with epoch room keys.
2. Invite/key distribution uses private wrapped delivery.
3. Local persistence uses at-rest encryption for sensitive content.

### 12.2 Key Epoch Policy

Key rotation triggers:

1. Expulsion.
2. Suspected compromise.
3. Optional policy on leave/join for higher paranoia mode.

### 12.3 Anti-Association / Anti-Monitoring

1. Minimize cleartext tags and identifying metadata.
2. Use constant-schema payload envelopes.
3. Add optional timing jitter/padding mode for high-privacy users.

## 13. Migration from Current System

### 13.1 Inputs

1. Legacy group records from persisted chat/group state.
2. Historical sealed events and message records.

### 13.2 Migration Steps

1. Build canonical community map and ID normalization table.
2. Replay eligible legacy events into new reducer.
3. Deduplicate communities by canonical `communityId`.
4. Convert legacy conversation keys to `community:<communityId>`.
5. Apply local tombstones to orphaned ghost communities.
6. Validate no duplicate active communities post-migration.

### 13.3 Migration Safety Requirements

1. No message history loss within valid communities.
2. No active ghost group remains after migration.
3. Migration is resumable and idempotent.

## 14. Testing and Verification

### 14.1 Property-Based Reducer Tests (Required)

1. No resurrection after `member.left` unless newer explicit `member.joined`.
2. No transitions after `community.disbanded`.
3. Deterministic convergence under reordered events.
4. Idempotency under duplicate delivery.

### 14.2 Integration Tests (Required)

1. Multi-relay partial outage and recovery.
2. Multi-device replay parity (desktop/mobile).
3. Data wipe + rehydrate without duplicate community creation.
4. Last-member leave triggers disband consistently.

### 14.3 Security Tests (Required)

1. Outer/inner actor mismatch rejection.
2. Non-scope relay injection rejection.
3. Cross-community replay rejection.

## 15. Rollout Plan

### 15.1 Stages

1. `Stage A`: shadow reducer in dev builds, compare outputs to current system.
2. `Stage B`: opt-in beta with telemetry and migration snapshots.
3. `Stage C`: default-on for new installs.
4. `Stage D`: mandatory migration for existing users.

### 15.2 Exit Gates

1. All required tests green.
2. Zero critical ghost-group regressions in beta.
3. No duplicate community records in migration audits.
4. Publish/ingest relay-scope violations at zero in telemetry.

## 16. Next Phase: Anti-Fraud and Anti-Spam

After Community V2 rollout, implement baseline abuse resistance:

1. First-contact throttling and optional proof-of-work gate.
2. Invite abuse controls (single-use, expiry, revocation).
3. Quarantine inbox for untrusted traffic.
4. Local reputation score and rate limits (no central authority).
5. User moderation controls: block, mute, report, shared deny-list import (opt-in).

This phase must not weaken anonymity or metadata privacy guarantees.

## 17. Implementation Checklist

1. Canonical identity and conversation key enforcement.
2. Event-sourced membership reducer with invariants.
3. Relay scope policy on send and receive paths.
4. Disband terminal behavior with archival UX.
5. Migration pipeline with dedupe and tombstoning.
6. Desktop/mobile parity validation.
7. Release gating and staged rollout telemetry.

## 18. Open Questions

1. Should relay scope migration be permitted in V2, or deferred to V3?
2. Should key rotation on every leave be default or privacy-mode only?
3. Should public-discoverable mode include optional encrypted member count proofs?
4. Which telemetry fields are safe by default without increasing metadata leakage?
