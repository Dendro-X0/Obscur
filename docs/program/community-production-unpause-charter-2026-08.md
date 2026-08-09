# Community production un-pause charter (2026-08)

**Status:** **Active** — CU-P1 **Pass / Verified** 2026-08-09 (maintainer); follow-on = CU-EXIT or Tor bands  
**Kind:** Un-pause charter (modular-iteration § Integration study step 5)  
**Prior:** [community-unpause-integration-study-2026-07.md](../../specs/backend/community-unpause-integration-study-2026-07.md) · [community-membership-redesign-charter-2026-07.md](./community-membership-redesign-charter-2026-07.md) · [membership-graph-integration-study-2026-06.md](./membership-graph-integration-study-2026-06.md)  
**Soak matrix:** [community-production-soak-checklist-2026-08.md](../../specs/backend/community-production-soak-checklist-2026-08.md)

---

## Session gate

```text
HANDOFF ATOMIC STEP:  Community production soak CU-P1 (this charter)
PAUSED / CANCELLED:   AUTH-SESSION · Tor Verified · COM-RUN-02 restore · COM-RUN-01 live roster parity as product goal
BAND STATE:           Community = CHARTERED / SOAK-ACTIVE (not free-for-all)
CANONICAL OWNER:      workspace-kernel-membership-port · @obscur/workspace-engine · Slice C wraps · dm-engine invites
PROOF BEFORE DONE:    Packaged L3/L4 matrix stamped Pass|Fail in handoff
OUT OF SCOPE:         Tor · AUTH-SESSION · inventing U7 without investigation · Dev Lab as Pass
```

---

## Why un-pause now

| Evidence | Implication |
|----------|-------------|
| July U1–U6 **Done** (lab) | Persist / invite / Slice C / membership write / roster honesty / invite role landed |
| Integration study | Neighbors (DM / mesh / auth) safe enough to *receive* community if subtraction holds |
| Vault LES packaged soak **Pass** (2026-08-09) | Packaged shell is a valid L3 surface |
| Maintainer packaged note | Group chat usable on production installer (Tor OFF) — informal; needs matrix stamp |
| Dev Lab COM-MEM-2 scenario | **Tombstoned** — must not return as ship gate |

July study forbade **full-band** un-pause without an explicit maintainer charter naming **one** slice. This document is that charter.

---

## Band state after this charter

| Was | Now |
|-----|-----|
| Community **PAUSED** (no `groups/**` churn) | **CHARTERED / SOAK-ACTIVE** |
| Meaning | Agents may: (1) run soak matrix, (2) write investigation/design specs for soak failures, (3) implement **only** slices named in handoff Next Atomic Step |
| Still forbidden | Free `groups/**` patches · “fix roster” · COM-RUN-02 restore/repair · claiming community production-ready without matrix Pass |

**Claim language**

| May say | When |
|---------|------|
| Community soak **Pass** | CU-P1 matrix Pass on packaged or parity desktop |
| Community **Verified** | Soak Pass + handoff stamp date + no open P0 from matrix |
| Community production-ready | Explicit maintainer EXIT after Verified — **not** this charter alone |

---

## First slice — CU-P1 (only active work)

**Name:** Production community soak (packaged L3/L4)  
**Goal:** Replace tombstoned Dev Lab COM-MEM-2 with an honest packaged two-profile matrix.  
**Code:** **None** until a matrix row Fail produces an investigation spec and a follow-on slice id (CU-P2…).

| # | Action | Pass |
|---|--------|------|
| C1 | Two profiles unlock on packaged desktop | Both shells usable |
| C2 | Create community (or open existing) · both see it | Stable id; survives soft refresh |
| C3 | Invite → Accept (fresh invite) | Invitee joins; inviter Cancel (not dual Cancel) |
| C4 | Group text A→B and B→A | Delivery with evidence (not optimistic-only) |
| C5 | Soft refresh + lock/unlock | Thread still readable |
| C6 | Leave (one profile) | Leaver gone from own list; honest UX on peer |
| C7 | Profile isolation | No cross-profile community bleed |

