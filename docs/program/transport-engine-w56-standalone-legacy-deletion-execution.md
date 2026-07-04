# Transport Engine W56 — Standalone Legacy Deletion Execution

**Status:** Gate implemented; subtraction **BLOCKED** (no `Decision: PASS` sign-off)  
**Last updated:** 2026-06-26  
**Band:** ENGINE-LAB / transport-engine post-B5

## Goal

Implement the **deletion execution gate** for W55 subtraction. File deletion runs only when the gate opens; default remains blocked.

## Gate policy (pinned)

`isStandaloneLegacyDeletionApproved(signOffMarkdown)` returns `true` only when **both**:

1. Recorded sign-off contains `**Decision:** PASS` — `docs/handoffs/transport-engine-smoke-sign-off-recorded.md`
2. `NEXT_PUBLIC_OBSCUR_TRANSPORT_STANDALONE_LEGACY_DELETION_APPROVED=1` — explicit maintainer env

## Current state (W56)

- Sign-off recorded file exists with `Decision: BLOCKED`.
- Gate is **closed** — no file deletion, port unchanged.
- `-legacy.ts`, facade, and port fallback imports preserved.

## Execution steps when gate opens (W57+ maintainer commit)

1. Update `transport-engine-smoke-sign-off-recorded.md` with smoke evidence + `Decision: PASS`.
2. Set deletion approval env in maintainer build only.
3. Delete `transport-kernel-standalone-publish-legacy.ts` and facade.
4. Update `relay-standalone-publish-port.ts` — remove legacy fallback import; fail-closed or host-only when authority off.
5. Update contract tests; run `verify:transport-engine-w56` then full `verify:engine-lab`.

## Non-goals for W56

- No deletion while sign-off is `BLOCKED`.
- No production default for deletion approval env.

## Contract expectations (pinned in w56 tests)

W56 tests must assert:

- Gate module exists and blocks deletion by default.
- Legacy module and facade remain on disk.
- Recorded sign-off file shows `BLOCKED`.
