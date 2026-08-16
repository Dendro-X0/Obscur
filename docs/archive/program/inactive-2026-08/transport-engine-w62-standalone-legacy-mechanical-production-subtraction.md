# Transport Engine W62 — Standalone Legacy Mechanical Production Subtraction

**Status:** Subtracted port module pinned; production deletion **BLOCKED** (sign-off `BLOCKED`)  
**Last updated:** 2026-06-26  
**Band:** ENGINE-LAB / transport-engine post-B5

## Goal

Pin the **post-subtraction port routing module** so mechanical production file deletion is a swap commit when dry-run reports `readyForPhysicalDeletion: true`.

## Subtracted port policy (pinned)

Module: `relay-standalone-publish-port-subtracted.ts`

| Path | Behavior |
|------|----------|
| Legacy pool (`shouldUseLegacyStandaloneRelayPublish`) | Unchanged — `enhanced-relay-pool-legacy` |
| Host authority/shim (`shouldRouteHostTransportPublish`) | `transport-kernel-host-publish-shim` |
| Default native owner | **Fail-closed** via `transport-kernel-standalone-publish-blocked` |

No import of `transport-kernel-standalone-publish-legacy`.

## Current state (W62)

- Sign-off recorded file: `Decision: BLOCKED`.
- Production `-legacy.ts`, facade, and current port legacy import **preserved**.
- Subtracted port module ready for swap.

## Maintainer swap when gate opens (W63+)

1. Update recorded sign-off + deletion approval env.
2. Confirm dry-run `readyForPhysicalDeletion: true`.
3. Delete `STANDALONE_LEGACY_FILES_TO_DELETE`.
4. Replace `relay-standalone-publish-port.ts` body with re-exports from `-subtracted` module (or inline swap).
5. Remove/retarget `transport-kernel-standalone-publish.test.ts`; update gate-closed existence pins.
6. Run `verify:transport-engine-w62` then `verify:engine-lab`.

## Non-goals for W62

- No deletion of production `-legacy.ts` or facade while sign-off is `BLOCKED`.
- No production port swap while gate is closed.

## Contract expectations (pinned in w62 tests)

W62 tests must assert:

- This charter exists with subtracted port module reference.
- Subtracted port omits legacy standalone import.
- Current port still imports legacy while gate is closed.
- Production legacy files remain on disk.
