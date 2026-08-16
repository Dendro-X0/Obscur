# Transport Engine W58 — Standalone Legacy File Deletion Execution

**Status:** Subtraction manifest pinned; physical deletion **BLOCKED** (sign-off `BLOCKED`)  
**Last updated:** 2026-06-26  
**Band:** ENGINE-LAB / transport-engine post-B5

## Goal

Pin the **complete subtraction manifest** for removing `transport-kernel-standalone-publish-legacy.ts` and its facade. Physical file deletion runs only when the W56 gate opens (`Decision: PASS` + deletion approval env).

## Gate policy (unchanged from W56)

`isStandaloneLegacyDeletionApproved(signOffMarkdown)` requires **both**:

1. `docs/handoffs/transport-engine-smoke-sign-off-recorded.md` → `**Decision:** PASS`
2. `NEXT_PUBLIC_OBSCUR_TRANSPORT_STANDALONE_LEGACY_DELETION_APPROVED=1`

## Subtraction manifest (pinned in code)

Module: `transport-kernel-standalone-deletion-subtraction-manifest.ts`

| Category | Action |
|----------|--------|
| Files to delete | `-legacy.ts`, facade `transport-kernel-standalone-publish.ts` |
| Port update | `relay-standalone-publish-port.ts` — remove legacy import; host + blocked paths only |
| Unit tests | Migrate `transport-kernel-standalone-publish.test.ts` (remove or retarget) |
| Engine-lab contracts | Migrate w14–w57 pins that read/mock `-legacy.ts` |
| Preserved | `publish-outcome-mapper.ts` quorum semantics owner |

## Current state (W58)

- Sign-off recorded file: `Decision: BLOCKED`.
- Gate closed — legacy files and port import **preserved**.
- Manifest module added for maintainer subtraction commit.

## Maintainer execution when gate opens (W59+)

1. Update recorded sign-off with W53 smoke evidence + `Decision: PASS`.
2. Set `NEXT_PUBLIC_OBSCUR_TRANSPORT_STANDALONE_LEGACY_DELETION_APPROVED=1` in maintainer build.
3. Delete files listed in manifest `STANDALONE_LEGACY_FILES_TO_DELETE`.
4. Update port and contract tests per manifest lists.
5. Run `verify:transport-engine-w58` then `verify:engine-lab`.

## Non-goals for W58

- No deletion of `-legacy.ts` or facade while sign-off is `BLOCKED`.
- No production default for deletion approval env.
- No automated deletion in CI.

## Contract expectations (pinned in w58 tests)

W58 tests must assert:

- This charter exists with manifest module reference.
- Manifest lists deletion targets, port paths, and preserved semantics owner.
- Legacy files remain on disk while gate is closed.
- Recorded sign-off shows `BLOCKED`.
