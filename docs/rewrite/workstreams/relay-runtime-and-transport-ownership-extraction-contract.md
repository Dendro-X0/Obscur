# Relay Runtime and Transport Ownership Extraction Contract

_Last reviewed: 2026-04-22 (baseline commit a3f16b10)._

Status: active rewrite workstream

## Purpose

This workstream defines how to extract relay runtime and transport ownership
from the current overlapping web/native transport stack into one explicit
transport owner model.

It exists because relay behavior currently overlaps across:

1. browser WebSocket transport,
2. native relay wrappers,
3. fallback relays,
4. subscription replay,
5. proxy/Tor routing,
6. runtime degradation and recovery cadence.

The goal is to preserve transport interoperability while making connection
truth explicit, stable, and diagnosable.

## Current Owner Set

Current primary owners and participants:

1. `apps/pwa/app/features/relays/services/relay-runtime-supervisor.ts`
2. `apps/pwa/app/features/relays/hooks/enhanced-relay-pool.ts`
3. `apps/pwa/app/features/relays/hooks/native-relay.ts`
4. `apps/pwa/app/features/relays/services/sticky-relay-recovery.ts`
5. `apps/pwa/app/features/relays/providers/relay-provider.tsx`
6. `apps/desktop/src-tauri/src/net.rs`
7. `apps/desktop/src-tauri/src/relay.rs`

Supporting modules:

1. `apps/pwa/app/features/relays/services/relay-recovery-policy.ts`
2. `apps/pwa/app/features/relays/services/relay-transport-journal.ts`
3. `apps/pwa/app/features/relays/services/relay-resilience-observability.ts`
4. `apps/pwa/app/features/relays/hooks/relay-native-adapter.ts`
5. `apps/pwa/app/features/runtime/native-adapters.ts`

## Current Failure Classes

This workstream is responsible for eliminating:

1. relay runtime truth being inferred indirectly from UI or fallback state,
2. transport thrash under degraded or privacy-routed connections,
3. competing connection/recovery paths between browser and native owners,
4. subscription replay instability after reconnect,
5. transport degradation silently corrupting product truth.

## Future Owner Set

The future architecture should converge on one transport owner stack:

1. `transport runtime owner`
2. `connection lifecycle owner`
3. `subscription replay owner`
4. `routing mode owner`
5. `transport diagnostics owner`

The critical property is singularity:

1. connection truth should come from one runtime surface,
2. proxy/Tor mode should be part of transport truth, not an afterthought,
3. transport health should inform product state without redefining it.

## Required Future Contracts

This workstream should ultimately produce:

1. `transport-runtime-contracts`
2. `transport-routing-contracts`
3. `subscription-replay-contracts`
4. `publish-evidence-contracts`
5. `native-transport-capability-contracts`

Minimum contract fields should cover:

1. connection mode,
2. routing mode,
3. writable/subscribable relay counts,
4. recovery stage,
5. replay result,
6. scoped publish evidence,
7. degraded/fatal reason codes.

## Extraction Sequence

### Phase 1. Contract Lock

Lock the relay runtime snapshot and routing mode into explicit contracts.

Outputs:

1. transport runtime contract,
2. route mode contract,
3. degraded-state reason-code vocabulary,
4. replay result contract.

### Phase 2. Browser/Native Boundary Simplification

Reduce browser/native transport branching to one explicit adapter boundary.

Outputs:

1. one native capability boundary,
2. one browser fallback policy,
3. one handoff contract between runtime and transport owners.

### Phase 3. Recovery and Replay Consolidation

Move reconnect cadence, replay cadence, and fallback behavior under one policy
surface.

Outputs:

1. one recovery cadence policy,
2. one replay-subscription contract,
3. one fallback relay policy,
4. one privacy-routed calibration policy.

### Phase 4. Product Truth Separation

Ensure transport diagnostics inform product truth without becoming product
truth.

Outputs:

1. transport-to-runtime mapping rules,
2. transport-to-product boundary diagnostics,
3. explicit “evidence, not truth” contract for transport.

## Compatibility Retirement Sequence

Retire in this order:

1. duplicate browser/native lifecycle assumptions,
2. implicit fallback relay behavior not covered by runtime contracts,
3. route/UI-level transport inference,
4. ad hoc privacy-routed special cases outside the transport owner.

Do not retire compatibility until:

1. degraded direct connections remain stable,
2. proxy/Tor runtime remains stable,
3. replay after reconnect is deterministic.

## Test Ladder

Minimum test set:

1. unit tests for sticky recovery cadence,
2. unit tests for routing mode detection,
3. runtime supervisor tests,
4. native relay adapter/wrapper tests,
5. degraded transport replay packet.

Current tests to preserve and extend:

1. `apps/pwa/app/features/relays/services/sticky-relay-recovery.test.ts`
2. `apps/pwa/app/features/relays/services/relay-runtime-supervisor.test.ts`
3. `apps/pwa/app/features/relays/hooks/native-relay.test.ts`

## Minimum Runtime Acceptance Packet

This workstream is only complete when runtime replay proves:

1. relay runtime stays explicit under degraded direct transport,
2. privacy-routed transport uses slower but stable recovery cadence,
3. reconnect preserves subscription replay behavior,
4. transport degradation does not silently thin product truth,
5. relay runtime and window runtime remain separately diagnosable.

Primary evidence probes:

1. `window.obscurRelayRuntime?.getSnapshot?.()`
2. `window.obscurRelayTransportJournal?.getSnapshot?.()`
3. `window.obscurAppEvents.findByName("relay.runtime_performance_gate", 30)`
4. any subscription replay result or recovery diagnostics captured during replay.

## Definition Of Done

This workstream is done only when:

1. browser/native transport share one explicit owner model,
2. routing mode is first-class in transport truth,
3. recovery and replay are runtime-verified,
4. transport does not redefine product truth,
5. future threads can continue from docs alone.
