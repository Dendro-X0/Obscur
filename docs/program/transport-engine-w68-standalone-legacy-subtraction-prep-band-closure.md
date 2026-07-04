# Transport Engine W68 — Standalone Legacy Subtraction Prep Band Closure

**Status:** Prep band w55–w67 **complete**; maintainer execution **BLOCKED** (sign-off `BLOCKED`)  
**Last updated:** 2026-06-26  
**Band:** ENGINE-LAB / transport-engine post-B5 — **PAUSED** awaiting W53 smoke

## Goal

Close the **gate-closed prep band** (w55–w67) with a consolidated readiness report. No further prep waves until W53 desktop smoke sign-off.

## Prep band closure policy (pinned)

| Module | Role |
|--------|------|
| `transport-kernel-standalone-deletion-subtraction-prep-band-closure.ts` | Prep band metadata |
| `transport-kernel-standalone-deletion-subtraction-prep-band-closure-readiness.ts` | Consolidated readiness |
| `scripts/verify-standalone-legacy-subtraction-prep.mjs` | Maintainer prep report (read-only) |

`evaluateStandaloneLegacySubtractionPrepBandClosure` returns `prepBandComplete: true` when all w55–w67 pre-commit baselines are green and post-subtraction exit is not yet complete.

## Current state (W68)

- Sign-off recorded file: `Decision: BLOCKED`.
- Prep band: **complete** (`prepBandComplete: true`).
- Maintainer execution: **blocked** (`readyForMaintainerExecution: false`).

## Maintainer execution (when gate opens — no w69+ prep)

1. Complete W53 desktop smoke; update sign-off to `Decision: PASS`.
2. Set `NEXT_PUBLIC_OBSCUR_TRANSPORT_STANDALONE_LEGACY_DELETION_APPROVED=1`.
3. `node scripts/execute-transport-standalone-legacy-subtraction.mjs` → exit 0.
4. Execute W66 mechanical commit + W67 B5 exit per charters.
5. `pnpm verify:transport-engine-w68` then `pnpm verify:engine-lab`.

## Non-goals for W68

- No file deletion while sign-off is `BLOCKED`.
- No additional gate-closed prep waves (w69+).
- No production default for deletion approval env.

## Contract expectations (pinned in w68 tests)

W68 tests must assert:

- This charter exists with prep band closure policy.
- `prepBandComplete` is true while legacy files remain.
- `readyForMaintainerExecution` is false until gate opens.
- Production legacy files remain on disk while gate is closed.
