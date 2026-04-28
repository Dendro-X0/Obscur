# 23 Private Direct Envelope and Community Room-Key Contract

_Last reviewed: 2026-04-18 (baseline commit a3f16b10)._

Status: Design-only contract target
Scope: first implementation-ready protocol contract slice from
`docs/protocols/22-local-first-decentralized-protocol-architecture.md`

This document defines two explicit protocol contracts:

1. the private direct envelope,
2. the community room-key lifecycle.

These contracts are the first concrete step toward an Obscur-owned application
protocol carried over customizable relay transport.

This document does not claim current implementation parity.

## Purpose

Obscur needs one canonical contract for:

1. all private 1:1 encrypted application traffic,
2. all room-key distribution and rotation behavior for communities.

Without that contract, the product will continue to mix:

1. transport semantics,
2. application semantics,
3. membership truth,
4. key possession truth,
5. UI-local assumptions.

## Canonical Owners

Private direct envelope owner chain:

1. `apps/pwa/app/features/messaging/controllers/outgoing-dm-orchestrator.ts`
2. `apps/pwa/app/features/messaging/controllers/outgoing-dm-publisher.ts`
3. `apps/pwa/app/features/messaging/controllers/incoming-dm-event-handler.ts`
4. `apps/pwa/app/features/crypto/crypto-service.ts`

Community room-key lifecycle owner chain:

1. `apps/pwa/app/features/groups/services/group-service.ts`
2. `apps/pwa/app/features/groups/hooks/use-sealed-community.ts`
3. `apps/pwa/app/features/groups/services/community-ledger-reducer.ts`
4. `apps/pwa/app/features/crypto/room-key-store.ts`

Hard rule:
do not add a second lifecycle owner for message-envelope meaning or room-key
state.

## Contract A: Private Direct Envelope

## A1. Role

The private direct envelope is the single application container for:

1. direct user messages,
2. encrypted control messages,
3. delete/edit/receipt payloads,
4. private invite payloads,
5. room-key distribution to a specific recipient,
6. future encrypted 1:1 protocol extensions.

It is not a UI type.
It is not a relay truth type.
It is the application protocol unit.

## A2. Envelope Version

The first Obscur-native direct envelope version should be:

1. `obscur.private_direct.v1`

This version string must appear in relay-visible envelope metadata so:

1. decode paths are explicit,
2. migrations are possible,
3. downgrade ambiguity is avoided.

## A3. Transport-Visible Fields

The transport-visible envelope should contain only:

1. `protocol`
   - fixed string: `obscur.private_direct.v1`
2. `senderAccountPubkey`
3. `recipientAccountPubkey`
4. `eventCreatedAtUnixSeconds`
5. `encryptionSuite`
   - example: `obscur-xchacha20poly1305-v1`
6. `payloadEncoding`
   - example: `json`
7. `messageSemantic`
   - one of:
     - `user_message`
     - `delivery_receipt`
     - `delete_request`
     - `invite`
     - `community_room_key_distribution`
     - `community_room_key_rotation_notice`
8. `envelopeId`
9. `conversationScopeId`
   - deterministic local-facing scope id for 1:1 thread ownership
10. `replyToEnvelopeId`
   - optional, relay-visible only if needed for routing/replay
11. `ciphertext`
12. `signature`

Transport-visible fields must not include:

1. plaintext content,
2. file names,
3. file MIME when sensitive,
4. community room key bytes,
5. governance reasoning,
6. user-facing moderation text.

## A4. Encrypted Payload Fields

The encrypted payload must contain:

1. `payloadType`
   - mirrors `messageSemantic` but is authoritative after decrypt
2. `payloadVersion`
3. `logicalMessageId`
4. `plaintextBody`
   - optional for non-user-message payloads
5. `attachments`
   - encrypted media descriptors where relevant
6. `replyContext`
   - optional
7. `deleteTargetLogicalIds`
   - optional
