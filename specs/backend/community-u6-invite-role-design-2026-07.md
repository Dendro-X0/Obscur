# Design — U6 COM-RUN-11 invite role (post-U1 re-proof)

**Status:** Done Wave A · Done Wave B L3 · 2026-07-31  
**Parents:** [community-unpause-integration-study-2026-07.md](./community-unpause-integration-study-2026-07.md) §6 U6 · [community-invite-role-ecosystem-design.md](../../docs/program/community-invite-role-ecosystem-design.md) · [com-run-11-fixture-setup-2026-07.md](../../docs/program/com-run-11-fixture-setup-2026-07.md)

---

## Session gate

```text
HANDOFF ATOMIC STEP:  U6 Wave B dual CDP Accept/Cancel (chartered)
PAUSED / CANCELLED:   Full community · COM-RUN-* (except this charter) · O-2/O-4 · RIW-8 · Dev Lab as validation
CANONICAL OWNER:      community-invite-role-authority + community-invite-display-boundary
PROOF BEFORE DONE:    Wave A L1 · Wave B L3 dual-profile Accept/Cancel
OUT OF SCOPE:         COM-RUN-01 roster parity · full COM-RUN-* un-pause · U2 group persist · Dev Lab
```

**Charter:** Maintainer selected **U6** after Slice C L3 Pass (2026-07-31). Wave B confirmed after Wave A.

---

## Context

IRA-1…IRA-6 landed 2026-06-25 (`community-invite-role-authority`, display boundary, card `viewerRole`). Historical Phase 1C claimed COM-RUN-11 **t4**, but:

1. **U1** moved invite DM persist to dm-kernel — ingest path changed.  
2. Lifecycle / resolution / pipeline still branch on `message.isOutgoing` for supersede and response linking (not permissions on the card).  
3. Dual-window L3 after U1/U4/Phase 3 was **not** re-proved under this charter.

U6 is **not** a full reopen of COM-RUN-*. It is a chartered slice: keep wire-based role authority honest, subtract remaining `isOutgoing` role-adjacent owners, then dual-profile Accept/Cancel proof.

---

## Goal

| Viewer | Active invite | Must not see |
|--------|---------------|--------------|
| Inviter | **Cancel** | Accept / Decline |
| Invitee | **Accept** + **Decline** | Cancel |
| Observer | Read-only | Action buttons |

Sidebar preview, thread card, and action handlers must agree via display boundary → role authority (wire only).

---

## Waves

### Wave A — Subtract remaining `isOutgoing` role-adjacent owners (**Done 2026-07-31**)

| Owner | Problem | Fix |
|-------|---------|-----|
| `community-invite-lifecycle.ts` supersede | Compares `entry.isOutgoing !== message.isOutgoing` — profiles diverge | Prefer same wire `senderPubkey`; isOutgoing last-resort only |
| `community-invite-resolution.ts` legacy counterpart link | `invite.isOutgoing !== message.isOutgoing` | Prefer invite sender ≠ response sender |
| Contracts | No regression gate post-U1 | Lifecycle U6 cases + resolution wire-party fixture |

**Proof Wave A:**  
`vitest` invite lifecycle + resolution + role-authority — **39 Pass** · 2026-07-31.

**Do not claim:** COM-RUN-11 fixed / t4 / dual-profile Pass.

### Wave B — Dual-profile L3 Accept/Cancel (**Done 2026-07-31**)

| Item | Detail |
|------|--------|
| Fixture | Fresh community **U6 Invite Role** (NewTest 2 still listed Tester2 as member — blocked re-invite); dual CDP `:9230` / `:9231`; profile-2 created + Tester2 Import Key |
| Matrix | Inviter **Cancel** only · Invitee **Accept** + **Decline** on active invite card |
| Harness | `pnpm verify:u6-l3` · `scripts/u6-l3-invite-role-desktop.mjs` · `apps/pwa/tests/e2e/u6-l3-invite-role-cdp.spec.ts` |
| Proof | `test-results/u6-l3-invite-role-2026-07-31.json` · **l3.pass=true** |

**Mental simulation (Wave B):**

1. Tester1 (`:9230`) sends invite → DM card `data-invite-viewer-role=inviter` → Cancel only.  
2. Tester2 (`:9231`) receives same invite → `invitee` → Accept + Decline.  
3. Neighbor: NewTest 2 membership, U5 Find-in-community — untouched.

**Do not claim:** Full COM-RUN-11 closed / community un-pause / COM-RUN-01.

---

## Forbidden claims

- Full community un-pause  
- COM-RUN-01 roster parity  
- “COM-RUN-11 fixed” from L1 alone  
- Wave B Pass without dual-profile evidence  

---

## Handoff after Wave B

| Field | Value |
|-------|--------|
| Done | U6 Wave A + Wave B — wire role owners + dual CDP Accept/Cancel L3 |
| Next | Community otherwise **PAUSED** · optional COM-RUN-* only with new charter |
