# Obscur System Logic Remediation Charter — 2026-08

**Status:** Charter proposal  
**Depends on:** `specs/backend/system-logic-audit-2026-08.md`  
**Scope:** Canonical owner decisions, containment, phased remediation  
**Constraint:** No direct implementation of forbidden `AUTH-SESSION` work under current handoff without maintainer approval.

---

## Purpose

This charter converts the system audit into explicit decisions:

1. which module owns each lifecycle
2. which parallel paths must be retired
3. which surfaces require immediate containment
4. which fixes are allowed now as critical regression slices
5. which fixes require a separate auth/session charter

---

## Canonical Owner Decisions

### 1. Contact relationship truth

**Canonical owner:** `account projection -> contactsByPeer`

Relevant files:
- `apps/pwa/app/features/account-sync/services/account-event-reducer.ts`
- `apps/pwa/app/features/account-sync/services/account-projection-selectors.ts`

**Decision**
- `CONTACT_*` event history is the only durable truth for:
  - accepted
  - pending
  - declined/canceled
  - removed

**Implication**
- `peerTrust` must stop being treated as an independent durable owner of acceptance.
- `peerTrust` may remain a short-lived UI compatibility layer only until all surfaces read projection directly.

### 2. Request inbox truth

**Canonical owner:** projection-derived request items from `contactsByPeer`

Relevant files:
- `apps/pwa/app/features/messaging/hooks/use-requests-inbox.ts`
- `apps/pwa/app/features/account-sync/services/account-projection-selectors.ts`

**Decision**
- request inbox state should be projection-derived only
- legacy chat-state request storage is a migration path, not a co-equal owner

**Implication**
- remove/cancel/decline must result in canonical contact events and projection convergence
- legacy request storage should not remain a long-term source for UI routing

### 3. Request action gating (`connect`, `message`, `voice`)

**Canonical owner:** one unified relationship selector built from projection

Relevant files:
- `apps/pwa/app/features/network/components/network-profile-view.tsx`
- `apps/pwa/app/features/messaging/services/request-status-projection.ts`
- `apps/pwa/app/features/main-shell/hooks/use-chat-actions.ts`

**Decision**
- action availability must not be separately inferred by multiple surfaces
- `message`, `voice`, `connect`, `resend`, `incoming pending`, `accepted` need one selector contract

**Implication**
- current fusion of `peerTrust + requestsInbox + requestFlowEvidence` across different components is unsound

### 4. Address book / connection presence

**Canonical owner:** none in current form; legacy `connectionStore` is transitional only

Relevant files:
- `apps/pwa/app/features/invites/utils/connection-store.ts`
- `apps/pwa/app/features/invites/utils/db/invite-db-name.ts`

**Decision**
- `connectionStore` must not participate in current contact truth or privileged CTA gating
- it may temporarily remain as a legacy local artifact only if fully hidden from behavioral decisions

**Implication**
- any surface reading `connectionStore` for "is this a real contact?" must be retired or downgraded

### 5. Auth/import/account binding truth

**Canonical owner:** bound profile runtime + auth-kernel session policy

Relevant files:
- `apps/pwa/app/features/auth-kernel/auth-kernel-bound-profile-auth.ts`
- `apps/pwa/app/features/runtime/services/window-runtime-binding.ts`
- `apps/desktop/src-tauri/src/commands/session.rs`

**Decision**
- profile-bound unlock/import policy is the only valid owner
- native rehydrate may not independently decide account rebinding without explicit policy visibility at the JS/runtime boundary

**Implication**
- auth fixes must be chartered as session-policy work, not UI patchwork

---

## Paths To Retire

### Retire 1: `peerTrust` as durable acceptance owner

Current problem:
- `peerTrust` persists acceptance outside projection
- read arbitration unions legacy + projection
- remove/unaccept must fight multiple truths

Target:
- `peerTrust` becomes either:
  - a thin adapter over projection accepted peers, or
  - a non-relationship feature store only (e.g. muted state)

### Retire 2: legacy request inbox as a live routing owner

Current problem:
- request inbox may come from projection or old chat-state storage
- behavior depends on cutover mode

Target:
- request inbox UI becomes projection-only
- migration path exists only for bootstrapping projection, not ongoing behavior

### Retire 3: `connectionStore` as contact truth

Current problem:
- global invites DB remains behaviorally relevant
- not clearly profile-scoped
- can keep "removed" contacts behaviorally alive

Target:
- no privileged CTA, trust state, or search routing may depend on `connectionStore`

### Retire 4: surface-specific action logic

Current problem:
- Network profile, Search, and Chat compose derive relationship affordances separately

Target:
- introduce one selector contract for relationship action state

---

## Immediate Containment Recommendations

These are the safest containment measures before deep repair.

### Containment A: downgrade privileged CTAs unless projection is decisive

Apply to:
- network profile
- search profile resolution
- message/voice call entrypoints

Rule:
- if relationship state is not decisively projection-backed, do **not** show high-trust CTAs
- fall back to neutral/request-oriented actions

