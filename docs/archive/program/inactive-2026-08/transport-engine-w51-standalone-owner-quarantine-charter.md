# Transport Engine W51 — Standalone Owner Quarantine Charter

**Status:** Charter + contract pins (design-only; no file move)  
**Last updated:** 2026-06-25  
**Band:** ENGINE-LAB / transport-engine post-B5

## Goal

Document the **quarantine move path** for `transport-kernel-standalone-publish.ts` after W50 authority routing is validated, satisfying W41/W48 subtraction plan item 6 without deleting or moving files in this wave.

W51 is design + contract only.

## Current owner (unchanged in W51)

| Symbol | Path |
|--------|------|
| Port | `apps/pwa/app/features/relays/hooks/relay-standalone-publish-port.ts` |
| Standalone execution | `apps/pwa/app/features/transport-kernel/transport-kernel-standalone-publish.ts` |
| Host path | `apps/pwa/app/features/transport-kernel/transport-kernel-host-publish-shim.ts` |
| Semantics | `apps/pwa/app/features/relays/lib/publish-outcome-mapper.ts` |

When `shouldRouteHostTransportPublish()` is false, port still calls `publishTransportKernelToRelayUrls` from the standalone module.

## Quarantine target (future W52+ execution)

When maintainer approves subtraction after authority + parity evidence:

1. **Rename/move** `transport-kernel-standalone-publish.ts` → `transport-kernel-standalone-publish-legacy.ts` (same feature directory; not `app/legacy/`).
2. **Port import switch** — `relay-standalone-publish-port.ts` imports from `-legacy` module only for the non-host fallback branch.
3. **Export stability** — preserve `publishTransportKernelToRelay` / `publishTransportKernelToRelayUrls` export names on the legacy module (or re-export facade).
4. **One release cycle** — legacy module remains callable for rollback; no deletion until live desktop smoke + maintainer sign-off.
5. **Host default** — after quarantine, authority gate on makes host path the effective default; legacy module is fallback only when host routing is off.

## Preconditions (all required before W52 move)

- `verify:transport-engine-w50` green (authority routing wired).
- `verify:transport-engine-w47` green (network parity harness).
- W48 maintainer gate sign-off recorded in handoff.
- No open semantic drift in `mapLegacyPublishResultToRelayPublishResult`.

## Non-goals for W51

- No rename/move of `transport-kernel-standalone-publish.ts`.
- No port import changes.
- No deletion of standalone exports.
- No change to `shouldRouteHostTransportPublish` defaults.

## Contract expectations (pinned in w51 tests)

W51 tests must assert:

- This charter exists with quarantine target path and W52 preconditions.
- `transport-kernel-standalone-publish.ts` remains at current path.
- `relay-standalone-publish-port.ts` still imports standalone owner directly.
