# WP1 — P1 relationship-graph release-surface matrix (2026-11-08)

```text
Gate design: specs/backend/social-multiparty-sync-production-gate-design-2026-11-08.md
Investigation: specs/backend/social-multiparty-sync-production-gate-investigation-2026-11-08.md
Parent charter: specs/backend/2026-11-07-social-relationship-lifecycle-unified-design.md
PAUSED: Soft L3 Fixed · Tor · Matrix · Continuity · claiming P1 Pass from Soft L3 alone
```

## Legend

| Cell | Meaning |
|------|---------|
| **Pass** | Named dual-party L2 (or stronger) on that surface |
| **Partial** | Wire/local exists; peer soak incomplete, residue, or honesty gap |
| **Unproven** | Code path exists; no dual-party L2 for this gate |
| **Blocked** | Surface cannot run dual CDP / soak yet |
| **N/A** | Explicit non-goal for this production gate |

**Surfaces**

| Surface | Definition |
|---------|------------|
| Soft L3 | Dual CDP static-dev · exclusive `ws://localhost:7000` (persist hygiene Pass) |
| Public / static-dev | Dual CDP · Default Stable / mixed public relays (not Soft L3-only) |
| Packaged NSIS | Installed release/beta NSIS · dual-party proof |

Packaged dual CDP remains **Blocked** until lab CDP seam (`specs/backend/packaged-nsis-lab-cdp-seam-investigation-2026-11-08.md`). Waivers require maintainer-written substitute (scripted L3 / manual) — none granted in this matrix.

## Scope decisions (kick / revoke)

| Action | This production gate | Rationale |
|--------|----------------------|-----------|
| **Kick / expel member** | **IN SCOPE** | Governance owner + expelled terminal cache exist; multiparty sync goal includes “groups / other entities” |
| **Invite cancel** (host or invitee cancel pending) | **IN SCOPE** | UI `cancelInvite` + terminal invite peer evidence |
| **Invite decline** | **IN SCOPE** | Same terminal family as cancel |
| Host “revoke after accept” | **N/A** (= kick/expel or leave) | Post-accept removal is leave/kick, not invite revoke |
| Multi-device same pubkey | **N/A** | Continuity band — not this gate |

## Matrix

| # | Mutation | Soft L3 | Public / static-dev | Packaged NSIS | Evidence / notes |
|---|----------|---------|---------------------|---------------|------------------|
| 1 | Contact **accept** / Connect | Partial | Pass* | Blocked | *Embedded in contact-delete/reconnect + trust-directory soaks (2026-11-07); not Soft L3-labeled |
| 2 | Contact **remove** + peer cancel apply | Partial | Pass | Blocked | Public [`contact-delete-reconnect-l2-soak-2026-11-07`](../../docs/handoffs/contact-delete-reconnect-l2-soak-2026-11-07.md) · Soft L3 Remove UI Pass / peer Network demote **Fail** [`contact-soft-l3-remove-reconnect-l2-soak-2026-11-08`](../../docs/handoffs/contact-soft-l3-remove-reconnect-l2-soak-2026-11-08.md) |
| 3 | Contact **reconnect** + Requests card | Partial | Pass | Blocked | Public [`contact-reconnect-requests-tab-l2-soak-2026-11-07`](../../docs/handoffs/contact-reconnect-requests-tab-l2-soak-2026-11-07.md) · Soft L3 Invitation delivered Pass / Requests (N) **Fail** (same Soft L3 soak) |
| 4 | **Block** → peer demote | Pass | Pass | Blocked | Soft L3 + Public [`block-lifecycle-public-stable-l2-soak-2026-11-08`](../../docs/handoffs/block-lifecycle-public-stable-l2-soak-2026-11-08.md) |
| 5 | **Unblock** (no auto-accept) | Pass | Pass | Blocked | Public Pass after wire-accept×removedPeers mask · [`block-unblock-trust-resurrect-design-2026-11-08`](./block-unblock-trust-resurrect-design-2026-11-08.md) |
| 6 | Community **invite** create → accept | Pass | Pass | Blocked | Soft L3 [`invite-fail-slice3-l2-soak-2026-11-08`](../../docs/handoffs/invite-fail-slice3-l2-soak-2026-11-08.md) · Public [`invite-public-stable-l2-soak-2026-11-08`](../../docs/handoffs/invite-public-stable-l2-soak-2026-11-08.md) |
| 7 | Community **leave** → peer roster exclude | Pass | Pass | Blocked | Soft L3 [`leave-peer-visibility-l2-soak-2026-11-08`](../../docs/handoffs/leave-peer-visibility-l2-soak-2026-11-08.md) · Public [`leave-peer-visibility-public-stable-l2-soak-2026-11-08`](../../docs/handoffs/leave-peer-visibility-public-stable-l2-soak-2026-11-08.md) |
| 8 | **Invite cancel / decline** terminal | Unproven | Unproven | Blocked | Terminal helpers exist; no dedicated dual CDP soak for this gate |
| 9 | **Kick / expel** → peer exclude | Unproven | Unproven | Blocked | `persistCommunityGovernanceMemberExpelled` · no multiparty L2 |
| 10 | Decline / cancel **DM request** | Partial | Partial | Blocked | Lifecycle tags present (charter inventory “OK pattern”); no fresh gate soak |

