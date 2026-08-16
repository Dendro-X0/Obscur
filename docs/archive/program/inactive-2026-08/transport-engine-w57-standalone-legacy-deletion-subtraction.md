# Transport Engine W57 — Standalone Legacy Deletion Subtraction

**Status:** Fail-closed port wired; file deletion **BLOCKED** (sign-off `BLOCKED`)  
**Last updated:** 2026-06-26  
**Band:** ENGINE-LAB / transport-engine post-B5

## Goal

Prepare **W55 subtraction execution** by wiring fail-closed publish when the deletion approval env is on. Physical file deletion runs only when the W56 gate opens (`Decision: PASS` + env).

## Port routing (W57)

When transport-kernel is publish owner and legacy pool path is off:

1. `shouldRouteHostTransportPublish()` → host shim/authority path
2. `shouldBlockStandaloneLegacyPublishFallback()` → `transport-kernel-standalone-publish-blocked.ts` (fail-closed)
3. Else → `transport-kernel-standalone-publish-legacy.ts` (rollback until gate opens)

Deletion approval env (`NEXT_PUBLIC_OBSCUR_TRANSPORT_STANDALONE_LEGACY_DELETION_APPROVED=1`) must only be set after W54 `Decision: PASS` is recorded.

## Current state (W57)

- Sign-off recorded file: `Decision: BLOCKED`.
- Gate closed — `-legacy.ts`, facade, and port legacy import **preserved**.
- Fail-closed module added for env-on policy rehearsal.

## Maintainer subtraction commit when gate opens (W58+)

1. Update `transport-engine-smoke-sign-off-recorded.md` with smoke evidence + `Decision: PASS`.
2. Set deletion approval env in maintainer build.
3. Delete `transport-kernel-standalone-publish-legacy.ts` and facade `transport-kernel-standalone-publish.ts`.
4. Remove legacy import from `relay-standalone-publish-port.ts`; blocked + host paths remain.
5. Update contract tests referencing `-legacy.ts`; run `verify:transport-engine-w57` then `verify:engine-lab`.

## Non-goals for W57

- No deletion of `-legacy.ts` or facade while sign-off is `BLOCKED`.
- No production default for deletion approval env.
- No authority/network env default enablement.

## Contract expectations (pinned in w57 tests)

W57 tests must assert:

- This charter exists with fail-closed routing and W58+ subtraction steps.
- `shouldBlockStandaloneLegacyPublishFallback` in publish-port policy.
- Blocked publish module exists with quorum mapper semantics.
- Legacy module, facade, and port legacy import remain while gate is closed.
