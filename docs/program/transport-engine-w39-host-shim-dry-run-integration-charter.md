# Transport Engine W39 — Host Shim + Dry-Run Integration Charter

**Status:** Charter + contract pins (integration evidence; no network wiring)  
**Last updated:** 2026-06-25  
**Band:** ENGINE-LAB / transport-engine post-B5

## Goal

Pin **integration evidence** that the gated host publish shim (W35), lab shim gate (W38), and Rust dry-run assembly (W37) form a coherent end-to-end path when the shim gate is enabled in engine-lab.

W39 does not enable the gate by default and does not add relay network I/O.

## Integration path (when gate enabled)

1. `relay-standalone-publish-port.ts` selects `publishHostTransportShimToRelayUrls`.
2. Shim invokes `publishRelayEventViaTransportEngineHost`.
3. Rust returns dry-run `TransportPublishRelayEventResult`.
4. Shim maps through `mapLegacyPublishResultToRelayPublishResult`.

## Non-goals for W39

- No production shim enablement.
- No Rust network publish execution.
- No standalone owner deletion.

## Contract expectations (pinned in w39 tests)

W39 tests must assert:

- This charter exists and describes the integration chain.
- Executable harness proves port → shim routing when gate is mocked on.
- Shim gate remains off under default policy.
