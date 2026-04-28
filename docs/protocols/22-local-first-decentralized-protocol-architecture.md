# 22 Local-First Decentralized Protocol Architecture

_Last reviewed: 2026-04-18 (baseline commit a3f16b10)._

Status: Design-only architecture target
Scope: future Obscur application protocol over relay-based transport

This document defines the concrete protocol architecture Obscur should target if
the product is not constrained by fixed social-protocol semantics and instead
optimizes for:

1. decentralization,
2. user ownership,
3. local-first execution,
4. robust privacy,
5. strong community behavior,
6. customizable relay topology.

This is not a claim that the architecture is fully implemented today.

## Position

Obscur should treat relays as transport infrastructure, not as application
truth.

The product protocol should therefore be:

1. relay-compatible,
2. application-defined,
3. local-first,
4. privacy-preserving by default,
5. community-capable without surrendering governance or data truth to a single
   relay or server.

In practical terms:

1. Nostr-style relays remain the delivery fabric.
2. Obscur owns the actual application protocol.
3. Plaintext meaning, community rules, room keys, and user-facing truth live in
   local/runtime owners, not in public relay-readable event semantics.

## Design Goals

1. Devices remain the canonical place where plaintext user state exists.
2. Remote systems carry ciphertext, redundancy, and replay inputs, not final
   authority.
3. One user action maps to one canonical owner path per domain.
4. Community integrity does not depend on local optimistic state or one relay's
   memory.
5. Media handling follows the same privacy model as messages.
6. Multi-device restore/sync remains evidence-based and local-first.

## Non-Goals

This architecture does not claim:

1. full metadata invisibility from public relays,
2. full anonymity against traffic analysis,
3. trust in any single coordination server,
4. compatibility-first design over privacy/correctness,
5. that manual runtime replay can prove E2EE confidentiality against public
   relay operators.

## Canonical Planes

Obscur protocol should be split into explicit planes.

## 1. Identity Plane

Purpose:
own account keys, device trust, profile binding, and local session truth.

Current owner anchors:

1. `apps/pwa/app/features/auth/hooks/use-identity.ts`
2. `apps/pwa/app/features/auth/utils/identity-profile-binding.ts`
3. `apps/pwa/app/features/profiles/services/profile-scope.ts`
4. `apps/pwa/app/features/runtime/services/window-runtime-supervisor.ts`

Rules:

1. Identity is local-first.
2. Device/session restore cannot silently redefine ownership.
3. Profile binding resolves before account-scoped stores mount.
4. Device trust and key access are explicit domains, not ambient globals.

## 2. Transport Plane

Purpose:
publish, receive, retry, replay, and diagnose relay-carried envelopes.

Current owner anchors:

1. `apps/pwa/app/features/relays/hooks/enhanced-relay-pool.ts`
2. `apps/pwa/app/features/relays/services/relay-runtime-supervisor.ts`
3. `apps/pwa/app/features/relays/services/relay-recovery-policy.ts`
4. `apps/pwa/app/features/messaging/services/messaging-transport-runtime.ts`

Rules:

1. Relays are transport only.
2. Relay success is not message-read truth.
3. Retry/recovery is evidence-based.
4. Relay choice is user-configurable and replaceable.
5. No single relay becomes the authority for community, delivery, or restore
   truth.

## 3. Content Plane

Purpose:
carry encrypted message bodies and encrypted control payloads.

Current owner anchors:

1. `apps/pwa/app/features/messaging/controllers/enhanced-dm-controller.ts`
2. `apps/pwa/app/features/messaging/controllers/outgoing-dm-publisher.ts`
3. `apps/pwa/app/features/messaging/controllers/incoming-dm-event-handler.ts`
4. `apps/pwa/app/features/crypto/crypto-service.ts`

Rules:

1. Plaintext user content exists only locally.
2. Remote payloads carry ciphertext and bounded routing metadata only.
3. Edits, deletes, receipts, and moderation commands are protocol messages, not
   UI-local side effects.
4. Sender-local optimistic state never implies remote truth.

## 4. Community Plane

Purpose:
model membership, roles, governance, room keys, and message eligibility for
communities.

Current owner anchors:

1. `apps/pwa/app/features/groups/providers/group-provider.tsx`
2. `apps/pwa/app/features/groups/hooks/use-sealed-community.ts`
3. `apps/pwa/app/features/groups/services/community-ledger-reducer.ts`
4. `apps/pwa/app/features/groups/services/group-service.ts`

