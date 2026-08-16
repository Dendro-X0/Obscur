# Transport Engine W59 — Standalone Legacy Physical Deletion Execution

**Status:** Subtraction dry-run baseline green; physical deletion **BLOCKED** (sign-off `BLOCKED`)  
**Last updated:** 2026-06-26  
**Band:** ENGINE-LAB / transport-engine post-B5

## Goal

Validate the **pre-deletion baseline** via dry-run evaluation so the maintainer subtraction commit is a single mechanical step when the W56 gate opens. Physical file deletion remains blocked until `Decision: PASS` + deletion approval env.

## Dry-run policy (pinned)

`evaluateStandaloneLegacySubtractionDryRun(signOffMarkdown, fs)` returns `readyForPhysicalDeletion: true` only when **both**:

1. `isStandaloneLegacyDeletionApproved(signOffMarkdown)` — PASS sign-off + `NEXT_PUBLIC_OBSCUR_TRANSPORT_STANDALONE_LEGACY_DELETION_APPROVED=1`
2. Baseline checks pass — legacy files present, port imports legacy, post-deletion owners present, semantics owner present, manifest contract/unit pins on disk

## Current state (W59)

- Sign-off recorded file: `Decision: BLOCKED`.
- Dry-run baseline: **ready** (all pre-deletion checks green).
- Gate closed — no file deletion, port unchanged.

## Maintainer physical deletion when gate opens (W60+)

1. Update `transport-engine-smoke-sign-off-recorded.md` with W53 smoke evidence + `Decision: PASS`.
2. Set `NEXT_PUBLIC_OBSCUR_TRANSPORT_STANDALONE_LEGACY_DELETION_APPROVED=1` in maintainer build.
3. Confirm dry-run `readyForPhysicalDeletion` is `true`.
4. Delete files in `STANDALONE_LEGACY_FILES_TO_DELETE`; update port and contract tests per manifest.
5. Run `verify:transport-engine-w59` then `verify:engine-lab`.

## Non-goals for W59

- No deletion of `-legacy.ts` or facade while sign-off is `BLOCKED`.
- No production default for deletion approval env.
- No automated deletion in CI.

## Contract expectations (pinned in w59 tests)

W59 tests must assert:

- This charter exists with dry-run module reference.
- Dry-run baseline is ready while gate is closed.
- `readyForPhysicalDeletion` is `false` until sign-off PASS + env.
- Legacy files remain on disk.