**Transport rule for every row:** publish/ingest via **production relays** (public Nostr / user Settings), **not** Docker `localhost` lab relay. Docker remains allowed only for separate lab debugging and does not satisfy CU-P1.

Full table: [community-production-soak-checklist-2026-08.md](../../specs/backend/community-production-soak-checklist-2026-08.md).

**L1 (optional agent):** `pnpm verify:com-mem-2:contracts` — contracts only; does **not** satisfy CU-P1.

---

## Cancelled / forbidden goals (unchanged)

| Band | Status | Rule |
|------|--------|------|
| **COM-RUN-02** room-key restore/repair | **CANCELLED** | Do not reopen; Slice C action-time resolve only |
| **COM-RUN-01** live cross-profile roster parity | **Not a ship goal** | ACC-02 architecture; U5 honesty already landed — no parity patches |
| Dev Lab programmatic unlock / COM-MEM-2 scenario | Tombstoned | Never Pass evidence |
| Bare `db_*` group list/message on product path | Tombstoned (U2) | Do not re-warm |

---

## Interface contract (re-integration)

### Inputs

- Explicit `profileId`, member pubkey, `communityId` / `groupId`, relay policy via transport-kernel / mesh  
- Join/leave via `workspace-kernel-membership-port` only  
- Invite DM via `dm-engine` only  

### Outputs

- Directory + engine-backed group list/messages  
- Slice C wraps for room-key materialize on join/send  
- Honest UI when crypto/membership incomplete (no restore loops)

### Non-outputs

- Live roster parity as Pass criterion  
- Tor onion communities  
- AUTH-SESSION redesign  

### Neighbors that must not regress

| Neighbor | Owner | Proof if community work lands |
|----------|-------|-------------------------------|
| DM send/thread | `@obscur/dm-engine` | Existing DM L3 smoke |
| Relay pool / publish | conduit-mesh + transport-kernel | No browser-pool on native product |
| Auth cold / unlock | auth-kernel-boot | Unlock still works after community soak |
| Vault / LES | LES path | Vault Pass remains |

---

## Follow-on slices (not active until CU-P1 stamped)

Only after matrix Pass|Fail:

| Id | Trigger | Work |
|----|---------|------|
| **CU-P2** | C3 Fail (invite role) | Investigation → design; may touch invite UX only |
| **CU-P3** | C4 Fail (send/ingest) | Investigation; subtract parallel publish/hydrate — no COM-RUN-02 |
| **CU-P4** | Residue audit | Truth-map row 12 + leftover `db_*` / `group-provider` writers |
| **CU-EXIT** | Matrix Pass + no open P0 | Maintainer may claim Verified / plan version band |

Do **not** invent CU-P5+ without a new study if ≥3 failed iterations on the same Fail class.

---

## Agent rules under CHARTERED / SOAK-ACTIVE

| Allowed | Forbidden |
|---------|-----------|
| CU-P1 soak + handoff stamp | Feature churn in `groups/**` without named CU-P* step |
| Investigation/design specs for Fail rows | COM-RUN-01 parity “fixes” |
| Implement only when handoff Next Atomic = CU-P2+ with spec path | COM-RUN-02 restore/repair |
| Register / tracker updates | Claiming production-ready from U1–U6 lab alone |
| | Using Dev Lab as Pass |

---

## Handoff flip

| Field | Value |
|-------|--------|
| Community band | **CHARTERED / SOAK-ACTIVE** (this charter) |
| Next atomic | **CU-P1** maintainer packaged soak — stamp C1–C7 |
| Do not | Free `groups/**` · Tor Verified · AUTH-SESSION |

---

## References

| Doc | Role |
|-----|------|
| [community-unpause-integration-study-2026-07.md](../../specs/backend/community-unpause-integration-study-2026-07.md) | GO/NO-GO + U1–U6 |
| [v1.9.15-release.md](../releases/v1.9.15-release.md) | Tag honesty — community not in 1.9.15 claim |
| [12-core-architecture-truth-map.md](../encyclopedia/12-core-architecture-truth-map.md) | Owner row 12 |
| [modular-iteration-contract.md](./modular-iteration-contract.md) | Un-pause requires charter |
