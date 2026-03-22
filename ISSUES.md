# Issue Status Snapshot (v0.9.6 to v1 Readiness Monitoring)

Last updated: 2026-03-22

This file tracks runtime issue status during late v0.9.6 stabilization and pre-v1 readiness hardening.

## Current State

- Active release blockers in this file: none.
- Previous v0.9.2 critical incidents are now marked resolved in manual verification and moved to monitoring status.
- Verification source:
  - manual two-device replay + navigation stress replay on dev server,
  - automated reliability/type/docs/release-pack gates passing in this workspace.

## v1 Readiness Status

- Pre-v1 hardening plan is tracked at:
  - `docs/19-v1-readiness-stability-plan.md`.
- Current execution focus:
  - preserve stability and sync confidence while avoiding architectural churn,
  - close only reproducible high-risk regressions before `v1.0.0`.
- M0 baseline gate replay is green:
  - `pnpm version:check`,
  - `pnpm docs:check`,
  - `pnpm release:test-pack -- --skip-preflight`.
- M1 automated reliability replay is green:
  - `auth-gateway`, `auth-screen`, `app-shell`, `mobile-tab-bar`, `title-bar-profile-switcher`,
  - `5 files / 21 tests passed`.
- M1 manual soak replay is complete:
  - restart/login continuity on desktop + web remained stable,
  - route-transition stress under live relay conditions remained stable.
- M2 automated sync/deletion reliability replay is green:
  - `log-app-event`, `encrypted-account-backup-service`, `incoming-dm-event-handler`,
  - `use-conversation-messages.integration`, `message-persistence-service`,
  - `message-delete-tombstone-store`, `runtime-messaging-transport-owner-provider`,
  - `7 files / 111 tests passed`.
- M2 group-chat delete-for-everyone convergence hardening landed:
  - incoming and local group delete paths now emit MessageBus delete events to canonical chat state, preventing receiver-side stale visibility.
- M2 manual two-device soak replay is complete:
  - DM continuity + group membership/sendability + media parity + delete-for-everyone no-resurrection were manually validated in dev-server replay.
- M3 strict preflight replay is green on clean `main`:
  - `pnpm release:preflight -- --tag v1.0.0`.
- Remaining pre-v1 gate:
  - keep manual replay matrix evidence synchronized in maintainer docs while final tag planning converges.

## v0.9.5 M0 Status

- M0 started on 2026-03-21 with a docs-first scope lock and no runtime-owner changes.
- No new active blockers opened during M0 kickoff.
- First-response incident capture remains:
  - `copy(window.obscurM0Triage?.captureJson(300))`.

## v0.9.5 M1 Status

- M1 started on 2026-03-21 with session + navigation guardrails only (no owner-model expansion).
- Added private-key remember-me continuity regression coverage in `auth-screen` focused tests.
- Focused M1 route/session guardrail suites are currently green in local verification.

## v0.9.5 M2 Status

- M2 started on 2026-03-21 with diagnostics-first sync-confidence hardening (no new sync owner paths).
- Cross-device digest coverage now includes DM hydration split signals and membership sendability drift signals.
- `getCrossDeviceSyncDigest` now exposes compact summary risk signals for:
  - `selfAuthoredDmContinuity`,
  - `membershipSendability`.
- M2 media-parity diagnostics slice added:
  - account-sync hydrate/merge/apply diagnostics now include attachment evidence counts,
  - restore history regression diagnostics now include attachment-drop deltas,
  - digest summary now exposes `mediaHydrationParity`.
- Added deterministic digest risk-level matrix coverage for media parity (`high`, `watch`, `none`) in focused `log-app-event` tests.
- Message deletion convergence hardening landed:
  - dual deletion UX (`Delete for me`, `Delete for everyone`) is implemented with sender-authority constraints,
  - recipient-side deletion matching now supports multi-id fallback paths (payload id + tag ids + derived fallback ids),
  - persistent profile-scoped delete tombstones now prevent deleted messages from reappearing after restore/hydration replay.

## v0.9.5 M3 Status

- M3 started on 2026-03-21 with low-risk UI contrast/visibility polish.
- Vault light-mode readability and control visibility slice landed:
  - filter chips + pagination controls improved for non-hover readability in Light mode,
  - detail overlay control surfaces (close/action/zoom/reset) now use stronger theme-safe contrast.
