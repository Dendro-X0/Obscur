# Obscur subtraction register — community UX gates (2026-07)

**Purpose:** Single map of what was removed, what was aligned, and what stays **deferred** until the community crypto charter picks a slice. CodaCtrl diagnoses drift; this register is the maintainer source of truth for code subtraction.

**Charter:** [community-membership-redesign-charter-2026-07.md](./community-membership-redesign-charter-2026-07.md)  
**Investigation:** [obscur-ux-gate-investigation-2026-07.md](./obscur-ux-gate-investigation-2026-07.md)  
**FLS (static gate):** `.codactrl/logic/obscur-community-membership.v1.json` · `pnpm verify:fls-alignment`

---

## Maintainer bands

| Band | Status | Action |
|------|--------|--------|
| COM-RUN-02 room-key restore / UX gates | **CANCELLED** | Subtract owners; no new repair loops |
| COM-RUN-01 roster parity | **PAUSED** | No reconcile patches |
| Community crypto redesign | **Charter only** | Pick slice A–D before new owners |

---

## Removed (2026-07-03 subtraction closeout)

| Artifact | Why |
|----------|-----|
| `room-key-restore-repair.ts` (+ test) | COM-RUN-02 cancelled — silent repair on restore/load |
| `restore-materialization.ts` repair calls | Same band — backup still applies explicit `roomKeys` snapshots |
| `community-membership-ui-action-policy.ts` (+ test) | Dead indirection (`always false`); navigation gates subtracted at call sites |
| `community-membership-health-banner.tsx` | Never imported — orphan UI |

---

## Aligned (feasible design)

| Owner | Change |
|-------|--------|
| `community-membership-health.ts` | `room_key_missing` = **telemetry/diagnostic** only; `ready` + `chatEnabled` ignore it |
| `community-membership-health-copy.ts` | Summary may append key warning; no primary action title from missing key |
| `use-community-membership-health.ts` | No auto repair; no `chatActionDisabled` / `inviteActionDisabled` exports |
| Group home / invite UI (prior slice) | Chat + invite not `disabled` on local key absence |

**Invariant (FLS):** Local room key presence must not block navigation (`INV-COMM-001`). Send/accept may still fail honestly at action time when crypto is required (`INV-COMM-003`).

---

## Deferred — do not patch without charter slice

| Artifact | Issue | Notes |
|----------|-------|-------|
| `workspace-kernel-membership-port.ts` | Join hard-fails on `room_key_missing` | Charter slice B/C — crypto at join vs send |
| `community-sendability-guard.ts` | Test-only; not wired to composer | Correct *pattern* (action-time) but owner TBD |
| RIW-1 ledger validation | 7/7 invalid on fixture | Separate band — not UX-gate subtraction |
| COM-RUN-11 invite lifecycle | Blocked invites | Separate band |
| COM-RUN-01 roster | `community-roster-divergence` | **PAUSED** |

---

## Proof layers (this band)

| Layer | Command |
|-------|---------|
| L1 static | `pnpm verify:fls-alignment` |
| L1 unit | `community-membership-health.test.ts` |
| L3 desktop | NewTest 2 — invite/chat navigation ✅; send honest-fail without local key ⚠️ (2026-07-03 soak) |

---

## What CodaCtrl is / is not

- **Is:** Symptom register, digest import, FLS static scan, trace guidance for triage.
- **Is not:** Architecture fixer, charter picker, or proof that runtime behavior matches feasible goals without maintainer subtraction + L3 soak.

When lost: read this register → handoff atomic step → charter — not the Verify tab symptom count alone.
