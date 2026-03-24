# 29 Versioned Major-Phase Plan (v1.0.10-v1.3.0)

_Last reviewed: 2026-03-23 (baseline commit 4c869a7)._

This document defines the remaining post-`v1.0.9` release sequence as three major phases:
1. one major phase completed before `v1.1.0`,
2. one major phase completed before `v1.2.0`,
3. one major phase completed before `v1.3.0`.

Tags such as `v1.0.10`, `v1.1.1`, and `v1.2.2` are milestone carriers inside these major phases.

## Entry Gate Before Starting v1.0.10

1. Close pending `M7` CP3 evidence attachment:
: run `copy(window.obscurM7AntiAbuseReplay?.runPeerCooldownReplayCaptureJson({ clearAppEvents: true }))`
: and attach output in roadmap/issue evidence notes.
2. Re-run strict docs/version/release preflight on clean `main`:
: `pnpm version:check`
: `pnpm docs:check`
: `pnpm release:preflight -- --tag v1.0.10`.

## Major-Phase Mapping

1. `Phase A` (`M8`) `v1.0.10 -> v1.1.0`:
: community platform completion + lifecycle resilience.
2. `Phase B` (`M9`) `v1.1.1 -> v1.2.0`:
: secure voice communication rollout.
3. `Phase C` (`M10`) `v1.2.1 -> v1.3.0`:
: anti-abuse intelligence + trust controls.

## Checkpoint Policy (All Versions)

For every version tag in this sequence:
1. `CP1` implementation checkpoint:
: bounded owner-safe feature slice + focused tests.
2. `CP2` diagnostics checkpoint:
: app-event and digest/triage visibility for new decision paths.
3. `CP3` runtime evidence checkpoint:
: manual two-device replay bundle captured and attached.
4. `CP4` release checkpoint:
: strict clean-tree release preflight and tag publish.

## Phase A Detail - M8 (v1.0.10 -> v1.1.0)

Goal:
1. make communities sustainable under account-switch/restart/recover flows while expanding operator/community UX.

### v1.0.10 (M8-CP1)

Scope:
1. canonical community identity convergence (name, member/admin coverage, operator role),
2. deterministic join/sendability reconciliation when room-key and ledger evidence diverge,
3. community info navigation/management contracts without duplicated owners.

Evidence:
1. focused tests for touched group/membership owners,
2. typecheck and diagnostics contract tests.

### v1.0.11 (M8-CP2)

Scope:
1. expand diagnostics and replay helpers for community lifecycle anomalies,
2. add explicit reason-coded outcomes for disband/leave/join repair transitions,
3. update maintainer matrix for two-device account-switch replay.

Evidence:
1. digest summary counters and capture helpers exposed,
2. runbook + matrix docs updated with concrete replay steps.

### v1.1.0 (M8-CP3/CP4 closeout)

Scope:
1. execute full manual matrix and attach evidence bundle,
2. burn down regressions discovered in CP3 replay,
3. publish stable `v1.1.0` milestone.

Mandatory release gates:
1. `pnpm version:check`
2. `pnpm docs:check`
3. focused `vitest` suites for touched owners
4. `pnpm --dir apps/pwa exec tsc --noEmit --pretty false`
5. `pnpm release:test-pack -- --skip-preflight`
6. `pnpm release:preflight -- --tag v1.1.0`

## Phase B Detail - M9 (v1.1.1 -> v1.2.0)

Goal:
1. move secure voice from bounded beta slices to stable operator-ready behavior.

### v1.1.1 (M9-CP1)

Scope:
1. real-time voice lifecycle hardening for small-room join/recover/leave reliability,
2. clear unsupported/degraded outcomes across runtime capability combinations,
3. preserve existing DM/group transport invariants while voice paths are active.

Evidence:
1. focused voice lifecycle tests and typed contract validation,
2. no optimistic-success path without peer/session evidence.

### v1.1.2 (M9-CP2)

Scope:
1. unify diagnostics for async voice notes + real-time session transitions + delete convergence,
2. improve replay capture helpers for weak-network and account-switch voice sessions,
3. update maintainers' triage and replay matrix documentation.

Evidence:
1. digest summary coverage for voice risk counters,
2. capture helper outputs accepted in manual replay dry-run.

### v1.2.0 (M9-CP3/CP4 closeout)

Scope:
1. complete two-device weak-network replay evidence for voice + deletion convergence,
2. close critical regressions from long-session voice usage,
3. publish stable `v1.2.0` milestone.

Mandatory release gates:
1. `pnpm version:check`
2. `pnpm docs:check`
3. focused `vitest` suites for touched owners
4. `pnpm --dir apps/pwa exec tsc --noEmit --pretty false`
5. `pnpm release:test-pack -- --skip-preflight`
6. `pnpm release:preflight -- --tag v1.2.0`

## Phase C Detail - M10 (v1.2.1 -> v1.3.0)

Goal:
1. complete privacy-preserving anti-abuse intelligence and performance reliability closeout for `v1.3.0`.

### v1.2.1 (M10-CP1)

Scope:
1. optional signed shared-intel path and relay risk scoring contracts,
2. attack-mode safety profile toggles with explicit local-first reason codes,
3. strict no-central-moderation/no-plaintext-scanning enforcement at contract boundaries.

Evidence:
1. anti-abuse decision tests with deterministic reason-code snapshots,
2. policy toggles verified without owner overlap.

### v1.2.2 (M10-CP2)

Scope:
1. anti-abuse/operator UX clarity improvements with reversible controls,
2. route/startup/chat responsiveness hardening for high-load sessions,
3. replay and digest tooling for long-session anti-abuse/performance triage.

Evidence:
1. diagnostics bundle includes anti-abuse + responsiveness signals,
2. runbook guidance updated for incident-class triage order.

### v1.3.0 (M10-CP3/CP4 closeout)

Scope:
1. final two-device/long-session evidence matrix execution,
2. release-blocker burn-down and strict stability verification,
3. publish stable `v1.3.0` milestone.

Mandatory release gates:
1. `pnpm version:check`
2. `pnpm docs:check`
3. focused `vitest` suites for touched owners
4. `pnpm --dir apps/pwa exec tsc --noEmit --pretty false`
5. `pnpm release:test-pack -- --skip-preflight`
6. `pnpm release:preflight -- --tag v1.3.0`

## Non-Negotiable Rules During This Sequence

1. no new parallel owners for runtime/sync/identity/transport/community lifecycle,
2. no release claim without CP3 runtime evidence attachment,
3. no optimistic success state without explicit evidence-backed transition,
4. docs (`CHANGELOG.md`, `ISSUES.md`, and impacted `/docs`) must be updated at each milestone closeout.
