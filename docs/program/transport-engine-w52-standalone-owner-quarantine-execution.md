# Transport Engine W52 — Standalone Owner Quarantine Execution

**Status:** Implemented (quarantine move; no deletion)  
**Last updated:** 2026-06-25  
**Band:** ENGINE-LAB / transport-engine post-B5

## Goal

Execute the W51 quarantine plan: move standalone publish implementation to `-legacy.ts` and switch port imports, while preserving stable exports via a thin facade.

## Wiring (pinned)

| Module | Role |
|--------|------|
| `transport-kernel-standalone-publish-legacy.ts` | Quarantined implementation owner |
| `transport-kernel-standalone-publish.ts` | Re-export facade (backward-compatible imports) |
| `relay-standalone-publish-port.ts` | Imports from `-legacy` for non-host fallback branch |

## Preserved

- Export names `publishTransportKernelToRelay` / `publishTransportKernelToRelayUrls`.
- Host routing via `shouldRouteHostTransportPublish()` unchanged.
- Gates off by default; no standalone deletion.

## Non-goals for W52

- No deletion of `-legacy` module or facade.
- No change to authority/shim default policy.

## Contract expectations (pinned in w52 tests)

W52 tests must assert:

- `-legacy.ts` exists with implementation.
- Port imports from `-legacy`.
- Facade re-exports preserve export surface.
