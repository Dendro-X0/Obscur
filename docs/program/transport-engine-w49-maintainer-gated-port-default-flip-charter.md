# Transport Engine W49 — Maintainer-Gated Port Default Flip Charter

**Status:** Charter + policy gate pins (no port routing flip)  
**Last updated:** 2026-06-25  
**Band:** ENGINE-LAB / transport-engine post-B5

## Goal

Define the **Phase D maintainer gate** — a policy flag separate from W38 shim — that will control default host publish routing in `relay-standalone-publish-port.ts` in a future wave (W50+).

W49 adds the policy surface only; **no port routing change**.

## Authority gate vs shim gate

| Gate | Env | Purpose | W49 status |
|------|-----|---------|------------|
| **Shim** (W38) | `NEXT_PUBLIC_OBSCUR_TRANSPORT_HOST_PUBLISH_SHIM=1` | Opt-in lab shim over standalone default | Unchanged |
| **Authority** (W49) | `NEXT_PUBLIC_OBSCUR_TRANSPORT_HOST_PUBLISH_AUTHORITY=1` | Maintainer Phase D default host routing | Policy only |

Authority is **not** an alias for shim. Future port wiring (W50) will treat authority as the Phase D default flip; shim remains a separate historical lab path.

## Authority gate policy (pinned)

`shouldUseHostTransportPublishAuthority()` returns `true` only when **all** are true:

1. `isEngineLabStrictMode()` — legacy parallel owners disabled.
2. `isTransportKernelPublishOwner()` — native transport-kernel publish owner active.
3. `NEXT_PUBLIC_OBSCUR_TRANSPORT_HOST_PUBLISH_AUTHORITY === "1"` — explicit maintainer opt-in.

Default remains `false`. Production builds must not set the authority env.

## Network path coupling (documented for W50)

When authority routing is wired, host publish should use the W46 async desktop path when `NEXT_PUBLIC_OBSCUR_TRANSPORT_HOST_PUBLISH_NETWORK=1` is also set; otherwise host invoke remains dry-run assembly (W37). W49 does not wire this coupling.

## Prerequisites (W48 maintainer gate)

Authority env must not be enabled until W48 evidence review sign-off is recorded in handoff. W49 does not auto-enable authority.

## Non-goals for W49

- No changes to `relay-standalone-publish-port.ts` routing order.
- No deletion of `transport-kernel-standalone-publish.ts`.
- No replacement of `shouldUseHostTransportPublishShim`.

## Contract expectations (pinned in w49 tests)

W49 tests must assert:

- This charter exists with authority env separate from shim env.
- `shouldUseHostTransportPublishAuthority()` exists in `transport-kernel-publish-port.ts` and defaults `false`.
- Port still routes to standalone owner by default.
