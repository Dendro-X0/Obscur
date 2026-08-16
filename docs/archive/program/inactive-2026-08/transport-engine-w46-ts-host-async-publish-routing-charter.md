# Transport Engine W46 — TS Host Async Publish Routing Charter

**Status:** Implemented behind network lab gate  
**Last updated:** 2026-06-25  
**Band:** ENGINE-LAB / transport-engine post-B5

## Goal

Route `transport.publishRelayEvent` host invokes through the desktop async command `engine_invoke_transport_publish_relay_event` when the network lab gate is enabled, so TS callers receive **real relay pool evidence** (W45) instead of sync headless assembly (W43).

## Wiring (pinned)

In `@obscur/engine-host` (`tauri-engine-host.ts`):

| Condition | Tauri command |
|-----------|---------------|
| `engine === "transport"` && `method === "publishRelayEvent"` && `NEXT_PUBLIC_OBSCUR_TRANSPORT_HOST_PUBLISH_NETWORK=1` | `engine_invoke_transport_publish_relay_event` |
| All other invokes, or network env off | `engine_invoke` (sync) |

`transport-engine-host-port.ts` continues to call `host.invoke(buildTransportPublishRelayEventRequest(...))` — routing is owned by engine-host.

## Preserved constraints

- Network env off → sync `engine_invoke` dry-run (W37).
- Shim gate (`NEXT_PUBLIC_OBSCUR_TRANSPORT_HOST_PUBLISH_SHIM`) unchanged — separate opt-in path via port.
- Standalone publish owner (`transport-kernel-standalone-publish.ts`) remains production canonical.
- No port authority flip (W41).

## Non-goals for W46

- No network parity harness vs standalone owner (later wave).
- No deletion of sync headless network path in libobscur.
- No authority flip.

## Contract expectations (pinned in w46 tests)

W46 tests must assert:

- This charter exists and references `engine_invoke_transport_publish_relay_event`.
- `tauri-engine-host.ts` routes `publishRelayEvent` to async command when network env is on.
- Default (network env off) keeps `engine_invoke` for publish invokes.
