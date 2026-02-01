# Obscur V1 Spec & Roadmap

## Purpose

Define a feasible, phased plan to ship a reliable Obscur V1 that integrates with the refined UI while preserving local-first identity and safe-by-default inbound interactions.

This spec is oriented around a single principle:

- Reliability and debuggability come first; UI polish and feature breadth must not reduce determinism.

## V1 Product Scope

### V1 core journeys

#### Journey A: Invite → Request → DM (1:1)

- User A creates an invite link.
- User B opens the link, creates/unlocks identity, redeems token.
- User B sends a connection request.
- User A accepts.
- Users can DM reliably (prefer NIP-17 if stable; allow kind `4` fallback where necessary).

#### Journey B: Invite → Join Group → Group chat

- User A creates an invite that includes:
  - inviter pubkey
  - deterministic relay set
  - group identifier/label
- User B opens link and redeems.
- User B joins the group.
- User B can read and post in the group if membership is satisfied.

### V1 constraints and invariants

- Private keys never leave the device.
- The coordination service does not store message plaintext.
- Invite tokens are opaque handles.
- Safety model is consistent:
  - unknown inbound interactions are gated behind explicit user action.
- Identity-scoped local storage boundaries are enforced across invites, relays, requests, groups, and moderation state.

### V1 explicit non-goals

- Global discovery/search.
- Centralized accounts or server-side user profiles.
- Automatic cross-device persona syncing.
- Media uploads/attachments.

## Architecture summary (V1)

### Components

- PWA (Next.js): UI + local-first state, identity, and relay connections.
- Nostr relays: transport for encrypted DMs and group events.
- Coordination Worker (Cloudflare Worker + D1): invite rendezvous and relay convergence only.

### Coordination responsibilities (V1)

- Create opaque invite tokens bound to:
  - inviter pubkey
  - relay set
  - optional group label/id
  - expiration
- Redeem tokens to return inviter pubkey + relay set + group metadata.

The Worker is not a message proxy.

## Protocol choices

### DMs

- Primary (V1): NIP-17 (gift wrap).
- Fallback (V1): kind `4` if NIP-17 delivery fails or is unsupported in a given edge case.

V1 rule: the app must be able to converge on at least one shared relay and reliably deliver at least one message in both directions.

### Groups

- Target: NIP-29 semantics for group membership and roles.
- V1 should aim for:
  - group metadata view
  - join flow
  - post flow
  - membership/role UX states

## Phased roadmap

Each phase has a concrete deliverable and acceptance criteria. Later phases must not regress earlier acceptance criteria.

### Phase 0: Reliability baseline and unified state model

**Goal**: make failure modes explicit and debuggable.

**Deliverables**:

- Define and centralize a shared vocabulary of states:
  - identity: locked/unlocked
  - invite: none/pending/redeemed/expired/invalid
  - request: none/pending/accepted/declined/blocked
  - relay: connected/connecting/degraded/offline
  - group: not_member/requested/member/moderator/owner
- Instrument critical flows with structured logs and user-facing errors:
  - invite create/redeem outcomes
  - relay connection counts and failures
  - publish/subscribe outcomes

**Acceptance criteria**:

- In any failure state, the UI shows:
  - what failed
  - what the user can do next

**Primary risks**:

- State drift across features if each feature invents its own trust vocabulary.

### Phase 1: Public coordination service hardening (invite rendezvous)

**Goal**: invites work across devices and networks.

**Deliverables**:

- Worker:
  - production-ready CORS policy
  - TTL enforcement
  - basic rate limiting / abuse control
  - redemption policy (recommended: `maxRedemptions` default 1)
- PWA:
  - clear invite redemption UX states (loading, invalid, expired, server-down)
  - persist relay list updates from redemption

**Acceptance criteria**:

- A creates invite; B redeems; B automatically has a usable relay set applied every time.

**Primary risks**:

- Token abuse and scanning; mitigate via TTL, max redemptions, and rate limiting.

### Phase 2: Request-first connection model (1:1)

**Goal**: unknown senders are gated; acceptance unlocks messaging.

**Deliverables**:

- Send request after redeem.
- Requests inbox + accept/decline/block.
- Messaging UI clearly indicates request status.

**Acceptance criteria**:

- Users cannot silently message unknown peers.
- After acceptance, DM works both directions.

**Implementation notes (PWA)**:

- After a successful invite redeem, the joiner auto-sends a tagged connection request to the inviter.
- Unknown inbound messages are routed to the Requests inbox and do not appear as normal chats until accepted.
- DM composer is disabled until the peer is accepted.

**Primary risks**:

- Confusing UX if “invite redeemed” is interpreted as “already connected”.

### Phase 3: DM transport reliability

**Goal**: reliable message delivery under real relay conditions.

**Deliverables**:

- Implement NIP-17 as the primary DM format.
- Implement kind `4` as a fallback DM format.
- Add minimal message delivery telemetry:
  - attempted / published / failed
- Default relay strategy:
  - curated stable relays
  - allow user relay customization without reaching zero viable relays

**Acceptance criteria**:

- With two browser profiles (guest-mode testing), the following loop is repeatable:
  - invite → request → accept → A↔B message exchange

**Primary risks**:

- Mixed DM format support; mitigate by choosing a single primary path for V1 and keeping fallback internal.

### Phase 4: Groups V1 (membership + roles + chat)

**Goal**: a small invite-only group experience with clear membership states.

**Deliverables**:

- Group identity:
  - stable group id (NIP-29 address / identifier)
  - local-only label support
- Group restriction modes (V1):
  - open: anyone can join
  - restricted: join requests must be approved
- Group join flow:
  - locked identity: view-only
  - unlocked identity: join and post
- Roles:
  - owner / moderator / member / guest displayed in UI
- Moderation entry points:
  - approve/deny join (if restricted)
  - local mute/block

**Acceptance criteria**:

- From an invite that references a group, a joiner can:
  - redeem
  - join
  - read messages
  - post a message (when permitted)

**Primary risks**:

- Metadata/privacy leakage via relay choice and group membership events.

### Phase 5: “True V1” UI integration + regression protection

**Goal**: ship the final design without breaking reliability.

**Deliverables**:

- Replace temporary flows with the refined UI components while maintaining the same underlying state machine.
- Add Playwright E2E coverage for critical journeys:
  - invite create/redeem
  - request send/accept
  - group join/post
  - DM send/receive

**Acceptance criteria**:

- E2E suite passes.
- No regressions in Phase 1–4 acceptance criteria.

**Primary risks**:

- UI refactors reintroducing silent failures; mitigate by writing E2E tests before deep UI changes.

## Testing strategy

### Guest-mode testing

Primary development test mode:

- Two browser profiles (A and B)
- Public coordination Worker
- Real relay set

Minimum repeatable test:

- invite → redeem → request → accept → DM message exchange
- invite → redeem → join group → post group message

## Open decisions

These choices should be finalized before Phase 3/4 hardening.

- DM primary and fallback: decided (NIP-17 primary, kind `4` fallback).
- Invite redemption policy: single-use vs multi-use.
- Relay policy: curated defaults vs inviter-provided only.
- Group restriction model: decided (open + restricted in V1).