## P1 gate status

```text
P1 Soft L3 core (block / leave / invite): Pass
P1 Soft L3 contact remove/reconnect:     Partial (P1-O4 2026-11-08 — Remove+delivered Pass; peer demote + Requests Fail)
P1 public Block + Unblock:               Pass (2026-11-08)
P1 public Leave peer visibility:         Pass (2026-11-08 · fixture InviteL2-7ggtf2)
P1 public invite create→accept:          Pass (2026-11-08 · Soft L3 accept → Default Stable both-joined)
P1 kick/expel + invite cancel/decline:   Unproven (owed · in scope)
P1 packaged:                             Blocked (seam or substitute)
P1 PRODUCTION PASS:                      NO
```


## Waivers (none granted)

| Proposed waiver | Decision |
|-----------------|----------|
| Soft L3 Pass substitutes for public-relay Pass | **Rejected** — production users hit public relays |
| Soft L3 Pass substitutes for packaged Pass | **Rejected** — NSIS install L2 Partial; CDP seam open |
| Kick/expel out of gate | **Rejected** — in scope per multiparty goal |
| Invite Fixed without maintainer cut | **Still forbidden** (handoff) even when L2 Pass |

## Owed work (priority for P1 close)

| Priority | Item | Atomic shape |
|----------|------|--------------|
| **P1-O1** | Public Default Stable dual CDP re-prove **Block** | **Pass 2026-11-08** |
| **P1-O1b** | Unblock trust-resurrect design → L1 → public re-soak | **Pass 2026-11-08** — wire accept masked by `removedPeers` |
| **P1-O2** | Public Default Stable dual CDP **Leave** peer visibility | **Pass 2026-11-08** — [`leave-peer-visibility-public-stable-l2-soak-2026-11-08`](../../docs/handoffs/leave-peer-visibility-public-stable-l2-soak-2026-11-08.md) |
| **P1-O3** | Public Default Stable dual CDP **invite** create→accept | **Pass 2026-11-08** — [`invite-public-stable-l2-soak-2026-11-08`](../../docs/handoffs/invite-public-stable-l2-soak-2026-11-08.md) |
| **P1-O4** | Soft L3 dual CDP **contact remove → reconnect** (closes Soft L3 Partial on rows 1–3) | **Partial 2026-11-08** — Remove UI + Invitation delivered Pass; peer Network demote Fail; Requests (N) Fail · [`contact-soft-l3-remove-reconnect-l2-soak-2026-11-08`](../../docs/handoffs/contact-soft-l3-remove-reconnect-l2-soak-2026-11-08.md) |
| **P1-O5** | Kick/expel multiparty **design → L1 → Soft L3 L2** | New slice under membership governance owner — no new publish bus |
| **P1-O6** | Invite cancel/decline dual CDP Soft L3 | Thin soak on existing terminal path |
| **P1-O7** | Packaged proof | NSIS CDP seam design (WP5) **or** maintainer scripted L3 substitute written into this matrix |

P2 history (WP2) may start in parallel **only after** this matrix is accepted; it must not claim P1 Pass.

## Claim language

- May say: P1 **release-surface matrix Pass** (this doc) · Soft L3 block/leave/invite L2 Pass · public Block+Unblock+Leave+Invite L2 Pass
- Must not say: P1 production Pass · multiparty social sync Pass · packaged relationship L2 Pass · Soft L3 Fixed

## Handoff next atomic step

```text
NEXT: P1-O4b — Soft L3 peer demote notify + Requests pending for post-remove reconnect (DM residue)
  Optional parallel: P1-O5 kick/expel design
Do NOT claim Soft L3 contact rows 1–3 Pass until O4b closes
  or P1-O5 kick/expel design if maintainer prioritizes governance
Do NOT Soft L3 Fixed · Tor · Matrix · packaged Pass without seam
```