### Containment B: hide `connectionStore`-derived contact affordances

Rule:
- address-book presence from legacy store must not imply:
  - trusted
  - can voice call
  - can directly message as accepted contact

### Containment C: surface explicit import/auth conflict reasons

Rule:
- users must not see silent "back to auth"
- slot conflict, active lease, native mismatch, and manual-lock gating must each surface distinct user-visible explanations

### Containment D: quarantine multi-profile leakage

Rule:
- any store keyed only by `publicKeyHex` or global DB name must be treated as suspect
- behavior must not assume profile isolation until those paths are migrated

---

## Allowed Critical Regression Slices

These slices fit current handoff constraints better than deep auth refactors.

### Slice 1: UI trust containment

Allowed shape:
- stop rendering trusted-only CTAs from ambiguous/legacy state
- require projection-backed acceptance before showing `message` / `voice`

Why allowed:
- containment of public-facing broken behavior
- does not require rewriting core auth/session policy

### Slice 2: legacy connection-store de-privileging

Allowed shape:
- prevent `connectionStore` from driving behavioral routing or trust display

Why allowed:
- subtraction of an invalid owner
- aligns with audit findings

### Slice 3: profile-scope hardening for local relationship stores

Allowed shape:
- add `profileId` scoping to local relationship state where safe
- especially stores still participating in UI behavior

Why allowed:
- containment against multi-profile leakage
- not inherently a forbidden auth-session rewrite

### Slice 4: explicit auth failure surfacing without changing session policy

Allowed shape:
- expose which conflict occurred
- do not alter underlying lease or native rebind policy yet

Why allowed:
- improves diagnosability
- avoids misleading no-op experience

---

## Forbidden / Charter-Required Work

These items must not be patched opportunistically under the current band.

### Charter-required A: native session rebind policy

Files:
- `apps/desktop/src-tauri/src/commands/session.rs`
- related session/native keychain policy

Why:
- affects core account ownership and profile/window rebinding
- squarely in `AUTH-SESSION` territory

### Charter-required B: cross-profile active session lease semantics

Why:
- changes when multiple windows/profiles may hold the same account
- requires product policy, not only bug repair

### Charter-required C: manual-lock + restore reconciliation redesign

Why:
- lock/unlock, native restore, and shell gating are tightly coupled
- wrong patch here can create security regressions

### Charter-required D: full relationship owner migration

Why:
- replacing `peerTrust` / legacy inbox / connectionStore with pure projection ownership is a staged migration
- requires explicit compatibility and backup/restore policy

---

## Phased Remediation Order

### Phase 0: Public damage containment

Goal:
- stop showing false trust/high-privilege actions
- stop silent auth rebounds with no explanation

Candidate work:
- CTA downgrade
- explicit auth conflict messages
- de-privilege legacy `connectionStore`

### Phase 1: Relationship owner simplification

Goal:
- one relationship selector
- projection-backed reads only for action gating

Candidate work:
- unify action-state derivation
- restrict `peerTrust` to compatibility or mute-only role
- remove request inbox dual-read behavior from runtime surfaces

### Phase 2: Profile-scope isolation

Goal:
- eliminate cross-profile leakage in relationship state

Candidate work:
- scope local stores by `profileId`
- isolate or replace global legacy DB usage

### Phase 3: Auth/session charter

Goal:
- define correct second-account import, native restore, and lease policy

Candidate work:
- explicit import state machine
- strict/visible native rebind rules
- runtime/auth shell reason taxonomy

---

## Verification Requirements

### L1

- state-matrix unit tests for:
  - contact event reducer transitions
  - relationship action selector
  - request projection behavior
  - profile-scoped store keys

### L2

- integration tests across:
  - search -> network profile
  - remove -> re-search
  - pending -> accepted -> removed
  - profile switch with same/different pubkeys

### L3

- desktop runtime smoke scripts:
  - second-account import on a bound profile
  - account active in another profile/window
  - native mismatch path
  - manual-lock + restore path

### L4

- demo-critical two-account end-to-end scenarios:
  - clean request
  - accept
  - remove
  - re-search after removal
  - second-account login/import

---

## Deliverable Decision Table

| Area | Decision | Action |
|---|---|---|
| Contact truth | projection only | migrate readers |
| Request inbox | projection only | retire dual behavior |
| Trust gating | unified selector | remove per-surface inference |
| Legacy connection DB | non-authoritative | downgrade/hide |
| Auth import conflicts | explicit surfaced reasons | contain first |
| Native session policy | separate charter | do not patch casually |

---

## Final Recommendation

Do **not** continue patching isolated UI symptoms.

Proceed in this order:

1. ship containment for false trust / false privilege
2. stop legacy stores from influencing privileged behavior
3. scope remaining local state by `profileId`
4. open a separate `AUTH-SESSION` charter for second-account import, native restore, and lease policy

Without that order, every local fix will continue to be reversible by a competing owner.