- Shared media-control visibility slice landed:
  - global media-viewer control tokens now provide stronger at-rest contrast in Light mode,
  - chat lightbox top-right control cluster now has explicit contrast-safe container styling.
- Additional chat discovery surface contrast fix landed:
  - new-chat dialog card border now uses theme-safe light/dark border tokens.
- Additional inline media playback contrast fix landed:
  - chat `audio-player` and `video-player` control docks now use theme-safe Light/Dark surfaces with improved at-rest readability.
- Validation for this slice is green:
  - `pnpm -C apps/pwa build`,
  - `pnpm -C apps/pwa exec tsc --noEmit --pretty false`,
  - `pnpm release:test-pack -- --skip-preflight`.

## v0.9.5 M4 Status

- M4 stabilization started on 2026-03-21 with automated release-gate replay first.
- Automated gates currently green in this workspace:
  - `pnpm version:check`,
  - `pnpm docs:check`,
  - `pnpm release:integrity-check`,
  - `pnpm release:artifact-version-contract-check`,
  - `pnpm release:ci-signal-check`,
  - `pnpm release:test-pack -- --skip-preflight`,
  - `pnpm -C apps/pwa exec vitest run`,
  - `pnpm -C apps/pwa exec tsc --noEmit --pretty false`,
  - `pnpm -C apps/pwa build`.
- Preflight status:
  - `pnpm release:preflight -- --tag v0.9.5` fails fast while working tree is dirty (expected until release staging).
- Remaining before tag preparation:
  - manual replay matrix for M1/M2/M3 acceptance in `docs/08-maintainer-playbook.md`,
  - clean-tree `pnpm release:preflight -- --tag v0.9.5`.
- Stabilization regression resolved in M4:
  - fixed `NostrMessengerContent` hook-order crash (`Rendered fewer hooks than expected`) by moving memo hooks above identity-gate early-return branches in `main-shell`,
  - added focused regression test `app/features/main-shell/main-shell.test.tsx`.

## Resolved in Verification (Monitoring)

## 1) Login state persistence regression ("Remember Me" unreliable)

- Status: Resolved in dev-server verification; Monitoring.
- Resolution snapshot:
  - remembered-session continuity and restart behavior revalidated across desktop and web paths,
  - mismatch/error paths remain explicit instead of silent session drift.

## 2) Page transition freeze and sidebar interaction lock

- Status: Resolved in dev-server verification; Monitoring.
- Resolution snapshot:
  - route transitions remained interactive under replay stress,
  - no unrecoverable sidebar lock/blank-page freeze reproduced in verified runs,
  - route-stall fallback + route-mount diagnostics now provide direct freeze triage evidence when needed.

## 3) Infinite loading loops after identity/profile disruption

- Status: Resolved in dev-server verification; Monitoring.
- Resolution snapshot:
  - startup fallback and runtime activation behavior remained recoverable in validation scenarios,
  - no persistent infinite-loading loop reproduced in the verified runs.

## 4) Cross-device DM history regression (self-authored messages missing)

- Status: Resolved in dev-server verification; Monitoring.
- Resolution snapshot:
  - targeted two-device restore replay preserved self-authored DM history in validated conversations,
  - backup hydration/restore merge diagnostics now expose stronger evidence paths for future triage.

## 5) Media history hydration mismatch (desktop vs web)

- Status: Resolved in dev-server verification; Monitoring.
- Resolution snapshot:
  - historical media presence was revalidated in the tested restore/sync scenarios,
  - desktop/web parity held in the verified replay set.

## 6) Group/community state inconsistencies under sync churn

- Status: Resolved in dev-server verification; Monitoring.
- Resolution snapshot:
  - membership visibility and sendability remained converged in verified cross-device flows,
  - prior room-key/membership drift symptoms were not reproduced in acceptance runs.

## 7) Message deletion reappearance and incomplete recipient removal

- Status: Resolved in focused regression verification; Monitoring.
- Resolution snapshot:
  - sender-issued `Delete for everyone` now resolves on recipient side across multiple id forms,
  - deleted messages no longer reappear after projection/hydration replay due to persistent tombstone filtering.

## Monitoring Guardrails

1. Keep two-device replay as required evidence for any future claim of regression fix.
2. Preserve canonical owner boundaries (startup owner, relay owner, account-sync owner).
3. Treat route-mount and M0 triage captures as first-response diagnostics for new freeze reports.
4. Promote issues back to "Active blocker" immediately if reproduced in release-candidate or production telemetry.
