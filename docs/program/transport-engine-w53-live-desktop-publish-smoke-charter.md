# Transport Engine W53 — Live Desktop Publish Smoke Charter

**Status:** Charter + contract pins (design-only; no automated smoke)  
**Last updated:** 2026-06-25  
**Band:** ENGINE-LAB / transport-engine post-B5

## Goal

Document a **manual live desktop smoke checklist** for host publish with authority + network lab gates enabled, satisfying W48 subtraction plan item 4 (live desktop smoke before standalone deletion).

W53 is design + contract only — no Playwright/Tauri automation in this wave.

## Required lab env (all must be set for smoke)

| Env | Purpose |
|-----|---------|
| `NEXT_PUBLIC_OBSCUR_ALLOW_LEGACY` | Must **not** be `1` (engine-lab strict mode) |
| `NEXT_PUBLIC_OBSCUR_TRANSPORT_HOST_PUBLISH_AUTHORITY=1` | Phase D port host routing (W50) |
| `NEXT_PUBLIC_OBSCUR_TRANSPORT_HOST_PUBLISH_NETWORK=1` | W46 async desktop relay pool path |

Optional (shim path — **not** required when authority is on):

| Env | Purpose |
|-----|---------|
| `NEXT_PUBLIC_OBSCUR_TRANSPORT_HOST_PUBLISH_SHIM=1` | W38 shim only; authority smoke uses W50 routing |

## Manual smoke checklist (maintainer)

Run on **desktop Tauri** build with connected relays:

1. **Pre-flight** — `pnpm verify:transport-engine-w68` green on smoke commit (`verify:transport-engine-w52` alias includes w52/w53 contracts).
2. **Boot** — desktop app starts; transport-kernel publish owner active (`hasNativeRuntime`).
3. **Authority routing** — with authority env on, `publishToUrlsStandalone` routes through host shim (`transport_kernel_host_publish_shim` journal source), not legacy standalone.
4. **Async invoke** — host publish hits `engine_invoke_transport_publish_relay_event` (not sync headless `engine_invoke`) when network env on.
5. **Relay evidence** — per-relay outcomes reflect real `RelayPool` attempts (not `No writable relay connection` headless placeholder).
6. **Quorum shape** — result fields align with `mapLegacyPublishResultToRelayPublishResult` semantics (successCount, metQuorum, failures).
7. **Fallback path** — with authority env **off**, port still uses `transport-kernel-standalone-publish-legacy.ts` (W52 quarantine).
8. **Sign-off** — record pass/fail + commit hash in handoff before standalone deletion wave.

## Evidence to capture (manual)

- Screenshot or log snippet of journal source `transport_kernel_host_publish_shim`.
- Invoke command name (`engine_invoke_transport_publish_relay_event`) from desktop devtools/logging if available.
- Per-relay success/failure summary for at least one multi-relay publish.

## Non-goals for W53

- No automated smoke test suite.
- No standalone owner deletion.
- No production enablement of authority/network env defaults.

## Contract expectations (pinned in w53 tests)

W53 tests must assert:

- This charter exists with manual checklist + required env matrix.
- References W46 async routing and W50 authority port routing.
- No automated smoke test file added in W53.

## Sequencing after W53

- W54+ may add smoke evidence recording contract or maintainer sign-off template.
- Standalone `-legacy` deletion remains blocked until manual smoke sign-off.
