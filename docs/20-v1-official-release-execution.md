# 20 v1 Official Release Execution

_Last reviewed: 2026-03-22 (baseline commit f2a85b3)._

This runbook is the canonical execution path for shipping `v1.0.0`.

Goal:
- convert current readiness confidence into a deterministic public launch,
- avoid last-minute architecture churn,
- keep release claims strictly aligned with runtime evidence.

## Scope Lock

1. No new lifecycle/sync owners.
2. No parallel mutation pipelines.
3. Only blocker-grade fixes are allowed before tag.
4. If a new regression appears, stop expansion and repair canonical owner path first.

## Launch Milestones

## R0 - Freeze and Evidence Snapshot

Acceptance:
1. `ISSUES.md` shows no active blockers.
2. `docs/19-v1-readiness-stability-plan.md` M0-M3 status is current.
3. `CHANGELOG.md` includes all high-risk fixes landed since `v0.9.5`.

## R1 - Automated Gate Replay (Clean Tree)

Run in order:
1. `pnpm version:check`
2. `pnpm docs:check`
3. `pnpm release:integrity-check`
4. `pnpm release:artifact-version-contract-check`
5. `pnpm release:ci-signal-check`
6. `pnpm release:test-pack -- --skip-preflight`
7. `pnpm release:preflight -- --tag v1.0.0`

Acceptance:
1. All commands pass on clean `main`.
2. No manual retry hacks required.

## R2 - Manual Matrix Replay (Launch Truth)

Use `docs/08-maintainer-playbook.md` and capture evidence for:
1. Session and route continuity (desktop + web).
2. Two-device sync continuity (DM/group/media).
3. Delete-for-everyone no-resurrection (DM + group).
4. Startup fail-open recoverability under degraded relay conditions.

Acceptance:
1. Matrix results recorded in release notes draft.
2. Any anomaly has triage export attached (`window.obscurM0Triage?.captureJson(300)` or digest equivalent).

## R3 - Tag and Publish

1. Ensure working tree is clean.
2. Bump/sync to `1.0.0`:
: `pnpm version --no-git-tag-version 1.0.0`
: `pnpm version:sync`
: `pnpm version:check`
3. Commit release version + docs.
4. Run strict preflight:
: `pnpm release:preflight -- --tag v1.0.0`
5. Push `main`.
6. Create and push tag:
: `git tag v1.0.0`
: `git push origin v1.0.0`

Acceptance:
1. Release workflow starts from tag push.
2. Artifact verification and publish lanes complete.

## R4 - Post-Release Stabilization Window

Window:
1. First 72 hours after publish.

Watch:
1. Login/session continuity regressions.
2. Route freeze/blank-page regressions.
3. Cross-device DM/group/media drift.
4. Delete resurrection regressions.

Policy:
1. Patch only production-impacting regressions.
2. Every patch must include focused test or diagnostics addition.
3. Use patch tags (`v1.0.1`, `v1.0.2`) rather than retagging.

## Release Claims Contract

Before announcing v1 publicly:
1. Every claim in release notes must map to:
: a merged code change,
: a passing gate,
: and manual/runtime evidence when user-visible behavior is involved.
2. Do not market unresolved monitored risk as fully solved.