8. `communityContext`
   - optional:
     - `communityId`
     - `groupId`
     - `keyEpoch`
9. `roomKeyDistribution`
   - optional:
     - `communityId`
     - `keyEpoch`
     - `wrappedRoomKey`
     - `rotationReason`
10. `senderDeviceHint`
    - optional and bounded
11. `createdAtUnixSeconds`
12. `protocolExtensions`
    - optional dictionary

The encrypted payload is the canonical semantic truth.
If relay-visible and decrypted fields disagree, the decrypted payload wins and
the event is rejected with diagnostics.

## A5. Direct Envelope Semantics

The first required message semantics are:

1. `user_message`
2. `delivery_receipt`
3. `delete_request`
4. `invite`
5. `community_room_key_distribution`
6. `community_room_key_rotation_notice`

Rules:

1. `user_message`
   - may carry body and encrypted attachments
2. `delivery_receipt`
   - must never be mistaken for read truth if only sender-local
3. `delete_request`
   - carries canonical logical target ids, not just UI row ids
4. `invite`
   - may carry private community/bootstrap material
5. `community_room_key_distribution`
   - is the only valid private direct semantic that carries wrapped room keys
6. `community_room_key_rotation_notice`
   - never replaces the actual wrapped key distribution message

## A6. Direct Envelope Validation

Incoming direct envelope must be rejected if:

1. `protocol` is unknown,
2. required transport-visible fields are missing,
3. signature is invalid,
4. recipient identity does not match local account,
5. decrypt fails,
6. decrypted `payloadType` conflicts with relay-visible `messageSemantic`,
7. `logicalMessageId` is missing,
8. encrypted room-key distribution payload lacks:
   - target community id,
   - key epoch,
   - wrapped room key.

Required diagnostics on rejection:

1. envelope ownership,
2. recipient match result,
3. decrypt result,
4. semantic mismatch reason,
5. final routing result.

## A7. Direct Envelope State Truth

User-facing delivery state should remain:

1. local draft,
2. locally queued,
3. relay accepted with evidence,
4. recipient-evidence observed where applicable.

Private direct envelope publication success does not equal:

1. read receipt,
2. user-visible render on recipient,
3. community membership validity,
4. room-key possession by recipient.

## Contract B: Community Room-Key Lifecycle

## B1. Role

The room-key lifecycle is the single contract for:

1. active community content key truth,
2. community content decryption eligibility,
3. key rotation timing,
4. member rekey distribution,
5. room-key-related send blocks.

It is separate from membership truth.

Joined membership does not imply room-key possession.
Room-key possession does not redefine membership truth.

## B2. Core Entities

Each community should track:

1. `communityId`
2. `groupId`
3. `keyEpoch`
4. `roomKeyState`
   - one of:
     - `missing`
     - `pending_distribution`
     - `active`
     - `superseded`
     - `revoked`
5. `rotationReason`
   - optional:
     - `community_created`
     - `member_removed`
     - `member_left_privacy_rotation`
     - `manual_security_rotation`
     - `compromise_suspected`
     - `protocol_reset`
6. `distributedToMemberPubkeys`
7. `activatedAtUnixSeconds`
8. `supersededAtUnixSeconds`

## B3. Key Epoch Rules

Rules:

1. every active room key has exactly one `keyEpoch`,
2. only one room key may be `active` per community at a time,
3. older keys may remain readable for bounded historical replay if explicitly
   retained,
4. new outbound community content must use the current active epoch only,
5. key epochs must be monotonically increasing within a community.

## B4. Rotation Triggers

Rotation is required on:

1. confirmed member removal,
2. compromise suspicion,
3. protocol reset,
4. explicit manual security action.

Rotation is strongly recommended on:

1. privacy-sensitive member leave,
2. community ownership transfer,
3. long-lived stagnant key age beyond policy threshold.

Rotation must not be triggered from:

