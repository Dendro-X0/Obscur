# Transport Engine W64 — Standalone Legacy Production Deletion Execution

**Status:** Thin port template + post-subtraction baseline pinned; physical deletion **BLOCKED** (sign-off `BLOCKED`)  
**Last updated:** 2026-06-26  
**Band:** ENGINE-LAB / transport-engine post-B5

## Goal

Pin the **post-subtraction thin port template** and **post-subtraction baseline evaluator** so the maintainer deletion commit is a mechanical swap when `execute-transport-standalone-legacy-subtraction.mjs` exits 0.

## Thin port policy (pinned)

| Module | Role |
|--------|------|
| `relay-standalone-publish-port-thin.ts` | Frozen post-deletion port body (re-exports from subtracted) |
| `relay-standalone-publish-port-subtracted.ts` | Post-deletion routing owner (host + fail-closed blocked) |
| `transport-kernel-standalone-deletion-post-subtraction-baseline.ts` | Verifies repo state after subtraction |

Thin port must omit `transport-kernel-standalone-publish-legacy` import.

## Current state (W64)

- Sign-off recorded file: `Decision: BLOCKED`.
- Production `-legacy.ts`, facade, and current port legacy import **preserved**.
- Thin port template ready for copy into `relay-standalone-publish-port.ts`.

## Maintainer mechanical subtraction when gate opens

1. Confirm `node scripts/execute-transport-standalone-legacy-subtraction.mjs` exits 0.
2. Delete `STANDALONE_LEGACY_FILES_TO_DELETE`.
3. Replace `relay-standalone-publish-port.ts` with contents of `relay-standalone-publish-port-thin.ts`.
4. Remove or retarget `transport-kernel-standalone-publish.test.ts`.
5. Update gate-closed existence contract pins (w55–w63).
6. Confirm `evaluateStandaloneLegacyPostSubtractionBaseline` → `postSubtractionComplete: true`.
7. Run `verify:transport-engine-w64` then `verify:engine-lab`.

## Non-goals for W64 (gate closed)

- No deletion of production `-legacy.ts` or facade while sign-off is `BLOCKED`.
- No production port swap while gate is closed.
- No production default for deletion approval env.

## Contract expectations (pinned in w64 tests)

W64 tests must assert:

- This charter exists with thin port template reference.
- Thin port re-exports subtracted module without legacy import.
- Post-subtraction baseline is incomplete while legacy files remain.
- Pre-deletion dry-run includes thin port template readiness.
- Production legacy files remain on disk while gate is closed.
