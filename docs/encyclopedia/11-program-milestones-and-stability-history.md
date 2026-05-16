# 11 Program Milestones and Stability History

_Last reviewed: 2026-03-29 (baseline commit cad5779e)._

This is the canonical consolidation of the historical versioned planning documents that were previously tracked as `docs/17-*` through `docs/36-*`.

## Purpose

1. Preserve the full engineering context without forcing maintainers to read version-by-version plans.
2. Keep durable architecture and operational lessons in one general document.
3. Allow historical version docs to be archived or removed without losing execution truth.

## Program Timeline (Consolidated)

### Recovery Era (`v0.9.2` to `v0.9.3`)

Primary outcomes:
1. Shifted from ad-hoc fixes to owner-based recovery.
2. Introduced fail-open startup behavior to avoid infinite-load deadlocks.
3. Prioritized deterministic sync and history integrity over feature expansion.

Primary risk themes discovered:
1. login/session continuity regressions,
2. route/page transition lockups,
3. startup loops,
4. cross-device self-authored history drift,
5. media hydration parity drift.

### Readiness Era (Pre-`v1`)

Primary outcomes:
1. Formalized release gating (`docs + tests + preflight + manual replay`).
2. Required two-user reasoning for sync, delivery, and deletion behavior.
3. Locked scope to reliability and architecture safety before `v1`.

### Official Launch Era (`v1.0.0`)

Primary outcomes:
1. Converted readiness evidence into a deterministic release procedure.
2. Added explicit post-release stabilization policy (patch-only for production-impacting regressions).
3. Enforced release-claim contract: no behavior claim without runtime evidence.

### Post-`v1` Major-Phase Era (`M0` through `M10`, completed through `v1.3.0`)

Primary outcomes:
1. Community lifecycle convergence hardening,
2. realtime voice session ownership and stability hardening,
3. anti-abuse trust controls and diagnostics gates,
4. long-session UX/performance reliability gates,
5. stronger account-scope and startup binding diagnostics.

## Durable Program Patterns

These patterns came from repeated failures and are now required defaults:

1. One lifecycle owner per domain path (runtime, sync, transport, identity).
2. Evidence-backed state transitions only (never optimistic-only claims).
3. Fail-open UX states for degraded conditions (never silent deadlocks).
4. Replay-matrix execution for fragile cross-device and realtime flows.
5. Compact one-copy diagnostics capture before architectural edits.

## Generalized Milestone Model

Use this model for new phases (without tying to version numbers):

1. `Baseline Lock`
: gate replay, owner confirmation, triage capture readiness.
2. `Core Reliability`
: session/startup/navigation/sync integrity.
3. `Feature Reliability`
: scoped enhancement with deterministic degraded behavior.
4. `Soak and Replay`
: two-user and cross-runtime long-session replay.
5. `Closeout`
: strict release gates + manual evidence + docs synchronization.

## Generalized Checkpoint Model

Use checkpoint slices (CP1-CP4 style) as a reusable execution template:

1. `CP1` owner-safe implementation,
2. `CP2` diagnostics and gate probes,
3. `CP3` replay evidence bundle,
4. `CP4` release-readiness closeout.

## Current Health Snapshot

As of 2026-03-29:
1. project health is stable,
2. no unresolved severe blocker is currently identified in active tracking,
3. fragility remains structural, so guardrails and evidence-first workflow stay mandatory.

## Canonical Success Criteria Going Forward

1. Any architecture-affecting change updates canonical docs in the same PR.
2. Any high-risk behavior change lands with focused tests and diagnostics.
3. Any release claim maps to:
: merged owner-safe code,
: passing automated gates,
: manual runtime evidence where user-visible behavior is involved.

## Archive Compatibility Note

Historical docs in `docs/archive/versioned/` remain useful for audit and forensic detail, but they are not required as planning entrypoints after this consolidation.
