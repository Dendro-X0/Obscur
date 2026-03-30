# Current Roadmap

This is the canonical active roadmap.  
Version-specific phase plans are consolidated into general workstreams and milestone slices.

## Current Health Baseline (2026-03-29)

1. project is currently stable for active development,
2. no unresolved severe blocker is identified in active tracking,
3. high-fragility domains still require owner-safe, evidence-first iteration.

## Workstream Order (Canonical)

1. Stability and lifecycle ownership protection.
2. Community and membership integrity hardening.
3. Realtime voice reliability and convergence.
4. Privacy-preserving anti-abuse controls.
5. UX and performance polish.
6. Feature expansion only when prior lanes remain green.

## Active Workstreams

### A. Runtime and Session Reliability

Goals:
1. preserve startup and route liveness under degraded relay conditions,
2. keep identity/session continuity deterministic across restart/account switch,
3. prevent cross-owner mutations in runtime activation paths.

### B. Community and Sync Integrity

Goals:
1. preserve membership visibility and sendability convergence across devices,
2. maintain room-key and ledger recovery correctness,
3. prevent identity/scope drift from silently corrupting community state.

### C. Realtime Voice Reliability

Goals:
1. stabilize invite/cancel/accept/rejoin timing convergence,
2. keep session ownership single-flight and stale-event safe,
3. provide explicit degraded/unsupported outcomes and diagnostics.

### D. Anti-Abuse and Trust Controls

Goals:
1. keep anti-abuse local-first and reason-coded,
2. preserve user/operator reversibility and explainability,
3. avoid plaintext scanning and centralized moderation semantics.

### E. UX and Performance

Goals:
1. prevent freeze/blank-page regressions,
2. keep large-list and media-heavy interactions responsive,
3. preserve mobile and desktop layout quality while protecting runtime budgets.

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

## General Exit Criteria for a Release Train

1. automated gates are green on clean `main`,
2. manual replay evidence is recorded for fragile flows,
3. docs reflect architecture/release truth in canonical files,
4. no unresolved severe blocker is open at tag time.
