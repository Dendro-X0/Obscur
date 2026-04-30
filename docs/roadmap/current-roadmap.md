# Current Roadmap

This is the canonical active roadmap.  
Version-specific phase plans are consolidated into general workstreams and milestone slices.

## Active Detailed Plan (Do Not Lose)

### Active Release Roadmaps

1. **[v1.4.7 Community Modes & Convergence Roadmap](./v1.4.7-community-modes-and-convergence.md)** ← **ACTIVE PRIMARY**
   - Community modes (sovereign room vs managed workspace)
   - Restore & media convergence fixes
   - Voice reliability completion
   - Security feature production wiring

2. **[v1.4.0 CRDT Protocol Rewrite Roadmap](./v1.4.0-crdt-protocol-rewrite-roadmap.md)** ← **ARCHIVED (Released)**
   - Superseded by v1.4.7 plan
   - CRDT-native architecture delivered in v1.4.0-v1.4.6

### Archived v1.4.0 Plans (For Reference)
2. [v1.4.0 In-Place Rewrite and Resilience Plan](./v1.4.0-in-place-rewrite-and-resilience-plan.md) ← **SUPERSEDED**
3. [v1.4.0 Specification and Test Matrix](./v1.4.0-specification-and-test-matrix.md)
4. [v1.4.0 Closeout and Documentation Consolidation Contract](./v1.4.0-closeout-and-doc-consolidation.md)

### Previous Release Plans
5. [v1.3.8 Roadmap and Execution Contract](./v1.3.8-hybrid-offline-streaming-update-plan.md)
6. [v1.3.8 Offline UI Asset Inventory and Local-First Policy](./v1.3.8-offline-ui-asset-inventory.md)
7. [v1.3.8 Streaming Update Contract](./v1.3.8-streaming-update-contract.md)

**Note:** Active plan files are mandatory continuity artifacts and are non-removable until closeout conditions are met.

## Current Health Baseline (2026-04-19)

1. project remains active for development, with stability work prioritized,
2. unresolved severe blockers remain active in the community systems and supporting restore/convergence lanes,
3. recent route-freeze pressure and several restore/membership regressions confirm that the project is structurally modular but behaviorally fragile,
4. `v1.4.0` is now the active community-system overhaul and validation lane,
5. exact live community member-sync is no longer treated as a universal near-term UX claim; community guarantees now need to follow relay capability and explicit mode design.
6. repeated regressions in restore/community truth now justify destructive owner replacement where modules are no longer salvageable through bounded fixes,
7. future backend work should optimize for maintainable, scalable coordination rather than difficult protocol purity, while preserving user-sovereign encrypted data.

## Current Phase Policy

Obscur is still in a pre-public promotion phase. For this phase:

1. core trust paths must become reliable before broad feature expansion,
2. contracts/specs for those paths must be explicit,
3. focused tests and manual replay evidence are mandatory for fragile flows,
4. roadmap promises should follow runtime truth, not aspiration alone.

Canonical reference:
1. `docs/trust/19-pre-public-reliability-and-trust-contract.md`
2. `docs/trust/20-core-function-verification-matrix.md`
3. `docs/rewrite/28-in-place-architecture-rewrite-plan.md`
4. `docs/rewrite/29-in-place-modularization-and-test-contract.md`
5. `docs/rewrite/30-fragility-analysis-and-safe-iteration-contract.md`
6. `docs/rewrite/31-long-term-resilience-and-context-limits-playbook.md`
7. `docs/rewrite/32-community-system-reset-and-alternative-solutions.md`
8. `docs/rewrite/33-community-modes-and-relay-guarantees.md`

## Workstream Order (Canonical)

1. Community-system overhaul and relay-capability guarantees.
2. Restore import and conversation/community truth convergence.
3. Stability and lifecycle ownership protection.
4. Realtime voice reliability and convergence.
5. Privacy-preserving anti-abuse controls.
6. UX and performance polish.
7. Roadmap and ecosystem planning grounded in current truth.
8. Feature expansion only when prior lanes remain green.

## Rewrite Posture

The active posture is now aggressive replacement, not optimistic patching.

That means:

1. repeated-regression owner modules may be deleted and replaced wholesale,
2. old modules remain only as temporary compatibility shells or behavioral references,
3. backend coordination may become more authoritative if that is required for
   maintainability and scale,
4. user-facing decentralization and encrypted private-state ownership remain
   non-negotiable.

## Active Workstreams

### A. Runtime and Session Reliability

Goals:
1. preserve startup and route liveness under degraded relay conditions,
2. keep identity/session continuity deterministic across restart/account switch,
3. prevent cross-owner mutations in runtime activation paths.

### B. Restore and Truth Convergence

Goals:
1. make restore import a canonical owner path,
2. preserve DM history and community state through new-window/new-device login,
3. stop compatibility bridges from thinning restored truth later.

### C. Community and Sync Integrity

Goals:
1. overhaul community systems around explicit modes and relay-backed guarantees,
2. preserve membership visibility and sendability convergence across devices where the chosen mode promises them,
3. maintain room-key and ledger recovery correctness,
4. prevent identity/scope drift from silently corrupting community state,
5. prefer honest stable community surfaces over unsupported exact live roster claims when runtime truth cannot be guaranteed.

### D. Realtime Voice Reliability

Goals:
1. stabilize invite/cancel/accept/rejoin timing convergence,
2. keep session ownership single-flight and stale-event safe,
3. provide explicit degraded/unsupported outcomes and diagnostics.

### E. Anti-Abuse and Trust Controls

Goals:
1. keep anti-abuse local-first and reason-coded,
2. preserve user/operator reversibility and explainability,
3. avoid plaintext scanning and centralized moderation semantics.

### F. UX and Performance

Goals:
1. prevent freeze/blank-page regressions and keep route warmup bounded to explicit owners,
2. keep large-list and media-heavy interactions responsive,
3. preserve mobile and desktop layout quality while protecting runtime budgets.

### G. Rewrite and Anti-Drift Discipline

Goals:
1. convert recent architecture/spec docs into executable `v1.4.0` scope,
2. modularize by behavioral owner boundaries instead of adding more compatibility layers,
3. ratchet tests and diagnostics so core trust paths survive future iteration.

## Milestone Slice Model (General)

Use this sequence for each major lane:

1. `M0 Baseline Lock`:
: owner map + gates + diagnostics capture readiness.
2. `M1 Implementation`:
: narrow owner-safe behavior slices.
3. `M2 Diagnostics + Replay`:
: gate probes and replay evidence.
4. `M3 Closeout`:
: release packet + docs sync + strict gates.

## Required Gates Per Slice

1. focused touched-owner tests,
2. `pnpm --dir apps/pwa exec -- tsc --noEmit --pretty false`,
3. `pnpm docs:check`,
4. release lane gates when preparing tag candidates.

## Core Flow Rule

Before pushing core-flow work, require:

1. code inspection on the canonical owner path,
2. explicit spec/contract or doc update,
3. focused automated tests,
4. manual runtime verification when the flow is relay-, lifecycle-, or cross-device-sensitive.

Verification order reference:
1. `docs/trust/20-core-function-verification-matrix.md`

## General Exit Criteria for a Release Train

1. automated gates are green on clean `main`,
2. manual replay evidence is recorded for fragile flows,
3. docs reflect architecture/release truth in canonical files,
4. no unresolved severe blocker is open at tag time.
