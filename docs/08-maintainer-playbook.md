# 08 Maintainer Playbook and Continuation Handoff

_Last reviewed: 2026-03-21 (baseline commit 399ef6a)._

This file is the minimal context needed to resume the project after a pause.

## v1 Official Launch Matrix

For `v1.0.0`, run these manual checks and attach concise evidence snapshots:

1. Session and route continuity:
: desktop + web restart/login continuity and route stress (`chats -> network -> groups -> settings -> chats`).
2. Two-device sync continuity:
: DM self-authored history, group membership/sendability, and media parity.
3. Deletion convergence:
: `Delete for everyone` in DM and group, then reopen/scroll/new-message churn verification.
4. Incident capture on first anomaly:
: `copy(window.obscurM0Triage?.captureJson(300))` or digest fallback.

Canonical release execution sequencing:
- `docs/20-v1-official-release-execution.md`.

## Post-v1 M0 Baseline Checklist

Use this before starting any post-v1 feature implementation (`docs/21-post-v1-value-roadmap.md`):

1. Replay baseline gates:
: `pnpm version:check`
: `pnpm docs:check`
: `pnpm release:test-pack -- --skip-preflight`
2. Confirm no active blocker is opened before expansion:
: `ISSUES.md` must remain blocker-clean or have explicit owner/risk notes.
3. Prepare first-response diagnostics capture path:
: `copy(window.obscurM0Triage?.captureJson(300))`
: `copy(JSON.stringify(window.obscurAppEvents.getCrossDeviceSyncDigest?.(400), null, 2))` (when sync/drift symptoms appear).
4. Map intended change to canonical owners before coding:
: `docs/14-module-owner-index.md` + `docs/12-core-architecture-truth-map.md`.

## Current State Snapshot

- Cross-platform beta release pipeline is wired through GitHub Releases.
- Release workflow now supports dynamic publication: desktop/web release verification and manual publish are not blocked by Android lane failures, with explicit Android status evidence in workflow summary.
- Runtime architecture has moved toward explicit ownership and contract-first behavior.
- Docs were intentionally compacted to reduce maintenance overhead and token cost.
- The v0.9.2 constrained-release blocker set was revalidated in v0.9.3 manual acceptance and moved to monitoring in `ISSUES.md`.

## Monitored Risk Areas

See `ISSUES.md` for user-facing status. Engineering focus remains:

1. Cross-device account/session consistency (password/session restore behavior).
2. Direct-message history consistency after device/account synchronization.
3. Relay instability handling under partial outages.
4. Navigation liveness failures (page-transition freezes and sidebar interaction lock).
5. Infinite startup/loading loop recovery.
6. Historical media hydration parity across desktop/web after restore.

v0.9.2 direction lock:
- prioritize account data synchronization reliability as the primary engineering lane before additional feature expansion.
- treat relay-backed auto restore as best-effort and keep a deterministic manual portability fallback available.

relay foundation execution lane:
- follow `docs/15-relay-foundation-hardening-spec.md` phase order.
- do not start relay behavior rewrites before Phase 1 baseline capture is reproducible.

## Deterministic Manual Portability Fallback

When relay evidence is degraded or cross-device restore is incomplete, use Settings `Profile -> Account Sync -> Manual portability`:

1. Export `Portable Bundle` on source device (identity must be unlocked).
2. Transfer the JSON bundle securely.
3. Import `Portable Bundle` on target device while logged into the same account key.

Contracts:
- bundle import is rejected when bundle `publicKeyHex` does not match active account.
- bundle import restores through the canonical backup-apply path and canonical append path (when available).
- portability fallback is local-transfer based and does not claim relay delivery proof.

## Default Recovery Heuristic

When a core flow breaks:

1. Identify canonical owner module.
2. List all parallel code paths mutating the same state.
3. Remove or isolate non-canonical mutations.
4. Add diagnostics at the canonical boundary.
5. Repair behavior only after ownership is clear.

## High-Value Debug Surfaces

