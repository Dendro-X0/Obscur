# 29 In-Place Modularization and Test Contract

_Last reviewed: 2026-04-19 (baseline commit a3f16b10)._

## Purpose

This document defines how to modularize the current codebase **without** restarting the MVP or disabling core features.

It exists because this project is:

1. decentralized,
2. local-first,
3. multi-layer encrypted,
4. runtime-sensitive across PWA and desktop,
5. difficult to stabilize with patch-by-patch iteration alone.

The goal is to make each module:

1. maintainable,
2. scalable,
3. integrable,
4. testable,
5. resistant to drift after future iteration.

## Relationship to Other Canonical Docs

Use together with:

1. `docs/12-core-architecture-truth-map.md`
2. `docs/14-module-owner-index.md`
3. `docs/rewrite/28-in-place-architecture-rewrite-plan.md`

The rewrite plan defines **what** architecture we are moving toward.

This document defines **how** modules should be cut, validated, and protected while we move there.

## Non-Negotiables

Do not:

1. restart the product surface,
2. disable hard features to simplify engineering,
3. hide drift behind more UI-layer compatibility bridges,
4. let a module own both raw transport handling and product-facing projection truth without naming that boundary,
5. accept green tests as proof if the runtime contract is still ambiguous.

Do:

1. keep the current product alive while replacing fragile internals,
2. assign one owner per lifecycle and read model,
3. give every module explicit contracts and boundaries,
4. require focused tests before expanding the module again,
5. leave diagnostics behind when runtime truth matters.

## Target Module Shape

Every major module should converge on the same internal structure.

### A. Contract Layer

Holds:

1. types,
2. schemas,
3. invariants,
4. typed event families,
5. projection shapes.

Preferred homes:

1. `packages/dweb-core`
2. tightly-scoped `services/*-contracts.ts` modules until promoted.

### B. Import/Transport Layer

Holds:

1. relay/native input parsing,
2. backup import parsing,
3. bridge compatibility readers,
4. diagnostics at raw evidence boundaries.

This layer must not directly decide final UI truth.

### C. Reducer/Projection Layer

Holds:

1. canonical state reconstruction,
2. read-model derivation,
3. convergence rules,
4. conflict resolution,
5. evidence precedence.

This is the primary place where restore/live/local-first truth should converge.

### D. Persistence Layer

Holds:

1. scoped storage reads/writes,
2. indexed-db adapters,
3. local cache/materialization helpers,
4. migration shims.

This layer should not invent product logic.

### E. UI Adapter Layer

Holds:

1. providers,
2. hooks that adapt canonical projections to components,
3. route composition,
4. action wiring.

This layer should consume projection truth, not reconstruct it.

## Priority Modules for Rewrite

### 1. Account Restore and Sync

Current risk:

1. backup restore,
2. canonical event append,
3. provider hydration,
4. chat-state compatibility domains

still overlap.

Target split:

1. `account-sync/contracts`
2. `account-sync/import`
3. `account-sync/projection`
4. `account-sync/persistence`
5. `account-sync/ui-adapters`

### 2. DM Conversation Authority

Current risk:

1. restored history can become thinner than canonical local truth,
2. provider and projection authority can disagree,
3. new-window login can partially restore conversation state.

Target split:

1. DM event contracts,
2. DM import/materialization,
3. conversation list authority,
4. conversation timeline authority,
5. messaging provider adapter.

### 3. Community Membership and Projection

Current risk:

1. membership ledger,
2. DM invite/accept evidence,
3. relay roster,
4. page/provider fallback heuristics

still converge late or incompletely.

Target split:

1. community control contracts,
2. membership evidence import,
3. membership projection authority,
4. projection-backed UI adapters,
5. room-key/sendability integration.

### 4. Relay Runtime and Transport

Current risk:

1. route liveness,
2. recovery cadence,
3. scoped relay publish truth,
4. degraded outcomes

still influence product behavior indirectly.

Target split:

1. runtime supervisor,
2. transport core,
3. publish evidence contracts,
4. observability surfaces,
5. UI status adapters.

## Required Test Ladder Per Module

Every module rewrite slice should add tests at the narrowest useful level first.

### Level 1. Contract Tests

Assert:

1. type shape,
2. schema validity,
3. event-family invariants,
4. precedence rules.

### Level 2. Reducer/Projection Tests

Assert:

1. convergence from out-of-order inputs,
2. reconstruction from partial restore state,
3. no silent thinning of truth,
4. deterministic outputs.

### Level 3. Persistence/Import Tests

Assert:

1. scoped storage behavior,
2. migration compatibility,
3. replay/import materialization,
4. no cross-profile/account bleed.

### Level 4. Provider/Adapter Integration Tests

Assert:

1. UI-facing providers consume canonical projection outputs,
2. route or modal adapters do not rebuild truth locally,
3. mounted windows refresh correctly after restore or live updates.

### Level 5. Two-User Runtime Replay

Required for:

1. DM history,
2. community membership,
3. room-key/sendability,
4. restore/login on another window/device.

## Anti-Drift Enforcement

Each substantial slice should leave behind at least one of:

1. a new typed contract,
2. a focused reducer/projection test,
3. a persistence/import test,
4. a diagnostics event proving the owner path,
5. a doc update naming the canonical owner.

If a module changes but none of these are added, drift risk is still increasing.

## Definition of Done for a Module Slice

A module slice is only considered stable when:

1. its owner boundary is explicit,
2. overlapping mutation paths were removed or quarantined,
3. tests cover the new owner path,
4. runtime diagnostics identify whether the owner is actually being used,
5. the UI no longer depends on fallback local assembly for the solved behavior.

## Immediate Execution Order

### Step 1

Stabilize the current shared root:

1. restore import owner,
2. DM conversation authority,
3. community membership projection authority.

### Step 2

Promote the matured contracts into `packages/dweb-core` where they are truly shared.

### Step 3

Split oversized owner files by responsibility while preserving runtime behavior.

### Step 4

Replace page-level heuristics with module-backed adapters.

## Success Criteria

This modularization effort is only working if:

1. new-window/fresh-device login preserves the same DM history and community state users expect,
2. join/leave status converges in real time and survives restore,
3. future changes land by module boundary instead of cross-cutting patch chains,
4. regressions become localized and diagnosable instead of system-wide mysteries.
