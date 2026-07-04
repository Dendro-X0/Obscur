# Transport Engine W66 — Standalone Legacy Mechanical Subtraction Commit

**Status:** Mechanical subtraction commit manifest pinned; execution **BLOCKED** (sign-off `BLOCKED`)  
**Last updated:** 2026-06-26  
**Band:** ENGINE-LAB / transport-engine post-B5

## Goal

Unify **W64 file deletion**, **thin port copy**, and **W65 pin flip** into a single maintainer mechanical subtraction commit when `execute-transport-standalone-legacy-subtraction.mjs` exits 0.

## Mechanical commit policy (pinned)

| Module | Role |
|--------|------|
| `transport-kernel-standalone-deletion-mechanical-subtraction-commit.ts` | Ordered commit steps |
| `transport-kernel-standalone-deletion-mechanical-subtraction-commit-readiness.ts` | Pre/post commit readiness |
| `scripts/execute-transport-standalone-legacy-subtraction.mjs` | Maintainer gate script |

`evaluateStandaloneLegacyMechanicalSubtractionCommitReadiness` returns `readyForMechanicalSubtractionCommit: true` only when sign-off PASS + deletion env **and** full pre-commit baseline is green.

## Ordered commit steps (pinned)

1. `execute-transport-standalone-legacy-subtraction.mjs` exits 0.
2. Delete `STANDALONE_LEGACY_FILES_TO_DELETE`.
3. Copy `relay-standalone-publish-port-thin.ts` into `relay-standalone-publish-port.ts`.
4. Remove or retarget `transport-kernel-standalone-publish.test.ts`.
5. Migrate `STANDALONE_LEGACY_GATE_CLOSED_EXISTENCE_PIN_CONTRACTS`.
6. Confirm `evaluateStandaloneLegacyPostSubtractionBaseline` → `postSubtractionComplete: true`.
7. Run `verify:transport-engine-w67` then `verify:engine-lab`.

## Current state (W66)

- Sign-off recorded file: `Decision: BLOCKED`.
- Pre-commit baseline: **ready** (`preCommitBaselineReady: true`).
- Mechanical commit: **not executed** (`postSubtractionComplete: false`).

## Non-goals for W66 (gate closed)

- No file deletion while sign-off is `BLOCKED`.
- No port swap or pin flip in CI.
- No production default for deletion approval env.

## Contract expectations (pinned in w66 tests)

W66 tests must assert:

- This charter exists with mechanical commit steps.
- `preCommitBaselineReady` is true while legacy files remain.
- `readyForMechanicalSubtractionCommit` is false until gate opens.
- Production legacy files remain on disk while gate is closed.