- Runtime and app events: `apps/pwa/app/shared/log-app-event.ts`
- Reliability metrics: `apps/pwa/app/shared/reliability-observability.ts`
- Relay observability: `apps/pwa/app/features/relays/services/relay-resilience-observability.ts`
- Messaging diagnostics: `apps/pwa/app/features/messaging/services/delivery-diagnostics-store.ts`
- Cross-device history diagnostics (browser console app events):
: `account_sync.backup_payload_hydration_diagnostics`
: `account_sync.backup_restore_merge_diagnostics`
: `account_sync.backup_restore_apply_diagnostics`
: `messaging.legacy_migration_diagnostics`
: `messaging.conversation_hydration_diagnostics`
: `messaging.conversation_hydration_id_split_detected`
- App-event export helper:
: `window.obscurAppEvents.getRecent(200)`
: `window.obscurAppEvents.findByName("messaging.conversation_hydration_id_split_detected", 20)`
: `window.obscurAppEvents.getDigest(300)` (compact summary when raw logs are too large)
: `window.obscurAppEvents.findByName("auth.auto_unlock_recovered_native_session", 20)` (M1 native-session retry evidence)

### Relay Foundation Baseline Capture

For relay/startup regressions, always capture this compact bundle first:

1. `window.obscurWindowRuntime.getSnapshot()`
2. `window.obscurRelayRuntime.getSnapshot()`
3. `window.obscurRelayTransportJournal.getSnapshot()`
4. `window.obscurAppEvents.getDigest(300)`

Unified capture helper (preferred):
- `window.obscurM0Triage?.capture(300)`
- `copy(window.obscurM0Triage?.captureJson(300))`

Helper location:
- `apps/pwa/app/shared/m0-triage-capture.ts` (installed at app boot in `app/components/providers.tsx`)

Then map symptoms with:
- `docs/13-relay-and-startup-failure-atlas.md`
- `docs/14-module-owner-index.md`

### v0.9.5 M0 Release-Candidate Manual Replay Checklist

Run this checklist before promoting any `v0.9.5` release candidate:

1. Restart/login continuity replay (desktop + web):
: close and relaunch both runtimes without explicit logout, then verify remembered identity can unlock through the canonical auth path.
2. Route-transition liveness replay:
: rapid-switch `chats -> network -> groups -> settings -> chats` and verify no unrecoverable blank page/sidebar lock.
3. Two-device sync confidence replay:
: verify DM/group/media history parity after target-device restore and thread open.
4. Triage capture export on first anomaly:
: run `copy(window.obscurM0Triage?.captureJson(300))` and attach output before attempting secondary fixes.
5. Owner-boundary confirmation:
: map the failing symptom to canonical owners in `docs/14-module-owner-index.md` before code changes.

### v0.9.5 M1 Session and Navigation Replay Checks

When validating M1 guardrails, capture these event probes in addition to normal manual replay:

1. Auto-unlock scan and native fallback evidence:
: `window.obscurAppEvents.findByName("auth.auto_unlock_scan", 20)`
: `window.obscurAppEvents.findByName("auth.auto_unlock_recovered_native_session", 20)`
2. Route fallback guard evidence:
: `window.obscurAppEvents.findByName("navigation.route_stall_hard_fallback", 20)`
: `window.obscurAppEvents.findByName("navigation.route_settled", 20)`
3. Route mount probe evidence:
: `window.obscurAppEvents.findByName("navigation.route_mount_probe_slow", 20)`
: `window.obscurAppEvents.findByName("navigation.route_mount_probe_settled", 20)`

### Post-v1 M1 Anti-Abuse Replay Checks

For incoming request-spam verification, capture these evidence points:

1. Incoming request quarantine events:
: `window.obscurAppEvents.findByName("messaging.request.incoming_quarantined", 30)`
2. Last incoming routing decision snapshot:
: `window.obscurDeliveryDiagnostics?.getSnapshot()?.lastIncoming`
3. Compact anomaly export for handoff:
: `copy(window.obscurM0Triage?.captureJson(300))`
4. Requests inbox UX signal check:
: when quarantine events exist, Requests panel should display an anti-spam summary banner and per-peer anti-spam signal badges for affected senders.

### Post-v1 M1 Community Operator Visibility Replay Checks

For community-governance visibility verification in Group Management:

1. Operator health summary cards:
: in Community `Members` tab, verify counts render for active/known members, online/offline split, kick-vote pressure, and lifecycle drift (left/expelled/disbanded).
2. Governance signal feed:
: verify `Operator Signals` shows severity-coded entries (`info`/`warn`/`critical`) consistent with current membership and vote state.
3. Kick pressure projection:
: when kick votes are present, verify highest pressure card reflects vote/quorum ratio and near-quorum marker.
4. Deterministic helper boundary:
: preserve typed helper as canonical summarizer:
: `apps/pwa/app/features/groups/services/community-operator-health.ts`.

### v0.9.5 M2 Cross-Device Sync Replay Checks

Use this compact capture first during two-device DM/group/media verification:

