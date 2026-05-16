# Coordination Backend Ownership Extraction Contract

_Last reviewed: 2026-04-22 (baseline commit a3f16b10)._

Status: active rewrite workstream

## Purpose

This workstream defines how to introduce a unified, modular coordination
backend for the rewrite without abandoning privacy, data sovereignty, or
portability.

It exists because current coordination concerns are fragmented across:

1. invites,
2. discovery,
3. relay-derived public metadata,
4. restore/index support,
5. community membership coordination,
6. optional relay proxy surfaces.

The goal is to centralize consistency where it helps maintainability, while
keeping private user data sovereign.

## Current Owner Set

Current primary owners and references:

1. `apps/coordination/src/index.ts`
2. `apps/relay-gateway/src/index.ts`
3. `apps/pwa/app/features/invites`
4. `apps/pwa/app/features/search`
5. `apps/pwa/app/features/network`
6. `apps/pwa/app/features/account-sync`

Supporting references:

1. `docs/rewrite/35-data-sovereignty-and-unified-backend-rewrite-target.md`
2. `docs/rewrite/36-resilient-infrastructure-and-technical-protocols.md`
3. `docs/02-repository-map.md`

## Current Failure Classes

This workstream is responsible for eliminating:

1. coordination truth being inferred from relays alone,
2. invite and discovery behavior depending on weak ambient conventions,
3. restore and indexing support lacking a unified backend contract,
4. community coordination remaining under-specified for real-world stability,
5. backend/service evolution being blocked by accidental decentralization rules.

## Future Owner Set

The future architecture should converge on one modular coordination backend
stack:

1. `session continuity service`
2. `restore index service`
3. `community coordination service`
4. `discovery service`
5. `media descriptor service`

The critical property is modular unity:

1. these services can be separate modules,
2. they still form one coherent backend coordination plane,
3. none of them need plaintext ownership of private user data.

## Required Future Contracts

This workstream should ultimately produce:

1. `session-coordination-contracts`
2. `restore-index-contracts`
3. `community-coordination-contracts`
4. `discovery-contracts`
5. `media-descriptor-contracts`

Minimum contract fields should cover:

1. service responsibility,
2. accepted plaintext boundaries,
3. accepted encrypted boundaries,
4. identity/account scope,
5. consistency guarantees,
6. self-hosting or operator-hosting assumptions.

## Extraction Sequence

### Phase 1. Service Boundary Lock

Define the service modules and their responsibilities without writing product
logic yet.

Outputs:

1. service boundary map,
2. plaintext boundary rules,
3. encrypted ownership rules,
4. deployment assumptions.

### Phase 2. Coordination Contracts

Write explicit backend-facing contracts for:

1. session continuity,
2. invite lifecycle,
3. restore indexing,
4. community directory coordination,
5. discovery indexing.

Outputs:

1. typed service contracts,
2. request/response/event vocabulary,
3. ownership and idempotency rules.

### Phase 3. Backend Topology Decision

Define how these services should be deployed and composed.

Outputs:

1. single service vs modular service topology,
2. self-hosting path,
3. operator-hosting path,
4. relay interop boundary.

### Phase 4. Client Integration Boundaries

Define the adapter boundaries between client projection owners and the new
coordination backend.

Outputs:

1. client/backend adapter contract,
2. sovereignty-preserving import/export rules,
3. degraded-mode rules when backend coordination is unavailable.

## Compatibility Retirement Sequence

Retire in this order:

1. relay-only assumptions for invite/discovery truth,
2. coordination behavior inferred from UI or transport state,
3. restore/index work that lacks backend service boundaries,
4. optional proxy/gateway logic that still doubles as product truth.

Do not retire compatibility until:

1. service boundaries are documented,
2. client adapters are explicit,
3. privacy and plaintext boundaries are accepted.

## Test Ladder

Minimum test set:

1. contract tests for service boundaries,
2. invite and discovery integration tests,
3. restore index contract tests,
4. coordination backend API or worker tests,
5. deployment topology smoke tests.

Current code and reference surfaces to preserve and extend:

1. `apps/coordination/src/index.ts`
2. `apps/relay-gateway/src/index.ts`
3. current invite and discovery tests under `apps/pwa/app/features/invites` and `apps/pwa/app/features/search`

## Minimum Runtime Acceptance Packet

This workstream is only complete when runtime replay or deployment replay
proves:

1. session continuity metadata is stable,
2. invite lifecycle is deterministic,
3. restore indexing support is explicit and durable,
4. community coordination is no longer implicit relay truth,
5. privacy-sensitive content remains sovereign and encrypted.

Primary evidence probes:

1. backend health and contract checks for coordination services,
2. invite resolution/runtime diagnostics,
3. restore indexing diagnostics,
4. community coordination replay packet once implemented.

## Definition Of Done

This workstream is done only when:

1. the coordination backend is defined as a modular plane,
2. plaintext and encrypted boundaries are explicit,
3. client integration boundaries are explicit,
4. self-hosting/operator-hosting assumptions are explicit,
5. future threads can continue from docs alone.
