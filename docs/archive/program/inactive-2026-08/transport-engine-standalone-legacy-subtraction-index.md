# Transport Engine — Standalone Legacy Subtraction Index

**Status:** Prep band **complete** (w55–w68); execution **PAUSED** — sign-off `Decision: BLOCKED`  
**Last updated:** 2026-06-26  
**Band:** ENGINE-LAB / transport-engine post-B5

## Summary

Gate-closed preparation for deleting `transport-kernel-standalone-publish-legacy.ts` is **complete**. Physical deletion and contract pin flips remain **maintainer-only** until W53 desktop smoke sign-off.

| State | Value |
|-------|-------|
| Prep band | w55–w68 **closed** |
| Sign-off | `docs/handoffs/transport-engine-smoke-sign-off-recorded.md` → `BLOCKED` |
| Production legacy | **On disk** (required while gate closed) |
| Next action | W53 smoke → `PASS` + deletion env → W66 commit → W67 B5 exit |
| Runbook | [transport-engine-w53-maintainer-smoke-runbook.md](./transport-engine-w53-maintainer-smoke-runbook.md) |

## Verify gates

```bash
pnpm verify:transport-engine-w68    # canonical flat gate (w0–w68)
pnpm verify:standalone-legacy-subtraction-prep   # read-only prep report
pnpm verify:engine-lab              # includes w68
```

`verify:transport-engine-w55` through `w67` are backward-compatible aliases to the same flat script.

Maintainer execution gate (refuses until `PASS` + env):

```bash
node scripts/execute-transport-standalone-legacy-subtraction.mjs
```

## Wave index (w55–w68)

| Wave | Charter | Role |
|------|---------|------|
| w55 | [deletion charter](./transport-engine-w55-standalone-legacy-deletion-charter.md) | Five-part deletion gate (design) |
| w56 | [deletion execution](./transport-engine-w56-standalone-legacy-deletion-execution.md) | `isStandaloneLegacyDeletionApproved` |
| w57 | [deletion subtraction](./transport-engine-w57-standalone-legacy-deletion-subtraction.md) | Fail-closed blocked path |
| w58 | [file deletion execution](./transport-engine-w58-standalone-legacy-file-deletion-execution.md) | Subtraction manifest |
| w59 | [physical deletion execution](./transport-engine-w59-standalone-legacy-physical-deletion-execution.md) | Dry-run baseline |
| w60 | [mechanical deletion prep](./transport-engine-w60-standalone-legacy-mechanical-deletion-preparation.md) | Archive fixture |
| w61 | [production deletion execution](./transport-engine-w61-standalone-legacy-production-deletion-execution.md) | Archive-aware contract reads |
| w62 | [mechanical production subtraction](./transport-engine-w62-standalone-legacy-mechanical-production-subtraction.md) | Subtracted port module |
| w63 | [port swap rehearsal](./transport-engine-w63-standalone-legacy-port-swap-rehearsal.md) | Delegation to subtracted port |
| w64 | [production deletion execution](./transport-engine-w64-standalone-legacy-production-deletion-execution.md) | Thin port template |
| w65 | [existence pin migration](./transport-engine-w65-standalone-legacy-existence-pin-migration.md) | w55–w64 pin inventory |
| w66 | [mechanical subtraction commit](./transport-engine-w66-standalone-legacy-mechanical-subtraction-commit.md) | Ordered maintainer commit |
| w67 | [B5 exit verification](./transport-engine-w67-standalone-legacy-b5-exit-verification.md) | Post-subtraction exit criteria |
| w68 | [prep band closure](./transport-engine-w68-standalone-legacy-subtraction-prep-band-closure.md) | Consolidated readiness; **no w69+ prep** |

## Key modules

| Module | Role |
|--------|------|
| `transport-kernel-standalone-deletion-subtraction-manifest.ts` | Files to delete, ports to update |
| `transport-kernel-standalone-deletion-subtraction-dry-run.ts` | Pre-deletion baseline |
| `transport-kernel-standalone-deletion-post-subtraction-baseline.ts` | Post-deletion verification |
| `transport-kernel-standalone-deletion-subtraction-prep-band-closure-readiness.ts` | Consolidated prep report |
| `relay-standalone-publish-port-subtracted.ts` | Post-deletion routing owner |
| `relay-standalone-publish-port-thin.ts` | Frozen port body after deletion |
| `engine-lab/fixtures/transport-kernel-standalone-publish-legacy.archive.ts` | Frozen semantics for contracts |

## Maintainer execution (when gate opens)

1. W53 smoke → update sign-off to `Decision: PASS`
2. `NEXT_PUBLIC_OBSCUR_TRANSPORT_STANDALONE_LEGACY_DELETION_APPROVED=1`
3. `execute-transport-standalone-legacy-subtraction.mjs` exits 0
4. Delete `STANDALONE_LEGACY_FILES_TO_DELETE`; copy thin port; flip w55–w64 pins
5. Confirm `postSubtractionComplete` + `readyForB5ExitVerification`
6. `pnpm verify:transport-engine-w68 && pnpm verify:engine-lab`