1. Full digest (copy-ready):
: `copy(JSON.stringify(window.obscurAppEvents.getCrossDeviceSyncDigest(400), null, 2))`
2. DM continuity summary signal:
: `window.obscurAppEvents.getCrossDeviceSyncDigest(400).summary.selfAuthoredDmContinuity`
3. Membership/sendability summary signal:
: `window.obscurAppEvents.getCrossDeviceSyncDigest(400).summary.membershipSendability`
4. Media hydration parity summary signal:
: `window.obscurAppEvents.getCrossDeviceSyncDigest(400).summary.mediaHydrationParity`

When summary risk level is `watch` or `high`, inspect event slices:
: `events["account_sync.backup_payload_hydration_diagnostics"]`
: `events["account_sync.backup_restore_merge_diagnostics"]`
: `events["account_sync.backup_restore_apply_diagnostics"]`
: `events["account_sync.backup_restore_history_regression"]`
: `events["messaging.conversation_hydration_diagnostics"]`
: `events["messaging.conversation_hydration_id_split_detected"]`
: `events["groups.membership_recovery_hydrate"]`
: `events["groups.room_key_missing_send_blocked"]`

### v0.9.5 M2 Message Deletion Convergence Replay Checks

For `Delete for me` / `Delete for everyone` verification, run this deterministic replay:

1. Sender authority check:
: from sender account, verify `Delete for everyone` is present only on self-authored messages.
2. Recipient convergence check:
: sender deletes a self-authored message with `Delete for everyone`, then recipient verifies the message is removed and does not reappear after thread reopen.
3. Replay-resurrection check:
: scroll thread, trigger new incoming messages, and reopen the app/runtime; deleted messages must stay removed.
4. Diagnostics check on failure:
: export `window.obscurAppEvents.getRecent(300)` and include the surrounding `messaging.conversation_hydration_*` and `account_sync.backup_restore_*` slices with the delete-reproduction timeline.

### v0.9.5 M3 Vault Contrast and Control Visibility Replay Checks

For the light-mode polish slice, run this quick manual pass:

1. Vault gallery filters + pagination in Light mode:
: verify type-filter chips and page controls remain readable without hover.
2. Vault detail overlay controls in Light and Dark modes:
: verify close button, action bar buttons, and zoom/reset controls are visible at rest (not hover-only).
3. No behavior regression:
: verify opening media, zooming images, favoriting, and local-cache delete still work as before.
4. Chat media lightbox controls in Light and Dark modes:
: verify top-right controls and left/right navigation controls remain visible at rest and maintain clear focus/hover feedback.
5. Inline chat media players in Light and Dark modes:
: verify audio/video playback controls (play/pause, volume, fullscreen/external) stay readable at rest without requiring hover.

### Cross-Device DM Loss Triage

Capture the following in one A/B reproduction cycle:

1. Source device A before backup publish:
: verify `account_sync.backup_payload_hydration_diagnostics` includes non-zero outgoing counts for affected conversations.
2. Target device B right after restore:
: compare `incoming*` vs `merged*` counts in `account_sync.backup_restore_merge_diagnostics`.
3. Target device B after `CHAT_STATE_REPLACED_EVENT` migration:
: inspect `messaging.legacy_migration_diagnostics` for canonical collisions and incoming-only conversation counts.
4. Target device B when opening affected thread:
: watch for `messaging.conversation_hydration_id_split_detected`; if present, outgoing messages are likely split under sibling conversation IDs.
5. Export raw diagnostics in one step:
: run `window.obscurAppEvents.getRecent(300)` and copy the returned JSON array.
6. If logs are too large to copy:
: run `window.obscurAppEvents.getDigest(300)` and share only that compact object.

## Change Discipline

- v0.9.x execution constraints (pre-v1):
  - no new lifecycle or sync owners for startup, relay, or account-sync paths,
  - no parallel mutation pipelines for the same runtime state,
  - no optimistic success claims without evidence-backed outcomes,
  - no broad refactor-only landings without reliability or diagnostics value.
- Prefer subtraction over compatibility layering.
- Avoid hidden singleton assumptions for profile/account scope.
- Treat sender-local optimistic state as provisional only.
- Keep release claims tied to runtime evidence, not just passing tests.

## Resume Checklist

1. Pull latest `main` and run `pnpm install`.
2. Run `pnpm docs:check`.
3. Run `pnpm ci:scan:pwa:head` before major pushes.
4. Validate target flow in two-user reasoning terms (sender and receiver state).
5. Update `ISSUES.md` and these docs when architecture truth changes.