1. optimistic local leave UI alone,
2. timeout-only recovery state,
3. relay availability changes alone.

## B5. Distribution Path

Room-key distribution must occur only through the private direct envelope using
the `community_room_key_distribution` semantic.

The distribution payload must include:

1. `communityId`
2. `groupId`
3. `keyEpoch`
4. `wrappedRoomKey`
5. `rotationReason`
6. `membershipEvidenceVersion`
7. `distributionCreatedAtUnixSeconds`

The room key itself must never be placed in:

1. relay-visible community-control fields,
2. relay-visible community-content fields,
3. public invite payloads,
4. local cache derived from untrusted relay replay alone.

## B6. Activation Rules

A new room key becomes locally `active` only when:

1. the encrypted distribution payload decrypts successfully,
2. the local account is an intended valid recipient,
3. the key epoch is newer than the active local epoch,
4. the community membership state is not explicitly:
   - `left`
   - `expelled`
   - `revoked`
5. the local room-key store persists the new key successfully.

If distribution decrypts but membership is explicitly non-joined:

1. store the event as a diagnostic artifact only if needed,
2. do not activate the key,
3. emit a deterministic warning.

## B7. Supersession Rules

When a new room key is activated:

1. previous active key becomes `superseded`,
2. new outbound community messages must not use the superseded key,
3. historical decrypt may still consult superseded keys if policy allows,
4. a member removed before the new epoch must not receive the new key.

## B8. Send Eligibility Contract

Community send is allowed only when all are true:

1. membership reducer says `joined`,
2. community presence is canonical,
3. local active room key exists for current epoch,
4. active room key is not `superseded` or `revoked`.

If blocked, emit:

1. `groups.room_key_missing_send_blocked`
2. with explicit reason code:
   - `no_local_room_keys`
   - `target_room_key_missing_local_profile_scope`
   - `pending_distribution`
   - `target_room_key_missing_after_membership_joined`
   - `target_room_key_record_unreadable`
   - `room_key_store_unavailable`
   - `membership_not_joined`
   - `active_epoch_missing`

## B9. Recovery Rules

Fresh-device restore may reconstruct community visibility before room keys fully
arrive.

Therefore:

1. community visible != community send-capable,
2. room-key restore is its own evidence path,
3. room-key absence must degrade into explicit blocked state, not silent failure,
4. restore completion must not assume room-key convergence from timeout alone.

## B10. Community Content Binding

Every encrypted community content envelope must carry:

1. `communityId`
2. `groupId`
3. `keyEpoch`
4. `ciphertext`
5. `logicalMessageId`

If incoming content references a `keyEpoch` that is:

1. unknown
2. revoked
3. impossible relative to local membership history

then:

1. do not mutate visible plaintext state,
2. emit diagnostics,
3. allow later replay/recovery if a matching key distribution arrives.

## Immediate Implementation Consequence

Before any migration, these two concrete contract modules should be created:

1. private direct envelope contract
   - shared typed transport-visible fields
   - shared typed encrypted payload families
   - shared validation rules
2. community room-key lifecycle contract
   - epoch state model
   - rotation trigger policy
   - activation/supersession rules
   - send eligibility reason codes

Suggested package location:

1. `packages/dweb-core`

Suggested runtime consumers:

1. `apps/pwa/app/features/messaging/controllers/*`
2. `apps/pwa/app/features/groups/services/*`
3. `apps/pwa/app/features/groups/hooks/use-sealed-community.ts`
4. `apps/pwa/app/features/account-sync/services/*`

## Validation Expectation

After these contracts exist, future tests should prove:

1. direct envelopes reject semantic mismatches deterministically,
2. delete commands resolve canonical logical target ids,
3. room-key rotation never activates for explicitly non-joined members,
4. community send blocks are explicit when membership and room-key truth diverge,
5. fresh-device restore may show joined communities before room keys converge,
   but never silently sends without an active key,
6. removed members do not receive or activate new room-key epochs.
