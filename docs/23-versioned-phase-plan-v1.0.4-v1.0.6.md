# 23 Versioned Phase Plan (v1.0.4-v1.0.6)

_Last reviewed: 2026-03-23 (baseline commit 2539675)._

This document locks a version-bound execution cadence:
1. one milestone per version,
2. explicit checkpoint commits inside each milestone,
3. no release until checkpoint evidence is complete.

## Version-Milestone Mapping

1. `v1.0.4` -> `M2` closeout (identity/sync hardening + async voice Stage A completion).
2. `v1.0.5` -> `M3` delivery (real-time voice beta foundation + community operator tooling).
3. `v1.0.6` -> `M4` stabilization (bug burn-down + rollout discipline).

## Checkpoint Policy

For every version milestone:
1. `CP1` implementation checkpoint:
: narrow-scope owner-safe code slice merged with focused tests.
2. `CP2` diagnostics checkpoint:
: required app-event diagnostics emitted and visible in triage digest surfaces.
3. `CP3` runtime evidence checkpoint:
: manual two-device replay evidence captured.
4. `CP4` release checkpoint:
: version/docs/release gates green, then tag.

Checkpoint commit naming:
1. `feat(mX): <slice>` for feature slices.
2. `fix(mX): <stability-fix>` for regressions found during checkpoint replay.
3. `docs(mX): <checkpoint-status>` for closeout/evidence updates.

## v1.0.4 - M2 Closeout

Goal:
1. close M2 with deterministic cross-device confidence and voice-note Stage A completion evidence.

Scope:
1. search-jump and long-history navigation diagnostics + reliability hardening,
2. startup/profile-binding mismatch diagnostics closeout,
3. voice-note fallback/unsupported-path determinism across runtimes.

Checkpoints:
1. `CP1`: ship remaining M2 reliability fixes from active incidents.
2. `CP2`: confirm diagnostics events for search-jump/startup/scope mismatch are digest-visible.
3. `CP3`: manual two-device evidence bundle:
: DM/group/media continuity,
: account-switch/restart stability,
: voice-note supported vs unsupported behavior.
4. `CP4`: release gate replay:
: `pnpm version:check`
: `pnpm docs:check`
: focused `vitest` suites for touched owners
: `pnpm --dir apps/pwa exec tsc --noEmit --pretty false`
: `pnpm release:test-pack -- --skip-preflight`

Release outcome:
1. tag and publish `v1.0.4` only after `CP1-CP4` all pass.

## v1.0.5 - M3 Delivery

Goal:
1. deliver beta-ready real-time voice/community-operator value with strict owner boundaries.

Scope:
1. real-time voice beta foundation (small-room path + capability gates),
2. operator workflows for community health/governance visibility,
3. optional anti-abuse shared-intel integration path (no centralized moderation).

Checkpoints:
1. `CP1`: real-time voice foundation contracts + fallback errors.
2. `CP2`: operator workflow completion with reason-coded outcomes.
3. `CP3`: weak-network/manual replay evidence for voice + operator flows.
4. `CP4`: full release gates and `v1.0.5` tag.

## v1.0.6 - M4 Stabilization

Goal:
1. harden rollout quality before broader community expansion.

Scope:
1. burn down regressions from `v1.0.4` + `v1.0.5` feedback,
2. enforce patch-slice discipline and owner consistency,
3. lock maintainers' rollout playbook updates.

Checkpoints:
1. `CP1`: high-risk regression fixes with focused tests.
2. `CP2`: diagnostics/triage updates for all resolved incident classes.
3. `CP3`: long-session manual soak + two-device replay evidence.
4. `CP4`: strict clean-tree preflight and `v1.0.6` release tag.

## Working Rules During This Sequence

1. No adding parallel lifecycle owners for runtime/sync/identity/transport.
2. No release claims without manual replay evidence plus diagnostics capture.
3. Fix by subtraction where overlap paths cause ambiguity.
4. Keep each checkpoint commit reviewable and bounded.
