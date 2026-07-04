# Transport Engine W60 — Standalone Legacy Mechanical Deletion Preparation

**Status:** Legacy archive pinned; mechanical deletion **BLOCKED** (sign-off `BLOCKED`)  
**Last updated:** 2026-06-26  
**Band:** ENGINE-LAB / transport-engine post-B5

## Goal

Prepare the **mechanical subtraction commit** by freezing standalone publish semantics in an engine-lab archive and adding contract-pin resolution. Physical production file deletion runs only when `evaluateStandaloneLegacySubtractionDryRun` reports `readyForPhysicalDeletion: true`.

## Archive policy (pinned)

| Path | Role |
|------|------|
| `transport-kernel-standalone-publish-legacy.ts` | Production owner (deleted in W61+ when gate opens) |
| `engine-lab/fixtures/transport-kernel-standalone-publish-legacy.archive.ts` | Frozen W60 archive for historical contract pins |
| `transport-kernel-standalone-deletion-contract-pins.ts` | `resolveStandaloneLegacyContractReadPath()` |

Dry-run baseline now requires **both** production legacy files and the archive fixture before deletion.

## Current state (W60)

- Sign-off recorded file: `Decision: BLOCKED`.
- Archive fixture present; dry-run baseline ready except gate.
- Production legacy files and port import **preserved**.

## Maintainer mechanical deletion when gate opens (W61+)

1. Update recorded sign-off with W53 smoke evidence + `Decision: PASS`.
2. Set `NEXT_PUBLIC_OBSCUR_TRANSPORT_STANDALONE_LEGACY_DELETION_APPROVED=1`.
3. Confirm dry-run `readyForPhysicalDeletion` is `true`.
4. Delete `STANDALONE_LEGACY_FILES_TO_DELETE`; remove legacy import from port.
5. Migrate engine-lab contracts to `resolveStandaloneLegacyContractReadPath(false)` / archive path.
6. Run `verify:transport-engine-w60` then `verify:engine-lab`.

## Non-goals for W60

- No deletion of production `-legacy.ts` or facade while sign-off is `BLOCKED`.
- No production default for deletion approval env.

## Contract expectations (pinned in w60 tests)

W60 tests must assert:

- This charter exists with archive and contract-pin resolver.
- Archive fixture mirrors production legacy semantics tokens.
- Dry-run requires archive present; gate still closed.
- Production legacy files remain on disk.
