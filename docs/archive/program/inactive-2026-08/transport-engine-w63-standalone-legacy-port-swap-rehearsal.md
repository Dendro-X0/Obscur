# Transport Engine W63 — Standalone Legacy Port Swap Rehearsal

**Status:** Port delegates to subtracted module when deletion env is on; production deletion **BLOCKED** (sign-off `BLOCKED`)  
**Last updated:** 2026-06-26  
**Band:** ENGINE-LAB / transport-engine post-B5

## Goal

Wire **deletion rehearsal routing** in `relay-standalone-publish-port.ts` by delegating to `relay-standalone-publish-port-subtracted.ts` when `shouldRouteSubtractedStandalonePublishPort()` is true. Physical file deletion remains gated.

## Port swap rehearsal policy (pinned)

| Gate | Port behavior |
|------|----------------|
| `shouldRouteSubtractedStandalonePublishPort()` false (default) | Legacy standalone fallback preserved |
| `shouldRouteSubtractedStandalonePublishPort()` true (deletion env) | Delegate to subtracted port module |

`shouldRouteSubtractedStandalonePublishPort()` mirrors `shouldBlockStandaloneLegacyPublishFallback()` (deletion approval env only after W54 PASS).

Maintainer script: `node scripts/execute-transport-standalone-legacy-subtraction.mjs` — exits non-zero until gate opens.

## Current state (W63)

- Sign-off recorded file: `Decision: BLOCKED`.
- Production `-legacy.ts`, facade, and port legacy import **preserved** for default path.
- Subtracted delegation wired for deletion rehearsal env.

## Maintainer mechanical subtraction when gate opens (W64+)

1. Confirm `execute-transport-standalone-legacy-subtraction.mjs` exits 0.
2. Delete `STANDALONE_LEGACY_FILES_TO_DELETE`.
3. Replace `relay-standalone-publish-port.ts` with thin re-exports from subtracted module.
4. Update gate-closed existence pins; run `verify:transport-engine-w64` then `verify:engine-lab`.

## Non-goals for W63

- No deletion of production `-legacy.ts` or facade while sign-off is `BLOCKED`.
- No production default for deletion approval env.

## Contract expectations (pinned in w63 tests)

W63 tests must assert:

- This charter exists with port delegation policy.
- `shouldRouteSubtractedStandalonePublishPort` in publish-port policy.
- Port imports subtracted module and delegates when rehearsal gate is on.
- Production legacy files remain on disk while gate is closed.
