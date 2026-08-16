# Transport Engine W61 — Standalone Legacy Production Deletion Execution

**Status:** Contract pins archive-aware; production deletion **BLOCKED** (sign-off `BLOCKED`)  
**Last updated:** 2026-06-26  
**Band:** ENGINE-LAB / transport-engine post-B5

## Goal

Migrate engine-lab contract **read pins** to `resolveTransportEngineStandaloneLegacyReadPath()` so historical wave tests survive production file deletion without per-wave edits. Physical deletion runs only when dry-run reports `readyForPhysicalDeletion: true`.

## Contract read policy (pinned)

| Module | Role |
|--------|------|
| `transport-engine-standalone-legacy-contract-read.ts` | Disk-aware resolver for contract file reads |
| `transport-kernel-standalone-deletion-contract-pins.ts` | Production vs archive path selection |
| `engine-lab/fixtures/transport-kernel-standalone-publish-legacy.archive.ts` | Frozen semantics after deletion |

Contracts that assert **production files on disk** (w55–w60 gate-closed pins) remain unchanged until w62+ subtraction.

## Current state (W61)

- Sign-off recorded file: `Decision: BLOCKED`.
- Production `-legacy.ts`, facade, and port legacy import **preserved**.
- Semantic read pins migrated to archive-aware resolver.

## Maintainer mechanical subtraction when gate opens (W62+)

1. Update recorded sign-off with W53 smoke evidence + `Decision: PASS`.
2. Set `NEXT_PUBLIC_OBSCUR_TRANSPORT_STANDALONE_LEGACY_DELETION_APPROVED=1`.
3. Confirm `evaluateStandaloneLegacySubtractionDryRun` → `readyForPhysicalDeletion: true`.
4. Delete `STANDALONE_LEGACY_FILES_TO_DELETE`; remove legacy import from port.
5. Update gate-closed existence pins; run `verify:transport-engine-w61` then `verify:engine-lab`.

## Non-goals for W61

- No deletion of production `-legacy.ts` or facade while sign-off is `BLOCKED`.
- No production default for deletion approval env.

## Contract expectations (pinned in w61 tests)

W61 tests must assert:

- This charter exists with archive-aware contract read policy.
- Resolver returns production path while legacy files exist.
- Resolver would return archive path when production files are absent (simulated).
- Production legacy files remain on disk while gate is closed.
