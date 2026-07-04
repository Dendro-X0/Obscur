# Transport Engine W30 — Host Publish Owner Migration Charter

**Status:** Charter + contract pins (design-only; no runtime wiring)  
**Last updated:** 2026-06-25  
**Band:** ENGINE-LAB / transport-engine post-B5

## Goal

Document the **single-owner migration plan** from the transport-kernel standalone publish owner to the transport-engine host publish path, satisfying W19 exit criteria without performing the flip in this wave.

W30 is design + contract only.

## Current runtime owners

| Layer | Owner |
|-------|--------|
| Port routing | `relay-standalone-publish-port.ts` |
| Native publish execution | `transport-kernel-standalone-publish.ts` |
| Outcome semantics | `publish-outcome-mapper.ts` |
| Host invoke (typed, non-wired) | `transport-engine-host-port.ts` → `publishRelayEventViaTransportEngineHost` |

## Target end state

`relay-standalone-publish-port.ts` routes native standalone publish through the host path:

1. Build `TransportPublishRelayEventPayload` from port inputs (normalized relay URLs + payload string).
2. Invoke `publishRelayEventViaTransportEngineHost`.
3. Map `TransportPublishRelayEventResult` through `mapLegacyPublishResultToRelayPublishResult` (no duplicate mapping logic).
4. Subtract `transport-kernel-standalone-publish.ts` once parity + Rust wiring evidence is green.

## Migration phases (sequenced)

### Phase A — Evidence complete (W24–W29)

- Parity harness green for acceptance + all failure modes.
- Rust remains `transport_publish_not_wired` for valid invokes until wiring wave.

### Phase B — Rust validation + result assembly (W31+)

- Rust validates payload shape (`invalid_payload` for empty relay set / empty payload).
- Rust returns structured `TransportPublishRelayEventResult` without forking mapper quorum rules.
- Still no authority flip in port routing.

### Phase C — Port shim (future wave)

- Add explicit routing gate in `relay-standalone-publish-port.ts` (engine-lab / policy flag only).
- Host path becomes opt-in shim; standalone owner remains fallback until parity sign-off.

### Phase D — Authority flip (future wave)

- Default native routing uses host path.
- Standalone owner quarantined then deleted.

## Constraints

- **One outcome mapper** — host results must use `mapLegacyPublishResultToRelayPublishResult`.
- **No parallel publish owners** — do not add a third mapping layer.
- **Fail-closed** — host unavailable / not-wired / invalid-result must not silently fall through to legacy without an explicit policy decision.

## Non-goals for W30

- No routing changes in `relay-standalone-publish-port.ts`.
- No Rust publish network execution.
- No deletion of `transport-kernel-standalone-publish.ts`.

## Contract expectations (pinned in w30 tests)

W30 tests must assert:

- This charter exists and defines phased migration without immediate flip.
- `relay-standalone-publish-port.ts` still routes to `transport-kernel-standalone-publish.ts`.
- Shared mapper and typed host adapter remain present as migration targets.
