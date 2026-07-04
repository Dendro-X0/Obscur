# Transport Engine W38 — Engine-Lab Host Publish Shim Gate Charter

**Status:** Charter + contract pins (lab-only enablement; no production authority flip)  
**Last updated:** 2026-06-25  
**Band:** ENGINE-LAB / transport-engine post-B5

## Goal

Enable **`shouldUseHostTransportPublishShim()`** only in engine-lab strict mode with an explicit env opt-in, so dry-run host publish can be exercised without changing production routing defaults.

W38 does **not** flip port authority for non-lab builds.

## Shim gate policy (pinned)

`shouldUseHostTransportPublishShim()` returns `true` only when **all** are true:

1. `isEngineLabStrictMode()` — legacy parallel owners disabled (`NEXT_PUBLIC_OBSCUR_ALLOW_LEGACY !== "1"`).
2. `isTransportKernelPublishOwner()` — native transport-kernel publish owner active.
3. `NEXT_PUBLIC_OBSCUR_TRANSPORT_HOST_PUBLISH_SHIM === "1"` — explicit lab opt-in.

Otherwise the gate remains `false` and `relay-standalone-publish-port.ts` keeps routing to `transport-kernel-standalone-publish.ts`.

## Non-goals for W38

- No production/default enablement of the shim gate.
- No relay network execution in Rust (dry-run only from W37).
- No deletion of standalone publish owner.

## Contract expectations (pinned in w38 tests)

W38 tests must assert:

- This charter exists and documents the three-part gate.
- `transport-kernel-publish-port.ts` implements engine-lab + env gating.
- Default test/runtime path keeps shim gate `false`.
