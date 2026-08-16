# Transport Engine W65 — Standalone Legacy Gate-Closed Existence Pin Migration

**Status:** Existence pin migration manifest pinned; physical deletion **BLOCKED** (sign-off `BLOCKED`)  
**Last updated:** 2026-06-26  
**Band:** ENGINE-LAB / transport-engine post-B5

## Goal

Pin the **gate-closed existence contract inventory** and **post-subtraction pin flip policy** so the maintainer subtraction commit includes a mechanical contract migration step when `execute-transport-standalone-legacy-subtraction.mjs` exits 0.

## Existence pin policy (pinned)

| Module | Role |
|--------|------|
| `transport-kernel-standalone-deletion-existence-pin-migration.ts` | Lists w55–w64 gate-closed existence pin contracts |
| `transport-kernel-standalone-deletion-existence-pin-migration-readiness.ts` | Validates pin contracts assert gate-closed state while legacy remains |

Pin contracts (w55–w64) assert production legacy files on disk and/or port legacy import while gate is closed.

## Post-subtraction pin flip (maintainer, W66+)

When legacy files are deleted:

1. Flip `existsSync(...legacy...).toBe(true)` → `toBe(false)` or assert via `evaluateStandaloneLegacyPostSubtractionBaseline`.
2. Flip port legacy import pins → thin port / subtracted module tokens.
3. Semantic read pins already use `resolveTransportEngineStandaloneLegacyReadPath` (w61) — no per-wave edits required.
4. Confirm `evaluateStandaloneLegacyExistencePinMigrationReadiness` was green pre-subtraction; re-run after flip.

## Current state (W65)

- Sign-off recorded file: `Decision: BLOCKED`.
- Ten gate-closed existence pin contracts inventoried (w55–w64).
- Production `-legacy.ts`, facade, and port legacy import **preserved**.

## Maintainer mechanical subtraction when gate opens

1. Complete W64 subtraction steps (delete files, copy thin port).
2. Migrate gate-closed existence pins per `STANDALONE_LEGACY_GATE_CLOSED_EXISTENCE_PIN_CONTRACTS`.
3. Confirm `evaluateStandaloneLegacyPostSubtractionBaseline` → `postSubtractionComplete: true`.
4. Run `verify:transport-engine-w65` then `verify:engine-lab`.

## Non-goals for W65 (gate closed)

- No pin flip while sign-off is `BLOCKED`.
- No deletion of production legacy files.
- No automated contract rewrite in CI.

## Contract expectations (pinned in w65 tests)

W65 tests must assert:

- This charter exists with existence pin migration policy.
- All ten pin contracts are present and contain gate-closed markers.
- `readyForPinFlipAfterSubtraction` is true while legacy files remain.
- Production legacy files remain on disk while gate is closed.
