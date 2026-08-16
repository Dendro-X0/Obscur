# Transport Engine W16 — Host Publish Method Charter

**Status:** Decision captured (explicit defer)  
**Last updated:** 2026-06-18  
**Band:** ENGINE-LAB / transport-engine post-B5

## Decision

For w16, **do not add** a transport-engine host publish method yet.

Standalone native publish remains owned by:

- `apps/pwa/app/features/transport-kernel/transport-kernel-standalone-publish.ts`
- routed through `apps/pwa/app/features/relays/hooks/relay-standalone-publish-port.ts`

## Why defer host method now

1. `packages/obscur-engine-contracts/src/transport-engine-methods.ts` is currently read-only (`listRelayCheckpoints`, `listConfiguredRelayUrls`).
2. A host publish method needs durable outbox semantics and retry/evidence mapping parity, not just a thin invoke wrapper.
3. Introducing a write method without migration guarantees risks adding a third publish owner (legacy runtime, transport-kernel owner, host method).

## W16 deliverable contract

- Keep transport-engine host methods read-only in this wave.
- Record migration plan and exit criteria before any publish method lands.
- Preserve current verify chain (`verify:transport-engine-w16`).

## Migration plan (next wave)

If/when promoted:

1. Add `publishRelayEvent` (name TBD) to `TRANSPORT_ENGINE_METHODS`.
2. Define payload/result contract in `obscur-engine-contracts` with:
   - relay target scope
   - quorum fields
   - retryable/degraded reason codes
3. Add host adapter + desktop invoke implementation.
4. Move `transport-kernel-standalone-publish` to a shim over host method.
5. Remove duplicate publish semantics from transport-kernel owner once parity is proven.

## Exit criteria to unblock promotion

- Contract tests proving one canonical publish owner on native.
- Verify gate for publish method added to transport-engine wave chain.
- Evidence mapping parity (same reason/status semantics as shared publish mapper).