Rules:

1. Membership truth is reducer-driven and evidence-backed.
2. Room-key ownership is separate from membership visibility.
3. Community sendability requires:
   - joined membership evidence,
   - target community presence,
   - active room key.
4. Governance actions resolve from signed events and reducer truth, never from
   optimistic local UI.
5. Community content should be E2EE at the application layer even if relay-side
   coordination remains partially visible.

## 5. Media Plane

Purpose:
handle encrypted file payloads, media descriptors, local cache, and Vault
aggregation.

Current owner anchors:

1. `apps/pwa/app/features/messaging/utils/logic.ts`
2. `apps/pwa/app/features/vault/services/local-media-store.ts`
3. `apps/pwa/app/features/vault/hooks/use-vault-media.ts`
4. `apps/pwa/app/features/account-sync/services/encrypted-account-backup-service.ts`

Rules:

1. Media should be encrypted client-side before upload when privacy-sensitive.
2. Vault is a local-first aggregated library, not remote truth.
3. Removing from Vault is not deleting the source message.
4. File download/save behavior is runtime-specific, but source ownership stays
   explicit.

## 6. Sync and Recovery Plane

Purpose:
restore deterministic local state across devices without making network timing
the source of truth.

Current owner anchors:

1. `apps/pwa/app/features/account-sync/hooks/use-account-sync.ts`
2. `apps/pwa/app/features/account-sync/services/encrypted-account-backup-service.ts`
3. `apps/pwa/app/features/account-sync/services/account-projection-runtime.ts`
4. `apps/pwa/app/features/account-sync/services/account-event-ingest-bridge.ts`

Rules:

1. Restore is evidence-based.
2. Timeout alone cannot mark convergence complete.
3. Restore must not silently shrink self-authored or non-deleted media history.
4. Local state and remote replay reconcile through explicit reducers and
   checkpoints, not hidden side effects.

## Protocol Container Model

Obscur should define its own application envelopes carried over relay transport.

Every protocol message should be split into:

1. transport-visible envelope,
2. encrypted application payload.

Transport-visible envelope must contain only what is necessary for:

1. routing,
2. replay ordering,
3. diagnostics,
4. signature and ownership checks,
5. protocol versioning.

Encrypted payload must contain:

1. actual message body,
2. control commands,
3. reply/thread references,
4. media decryption descriptors,
5. community governance payloads when privacy-sensitive,
6. future protocol extension fields.

## Envelope Families

Obscur should standardize the following application-level families.

### A. Private Direct Envelope

Used for:

1. 1:1 messages,
2. private control commands,
3. delete/edit/receipt payloads,
4. room-key distribution messages for communities,
5. invite payloads that must stay private.

Properties:

1. recipient-scoped,
2. per-message encrypted,
3. diagnosable publish/receive lifecycle,
4. local optimistic state remains provisional.

### B. Community Control Envelope

Used for:

1. membership proposals,
2. membership acceptance/leave/removal,
3. governance votes,
4. role or policy transitions,
5. room-key rotation announcements or references.

Properties:

1. reducer-consumable,
2. signed,
3. capable of public or partially encrypted control semantics depending on the
   action,
4. must never let UI-local state invent governance truth.

### C. Community Content Envelope

Used for:

1. sealed community messages,
2. encrypted announcements,
3. community media references,
4. community moderation commands when content privacy matters.

Properties:

1. community-scoped,
2. encrypted with room-key lineage,
3. replay-order tolerant,
4. separate from control-plane membership truth.

### D. Media Descriptor Envelope

Used for:

1. encrypted file references,
2. thumbnail descriptors,
3. MIME/name/hash metadata,
4. per-recipient or per-community file-key delivery.

Properties:

1. file blob and file-key are separate concerns,
2. remote storage should not receive plaintext-sensitive metadata unless
   intentionally allowed,
3. Vault derives source ownership from message truth, not storage-host truth.

## Key Hierarchy

Obscur should use an explicit key hierarchy.

## 1. Account Identity Key

Purpose:
account identity, signing, and device/account association.

Rules:

1. long-lived,
2. owned by the user,
3. never replaced silently during restore or profile rebinding.

## 2. Device Trust Key Material

Purpose:
bind local device state and secure local recovery operations.

Rules:

1. device-scoped,
2. used for local trust, device enrollment, or secure restore extensions,
3. not treated as interchangeable with account identity.

