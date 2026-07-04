# Transport Engine W67 — Standalone Legacy B5 Exit Verification

**Status:** B5 exit criteria pinned; exit **BLOCKED** (sign-off `BLOCKED`; W66 not executed)  
**Last updated:** 2026-06-26  
**Band:** ENGINE-LAB / transport-engine post-B5

## Goal

Pin **B5 exit verification criteria** for the standalone legacy subtraction band so maintainer completion is objectively verifiable via `evaluateStandaloneLegacyB5ExitReadiness` after W66 mechanical commit.

## B5 exit policy (pinned)

| Module | Role |
|--------|------|
| `transport-kernel-standalone-deletion-b5-exit.ts` | Exit criteria list |
| `transport-kernel-standalone-deletion-b5-exit-readiness.ts` | Pre/post exit readiness |
| `transport-kernel-standalone-deletion-post-subtraction-baseline.ts` | `postSubtractionComplete` owner |

`readyForB5ExitVerification: true` only when `postSubtractionComplete` is true and preserved owners remain on disk.

## B5 exit criteria (pinned)

1. `STANDALONE_LEGACY_FILES_TO_DELETE` absent from disk.
2. `relay-standalone-publish-port` omits `transport-kernel-standalone-publish-legacy`.
3. `STANDALONE_LEGACY_ARCHIVE_PATH` present on disk.
4. `STANDALONE_LEGACY_SEMANTICS_OWNER_PRESERVED` present on disk.
5. `evaluateStandaloneLegacyPostSubtractionBaseline` → `postSubtractionComplete: true`.
6. Run `verify:transport-engine-w67` then `verify:engine-lab`.

## Current state (W67)

- Sign-off recorded file: `Decision: BLOCKED`.
- Pre-exit baseline: **ready** (`preExitBaselineReady: true`).
- B5 exit: **not complete** (`postSubtractionExitComplete: false`).

## Maintainer B5 exit when gate opens

1. Complete W66 mechanical subtraction commit.
2. Confirm `evaluateStandaloneLegacyB5ExitReadiness` → `readyForB5ExitVerification: true`.
3. Run `verify:transport-engine-w67` then `verify:engine-lab`.

## Non-goals for W67 (gate closed)

- No B5 exit claim while sign-off is `BLOCKED`.
- No file deletion or pin flip in CI.
- No production default for deletion approval env.

## Contract expectations (pinned in w67 tests)

W67 tests must assert:

- This charter exists with B5 exit criteria.
- `preExitBaselineReady` is true while legacy files remain.
- `readyForB5ExitVerification` is false until post-subtraction baseline completes.
- Production legacy files remain on disk while gate is closed.
