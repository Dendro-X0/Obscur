# 19 v1 Readiness Stability Plan

_Last reviewed: 2026-03-21 (baseline commit deb2882)._

This is the final pre-v1 hardening plan.

Goal:
- ship `v1.0.0` with stability, sync-confidence, and deterministic release evidence,
- avoid disruptive architecture changes,
- close only high-risk reliability gaps.

## Constraints

1. No new lifecycle/sync owners.
2. No parallel mutation pipelines for the same state.
3. Prefer subtraction over layering.
4. Every fix must leave one of:
   - focused test,
   - diagnostics surface,
   - contract/doc clarification.

## Milestones

## M0 - Baseline Lock

Scope:
1. Freeze v1 scope to reliability and bug prevention only.
2. Reconfirm gate baseline on current `main`.
3. Keep first-response triage path mandatory:
: `copy(window.obscurM0Triage?.captureJson(300))`.

Acceptance:
1. `pnpm version:check`
2. `pnpm docs:check`
3. `pnpm release:test-pack -- --skip-preflight`

Current execution status (started 2026-03-21):
1. Baseline gates are green on `main`:
: `pnpm version:check`
: `pnpm docs:check`
: `pnpm release:test-pack -- --skip-preflight`

## M1 - Session and Route Soak

Scope:
1. Restart/login continuity replay (desktop + web).
2. Route liveness stress replay (`chats -> network -> groups -> settings -> chats`).
3. Confirm no lockups/blank screens under degraded relay windows.

Acceptance:
1. No forced relogin unless explicit mismatch.
2. No unrecoverable route freeze.
3. Event evidence captured when anomaly appears (`auth.auto_unlock_*`, `navigation.route_*`).

Current execution status (started 2026-03-21):
1. Focused M1 automated suites are green:
: `pnpm -C apps/pwa exec vitest run app/features/auth/components/auth-gateway.test.tsx app/features/auth/components/auth-screen.test.tsx app/components/app-shell.test.tsx app/components/mobile-tab-bar.test.tsx app/components/desktop/title-bar-profile-switcher.test.ts`
: `5 files / 21 tests passed`.
2. Manual soak replay completed (desktop + web):
: restart/login continuity remained stable,
: route-transition stress did not reproduce unrecoverable freeze/blank page.

## M2 - Cross-Device Sync and Deletion Soak

Scope:
1. Two-device DM continuity replay (self-authored history retained).
2. Group membership/sendability replay (room key and member state converge).
3. Media parity replay (desktop/web restore consistency).
4. Delete-for-everyone convergence replay (no resurrection).

Acceptance:
1. `getCrossDeviceSyncDigest(400).summary` risk signals are `none` or justified `watch`.
2. No message resurrection after reopen/scroll/new-message churn.
3. Any drift has attached digest + recent event export before fix iteration.

Current execution status (started 2026-03-21):
1. Focused M2 automated suites are green:
: `pnpm -C apps/pwa exec vitest run app/shared/log-app-event.test.ts app/features/account-sync/services/encrypted-account-backup-service.test.ts app/features/messaging/controllers/incoming-dm-event-handler.test.ts app/features/messaging/hooks/use-conversation-messages.integration.test.ts app/features/messaging/services/message-persistence-service.test.ts app/features/messaging/services/message-delete-tombstone-store.test.ts app/features/messaging/providers/runtime-messaging-transport-owner-provider.test.tsx`
: `7 files / 111 tests passed`.
2. Group delete-for-everyone convergence hardening landed:
: group `kind:5` delete events now emit canonical MessageBus delete events so chat views on all devices apply removals through the same message owner path.
3. Manual two-device soak remains next:
: DM continuity replay,
: group membership/sendability replay,
: media parity replay,
: delete-for-everyone no-resurrection replay.

## M3 - Release Candidate Hardening

Scope:
1. Full clean-tree strict preflight for release tag.
2. Manual acceptance matrix replay from `docs/08-maintainer-playbook.md`.
3. Changelog/issues/docs synchronization for v1 release truth.

Acceptance:
1. `pnpm release:preflight -- --tag v1.0.0` passes on clean `main`.
2. Manual replay matrix recorded (session, route, two-device sync, deletion).
3. Release note claims map to runtime evidence and tests.

## Execution Rules

1. Fix only reproducible high-risk regressions.
2. Keep PR/commit slices narrow and reversible.
3. If a regression appears during M1-M3:
: stop expansion, capture triage bundle, repair canonical owner path first.

## Completion Definition

v1 readiness is complete when:
1. M0-M3 acceptance is all green,
2. no active blocker remains in `ISSUES.md`,
3. strict preflight and tag workflow are reproducible without manual repair steps.