## 3. Direct Message Session Material

Purpose:
encrypt 1:1 content and private control messages.

Rules:

1. derive or establish per-peer encryption context,
2. version explicitly,
3. allow migration without ambiguous downgrade paths.

## 4. Community Room Key

Purpose:
encrypt community content payloads.

Rules:

1. one active room key per community epoch,
2. rotate on member removal, compromise suspicion, or protocol reset,
3. distribute to valid members through private envelopes,
4. membership truth and room-key truth remain separate.

## 5. File Content Key

Purpose:
encrypt each uploaded file blob.

Rules:

1. generated per file or per attachment object,
2. wrapped into message/community encrypted payloads,
3. storage provider receives encrypted file bytes, not plaintext content.

## Community Model

Obscur communities should be split into two layers.

## A. Membership/Governance Layer

Carries:

1. who is a member,
2. who is muted/removed/left,
3. governance outcomes,
4. visible community identity and policy state where needed.

Owner truth:

1. signed events,
2. reducer outcomes,
3. recovery precedence,
4. tombstones and ledger state.

## B. Content Layer

Carries:

1. actual community messages,
2. encrypted file references,
3. moderation payloads that should not be plaintext-visible.

Owner truth:

1. room-key possession,
2. content replay validity,
3. community-scoped encrypted payloads.

This separation is required because:

1. a user can be visible as joined before room keys finish converging,
2. governance truth must remain explicit even when content stays encrypted,
3. relay coordination and content privacy are not identical domains.

## Media Model

Every privacy-sensitive attachment should follow this shape:

1. encrypt file bytes locally,
2. upload encrypted blob to chosen storage provider,
3. place file descriptor in encrypted protocol payload,
4. keep local plaintext/cache and Vault indexing on-device,
5. derive source conversation/community ownership from message truth.

The file descriptor should conceptually include:

1. file id,
2. encrypted blob URL,
3. content hash of encrypted payload,
4. original file name and MIME inside encrypted metadata,
5. thumbnail descriptor if present,
6. file content key material or wrapped key reference,
7. source conversation/community id.

## Relay-Visible vs Encrypted Fields

Obscur should be explicit about what relays may still observe.

Relay-visible by necessity:

1. sender identity or routing identity,
2. timestamps,
3. replay ordering metadata,
4. some scope/routing hints,
5. publication timing and frequency.

Encrypted where product privacy requires it:

1. plaintext body,
2. file names and sensitive file metadata,
3. room-key distribution payloads,
4. community control payloads that would otherwise leak sensitive governance
   meaning,
5. moderation payload content,
6. thread/reply semantics when those are privacy-sensitive.

This means Obscur can deliver strong content E2EE while still acknowledging
that full metadata invisibility is not guaranteed on public relays.

## Local-First State Model

The local-first contract should be:

1. local plaintext state is canonical for UX,
2. remote relay state is transport/replay input,
3. backup/sync state is encrypted recovery material,
4. derived indexes are disposable and scope-bound.

Concrete implications:

1. `messages`/Vault caches must rebuild on account/profile changes,
2. delete tombstones must survive restore and replay,
3. restore cannot be marked complete by timeout alone,
4. local projections must never outlive active identity scope.

## Diagnostics Contract

This protocol architecture only works if the canonical boundaries are
diagnosable.

Minimum diagnostics should remain explicit for:

1. transport publish attempts/results,
2. incoming routing decisions,
3. account restore merge/apply,
4. membership recovery hydration,
5. room-key missing send blocks,
6. media hydration parity,
7. updater/download fallback states where relevant.

## Implementation Direction

Implementation should proceed in this order:

1. verify current functionality baseline,
2. narrow unresolved runtime failures,
3. formalize protocol contracts for each plane,
4. add focused tests around those contracts,
5. only then expand or migrate behavior.

The first protocol-contract slices to formalize should be:

1. private direct envelope contract,
2. community room-key lifecycle contract,
3. community content envelope contract,
4. encrypted media descriptor contract,
5. sync/replay conflict resolution contract.

## Architectural Consequence

If Obscur adopts this architecture, then:

1. relays remain important but non-authoritative,
2. community behavior becomes app-defined instead of protocol-bound,
3. privacy improves because meaning lives inside encrypted application payloads,
4. compatibility with generic social clients becomes secondary to correctness
   and privacy,
5. specs and tests become the source of confidence for confidentiality claims,
   not manual relay observation.
