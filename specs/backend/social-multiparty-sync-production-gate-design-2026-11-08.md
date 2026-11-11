# Design — Multiparty social sync production gate (2026-11-08)

```text
Investigation: specs/backend/social-multiparty-sync-production-gate-investigation-2026-11-08.md
Parent charter: specs/backend/2026-11-07-social-relationship-lifecycle-unified-design.md
PAUSED: Soft L3 Fixed · Tor · Matrix · Continuity · A4
```

## Goal

Ship the next **public production** release only when social planes below are **Pass** on the release surface — multiparty sync of relationships, entitled history, and mappings — while keeping E2EE / private-trust / no OAuth-as-root.

## Gate definition

```text
PRODUCTION SOCIAL SYNC GATE = P1 ∧ P2 ∧ P3 ∧ P4
  on SURFACE = packaged desktop (or maintainer-approved equivalent dual-party proof)
  with claim language: "multiparty social sync Pass" ≠ Soft L3 Fixed ≠ Tor Verified
```

| Plane | Release claim | Minimum proof |
|-------|---------------|---------------|
| **P1 Relationship graph** | Contact accept/remove, block/unblock, invite/leave (and kick if in-scope) converge for both parties after wire+apply | Dual-party L2 per action on release surface; Soft L3 L2 already landed for block/leave/invite — **re-prove or waive with evidence** on public/packaged |
| **P2 Interaction history** | After mutual DM (and in-scope group ciphertext), both sides reload to the same entitled message set (ids/order within tolerance) | Dual CDP history assert + named hydrate/SQLite/projection owners; repair path honest if incomplete |
| **P3 Mapping projections** | No silent “A sees edge / B does not” without outbox; drift codes logged or healed via existing owners | relationship-sync drift asserts on leave/invite soaks; subtract dual-readers that resurrect |
| **P4 Failure honesty** | Wire fail → pending/outbox UI; local sticky retained; no false “synced” toast | L1 unit + L2 fault injection (relay down / publish fail) for at least one DM + one membership path |

## Contract (unchanged from lifecycle charter)

```text
User intent
  → Local sticky commit
  → Wire intent (best-effort; existing tags / membership publish)
  → Peer apply (idempotent)
  → Outbox honesty if pending/failed
  → One read authority per domain
```

**Sync completeness** adds:

```text
After peer apply (or honest outbox):
  → Entitled history reconstructible on both sides (P2)
  → Projection authorities agree or report drift (P3)
  → Release-surface dual-party proof, not lab-only (P1 surface clause)
```

## Work packages (sequenced; one atomic step each)

### WP0 — Register gate (this design)

Land investigation+design · set `current-session` NEXT to WP1 · no code.

### WP1 — P1 release-surface matrix

1. Table every relationship mutation: Soft L3 L2 status · public-relay owed · packaged owed
2. For each **owed**: either dual CDP soak **or** documented waiver with residual risk
3. Kick/expel / invite-revoke: **in-scope or explicit non-goal** for this release (decide in WP1 writeup)

**Exit:** `social-sync-p1-release-matrix-*.md` with Pass/Partial/Waive per action.

### WP2 — P2 DM history convergence

1. Investigation: current one-sided SQLite / hydrate / projection owners (reuse parked notes)
2. Design smallest heal: prefer subtraction + existing `native-dm-sqlite-repair` / projection gap-fill — no new history bus
3. L1 unit · L2 dual CDP: A↔B N messages → reload both → id-set equality (or documented partial + repair CTA)

**Exit:** DM history multiparty Pass (or Partial with honest CTA — maintainer cut required for Partial ship).

### WP3 — P3 drift → product assert

1. Wire leave/invite L2 (and block if useful) to fail soak on high-severity drift codes
2. Heal only via existing membership/trust owners — experiment stays detector unless design promotes a single heal owner

**Exit:** drift-gated soaks green on Soft L3; public-relay optional follow-on.

### WP4 — P4 outbox honesty slice

1. Inventory mutation paths missing pending/failed chrome
2. One DM + one membership path to production honesty bar
3. L1 · L2 fault injection

### WP5 — Packaged / NSIS dual-party proof

Depends on `packaged-nsis-lab-cdp-seam` design. Until seam exists: maintainer may accept **scripted L3** dual install as substitute — must be written in WP1 matrix, not implied.

## Explicit non-goals (this gate)

- Soft L3 Fixed (hung dial / unlock stampede)
- Tor Verified · Matrix promote
- Continuity / multi-device same-pubkey sync (unless WP1 pulls a narrow slice)
- Single global relationship event log
- New relay publish dual-owner
- Claiming gate Pass from Soft L3 Slice 1–3 alone

## Claim language

| Phrase | Allowed when |
|--------|----------------|
| Multiparty social sync **charter** | This design + investigation committed |
| Plane Pn **Pass** | Named L1+L2 (or L3 packaged) for that plane |
| Multiparty social sync **Pass** | P1∧P2∧P3∧P4 on release surface |
| Ready for public production (social) | Gate Pass + unrelated cut items (signing, updater, …) per release checklist |

## Handoff next atomic step

```text
WP1 LANDED: specs/backend/social-sync-p1-release-matrix-2026-11-08.md
NEXT: P1-O1 — Public Default Stable dual CDP re-prove Block lifecycle
Do NOT Soft L3 Fixed · Tor · Matrix · Continuity as synonym for this gate
```
