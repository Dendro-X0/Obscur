# Transport Engine W55 — Standalone Legacy Deletion Charter

**Status:** Charter + contract pins (design-only; no file deletion)  
**Last updated:** 2026-06-26  
**Band:** ENGINE-LAB / transport-engine post-B5

## Goal

Define the **deletion gate and subtraction plan** for removing `transport-kernel-standalone-publish-legacy.ts` after host publish authority is validated, without deleting files in this wave.

W55 is design + contract only.

## Deletion gate (all required before W56+ execution)

| # | Requirement | Evidence |
|---|-------------|----------|
| 1 | W54 sign-off `Decision: PASS` | `docs/handoffs/transport-engine-smoke-sign-off-template.md` copied with evidence |
| 2 | W48 maintainer gate satisfied | `verify:transport-engine-w54` green on deletion commit |
| 3 | Authority routing validated | W50 port host path exercised in smoke |
| 4 | Network parity validated | W47 harness + W53 smoke per-relay evidence |
| 5 | Explicit maintainer approval | Recorded in handoff atomic step for W56 |

Until all five are met, deletion remains **BLOCKED**.

## Target subtraction (future W56+ execution)

When gate clears:

1. Remove `transport-kernel-standalone-publish-legacy.ts`.
2. Remove facade `transport-kernel-standalone-publish.ts` (or replace with host-only stub that errors if called).
3. Update `relay-standalone-publish-port.ts` — non-host fallback must not import deleted legacy module; host path becomes sole native publish owner when authority on; document rollback via env disable only.
4. Update contract tests and `verify:transport-engine-w*` pins that reference `-legacy.ts`.
5. Keep `mapLegacyPublishResultToRelayPublishResult` as sole semantics owner.

## Rollback policy

If deletion causes regression:

- Revert deletion commit; do not re-enable silent standalone fallback without maintainer sign-off.
- Authority/network env flags remain opt-in.

## Non-goals for W55

- No deletion of `-legacy.ts`, facade, or port import changes.
- No production authority/network default enablement.
- No automated deletion in CI.

## Contract expectations (pinned in w55 tests)

W55 tests must assert:

- This charter exists with five-part deletion gate.
- `-legacy.ts` and facade still on disk.
- Port still imports from `-legacy` for fallback branch.

## Sequencing after W55

- W56+ executes deletion only after W54 `Decision: PASS` is recorded in handoff.
- Transport-engine band may close with post-deletion verify gate update.
