# 08 Maintainer Playbook and Continuation Handoff

_Last reviewed: 2026-03-23 (baseline commit 884e632)._

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
5. Cross-device digest anti-abuse summary check:
: `window.obscurAppEvents.getCrossDeviceSyncDigest(400).summary.incomingRequestAntiAbuse`
: `window.obscurAppEvents.getCrossDeviceSyncDigest(400).events["messaging.request.incoming_quarantined"]`
: verify reason-coded counters (`peerRateLimitedCount`, `peerCooldownActiveCount`, `globalRateLimitedCount`) and latest reason transition.
6. One-copy anti-abuse checkpoint bundle:
: `copy(window.obscurM7AntiAbuseCapture?.captureJson(400))`
7. CP3 readiness verdict check:
: `JSON.parse(window.obscurM7AntiAbuseCapture?.captureJson(400) ?? "{}")?.antiAbuse?.replayReadiness`
: `readyForCp3Evidence` must be `true` with observed transition
: `incoming_connection_request_peer_rate_limited` -> `incoming_connection_request_peer_cooldown_active`.
8. Deterministic CP3 replay helper (for builds without easy manual spam generation):
: `window.obscurM7AntiAbuseReplay?.runPeerCooldownReplay({ clearAppEvents: true })`
: `copy(window.obscurM7AntiAbuseReplay?.runPeerCooldownReplayCaptureJson({ clearAppEvents: true }))`

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
5. Manual replay capture bundle after execution:
: `copy(JSON.stringify({
:   quarantined: window.obscurAppEvents.findByName("messaging.request.incoming_quarantined", 30),
:   lastIncoming: window.obscurDeliveryDiagnostics?.getSnapshot()?.lastIncoming ?? null,
:   triage: window.obscurM0Triage?.capture?.(300) ?? null
: }, null, 2))`

### Post-v1 M2 Startup/Profile-Binding Diagnostics Replay Checks

For identity/scope resilience verification during startup and account-switch paths:

1. Profile-binding refresh diagnostics:
: `window.obscurAppEvents.findByName("runtime.profile_binding_refresh_timeout", 30)`
: `window.obscurAppEvents.findByName("runtime.profile_binding_refresh_failed", 30)`
2. Auto-unlock scope drift diagnostics:
: `window.obscurAppEvents.findByName("auth.auto_unlock_scope_drift_detected", 30)`
3. Runtime activation scope mismatch diagnostics:
: `window.obscurAppEvents.findByName("runtime.activation.profile_scope_mismatch", 30)`
: verify `reasonCode` (`projection_profile_mismatch_bound_profile`, `projection_account_mismatch_identity`, `account_sync_public_key_mismatch_identity`, `runtime_session_public_key_mismatch_identity`) with profile/account suffix context.
4. Voice note capability and start-failure diagnostics:
: `window.obscurAppEvents.findByName("messaging.voice_note.recording_unsupported", 30)`
: `window.obscurAppEvents.findByName("messaging.voice_note.recording_start_failed", 30)`
: verify reason-coded unsupported/runtime capability context before treating voice-note failures as transport errors.
5. Voice note completion metadata diagnostics:
: `window.obscurAppEvents.findByName("messaging.voice_note.recording_complete", 30)`
: verify emitted `durationSeconds`, `mimeType`, and `byteLength` fields for recorded voice notes before sync/search triage.
6. Room-key portability mismatch diagnostics:
: `window.obscurAppEvents.findByName("groups.room_key_missing_send_blocked", 30)`
: verify `reasonCode` (`no_local_room_keys`, `target_room_key_missing_local_profile_scope`, `target_room_key_record_unreadable`, `room_key_store_unavailable`) and `activeProfileId`/`localRoomKeyCount` context.
7. Backup-restore profile scope mismatch diagnostics:
: `window.obscurAppEvents.findByName("account_sync.backup_restore_profile_scope_mismatch", 30)`
: verify `reasonCode` (`requested_profile_not_active`, `active_profile_changed_during_restore`, `active_profile_changed_after_apply`) with `requestedProfileId` vs `activeProfileIdBeforeApply`.
8. Runtime/profile snapshot capture when drift appears:
: `copy(JSON.stringify({
:   runtime: window.obscurWindowRuntime?.getSnapshot?.() ?? null,
:   digest: window.obscurAppEvents?.getDigest?.(300) ?? null,
:   triage: window.obscurM0Triage?.capture?.(300) ?? null
: }, null, 2))`

### Post-v1 M2 Search-Jump Navigation Replay Checks

For long-history in-chat search navigation validation:

1. Requested jump evidence:
: `window.obscurAppEvents.findByName("messaging.search_jump_requested", 30)`
2. Resolved jump evidence:
: `window.obscurAppEvents.findByName("messaging.search_jump_resolved", 30)`
: verify `resolutionMode` (`id`/`timestamp_fallback`), `loadAttemptCount`, and `renderResolveAttemptCount`.
3. Unresolved jump evidence:
: `window.obscurAppEvents.findByName("messaging.search_jump_unresolved", 30)`
: verify `reasonCode` (`target_dom_not_resolved_after_index_match`, `timestamp_fallback_dom_not_resolved`, `target_not_found_in_current_window`, `target_not_found_after_load_attempts`) before UI-level fixes.
4. Compact digest confirmation:
: `window.obscurAppEvents.getCrossDeviceSyncDigest(400).summary.searchJumpNavigation`
: `window.obscurAppEvents.getCrossDeviceSyncDigest(400).events["messaging.search_jump_requested"]`
: `window.obscurAppEvents.getCrossDeviceSyncDigest(400).events["messaging.search_jump_resolved"]`
: `window.obscurAppEvents.getCrossDeviceSyncDigest(400).events["messaging.search_jump_unresolved"]`
5. Incident export bundle when jump does not move viewport:
: `copy(JSON.stringify({
:   requested: window.obscurAppEvents.findByName("messaging.search_jump_requested", 30),
:   resolved: window.obscurAppEvents.findByName("messaging.search_jump_resolved", 30),
:   unresolved: window.obscurAppEvents.findByName("messaging.search_jump_unresolved", 30),
:   triage: window.obscurM0Triage?.capture?.(300) ?? null
: }, null, 2))`

### Post-v1 M4 Long-Session Search-Jump Soak Capture

For stabilization soak runs (`v1.0.6` CP3), use this one-copy capture first:

1. Dedicated M4 stabilization bundle:
: `copy(window.obscurM4Stabilization?.captureJson(400))`
2. Expected bundle contents:
: search-jump digest summary (`riskLevel`, requested/resolved/unresolved counts, dom-unresolved counters),
: recent search-jump request/resolution/unresolved event slices,
: route-mount + UI responsiveness snapshots.
3. Fallback when helper is unavailable:
: `copy(JSON.stringify({
:   summary: window.obscurAppEvents.getCrossDeviceSyncDigest(400).summary.searchJumpNavigation,
:   requested: window.obscurAppEvents.findByName("messaging.search_jump_requested", 30),
:   resolved: window.obscurAppEvents.findByName("messaging.search_jump_resolved", 30),
:   unresolved: window.obscurAppEvents.findByName("messaging.search_jump_unresolved", 30),
:   routeMount: window.obscurRouteMountDiagnostics?.getSnapshot?.() ?? null,
:   ui: window.obscurUiResponsiveness?.getSnapshot?.() ?? null
: }, null, 2))`

### Post-v1 M5 Community Lifecycle Convergence Replay Checks

For `v1.0.7` CP3 community-convergence verification:

1. Use the canonical matrix:
: `docs/26-v1.0.7-cp3-community-convergence-matrix.md`.
2. One-copy M8 community bundle (preferred for current `v1.0.10+` lane):
: `copy(window.obscurM8CommunityCapture?.captureJson(400))`
3. Replay readiness probe for CP2 evidence prep:
: `JSON.parse(window.obscurM8CommunityCapture?.captureJson(400) ?? "{}")?.community?.replayReadiness`
4. Deterministic CP3 replay helper (for builds without easy manual account-switch timing):
: `window.obscurM8CommunityReplay?.runConvergenceReplay({ clearAppEvents: true })`
: `copy(window.obscurM8CommunityReplay?.runConvergenceReplayCaptureJson({ clearAppEvents: true }))`
5. Preferred CP3 export helper with explicit gate verdict:
: `copy(JSON.stringify(window.obscurM8CommunityReplay?.runConvergenceReplayCapture({ clearAppEvents: true }), null, 2))`
6. Required summary probes:
: `window.obscurAppEvents.getCrossDeviceSyncDigest(400).summary.communityLifecycleConvergence`
: `window.obscurAppEvents.getCrossDeviceSyncDigest(400).summary.membershipSendability`
7. Account-switch scope convergence probe (`v1.0.11` CP2+):
: `window.obscurAppEvents.getCrossDeviceSyncDigest(400).summary.accountSwitchScopeConvergence`
8. Membership-sendability reason probes (`v1.0.11` CP2+):
: `window.obscurAppEvents.getCrossDeviceSyncDigest(400).summary.membershipSendability.joinedMembershipRoomKeyMismatchCount`
: `window.obscurAppEvents.getCrossDeviceSyncDigest(400).summary.membershipSendability.localProfileScopeRoomKeyMissingCount`
: `window.obscurAppEvents.getCrossDeviceSyncDigest(400).summary.membershipSendability.noLocalRoomKeysCount`
: `window.obscurAppEvents.getCrossDeviceSyncDigest(400).summary.membershipSendability.latestReasonCode`
9. Membership-sendability severity interpretation (`v1.0.11` CP2+):
: `high` -> joined-membership mismatch observed (`target_room_key_missing_after_membership_joined`),
: `watch` -> non-joined send-block reason observed or visible-group/chat-state-group parity lag.
10. Account-switch scope severity interpretation (`v1.0.11` CP2+):
: `high` -> runtime/restore profile-scope mismatch observed,
: `watch` -> auto-unlock scope drift observed without runtime/restore mismatch evidence.
11. Required event slices:
: `window.obscurAppEvents.getCrossDeviceSyncDigest(400).events["groups.membership_recovery_hydrate"]`
: `window.obscurAppEvents.getCrossDeviceSyncDigest(400).events["groups.membership_ledger_load"]`
: `window.obscurAppEvents.getCrossDeviceSyncDigest(400).events["groups.room_key_missing_send_blocked"]`
12. CP3 readiness probe (`v1.0.11` CP2+):
: `JSON.parse(window.obscurM8CommunityCapture?.captureJson(400) ?? "{}")?.community?.replayReadiness?.readyForCp3Evidence`
13. CP3 gate verdict probe (`v1.0.11` CP3 prep+):
: `window.obscurM8CommunityReplay?.runConvergenceReplayCapture({ clearAppEvents: true })?.cp3EvidenceGate`
14. One-copy CP3 export bundle (fallback when helper is unavailable):
: `copy(JSON.stringify((() => {`
: `  const digest = window.obscurAppEvents?.getCrossDeviceSyncDigest?.(400);`
: `  return {`
: `    communityLifecycleConvergence: digest?.summary?.communityLifecycleConvergence ?? null,`
: `    membershipSendability: digest?.summary?.membershipSendability ?? null,`
: `    accountSwitchScopeConvergence: digest?.summary?.accountSwitchScopeConvergence ?? null,`
: `    membershipRecoveryHydrate: digest?.events?.["groups.membership_recovery_hydrate"] ?? [],`
: `    membershipLedgerLoad: digest?.events?.["groups.membership_ledger_load"] ?? [],`
: `    roomKeyMissingSendBlocked: digest?.events?.["groups.room_key_missing_send_blocked"] ?? [],`
: `    recentWarnOrError: digest?.recentWarnOrError ?? [],`
: `    m0Triage: window.obscurM0Triage?.capture?.(300) ?? null,`
: `  };`
: `})(), null, 2))`
15. Escalate immediately if:
: community name regresses to placeholder/default after account switch/restart,
: creator/member coverage disappears,
: `groups.room_key_missing_send_blocked` appears during replay.

### Post-v1 M6 Realtime Voice Degraded/Unsupported Checks

For `v1.0.8` CP2 realtime voice diagnostics verification:

Canonical matrix:
: `docs/27-v1.0.8-cp3-voice-replay-matrix.md`.
: `docs/32-v1.1.3-cp3-voice-suite-matrix.md` (active CP3 suite lane).
: `docs/33-v1.1.4-cp4-voice-long-session-matrix.md` (active CP4 prep lane).

1. One-copy M6 voice bundle (preferred):
: `copy(window.obscurM6VoiceCapture?.captureJson(400))`
2. Realtime voice summary probe:
: `window.obscurAppEvents.getCrossDeviceSyncDigest(400).summary.realtimeVoiceSession`
3. Replay bridge one-copy deterministic bundle (preferred when UI replay path is unavailable):
: `copy(window.obscurM6VoiceReplay?.runWeakNetworkReplayCaptureJson?.({ clearAppEvents: true, captureWindowSize: 400 }))`
4. Account-switch replay bridge one-copy deterministic bundle:
: `copy(window.obscurM6VoiceReplay?.runAccountSwitchReplayCaptureJson?.({ clearAppEvents: true, captureWindowSize: 400 }))`
5. Combined CP3 replay-suite one-copy deterministic bundle:
: `copy(window.obscurM6VoiceReplay?.runCp3ReplaySuiteCaptureJson?.({ clearAppEvents: true, captureWindowSize: 400 }))`
6. Replay bridge state-only helper (fallback):
: `window.obscurM6VoiceReplay?.runWeakNetworkReplay?.({ clearAppEvents: true, captureWindowSize: 400 })`
7. CP2 replay gate verdict probes:
: `window.obscurM6VoiceReplay?.runWeakNetworkReplayCapture?.({ clearAppEvents: true, captureWindowSize: 400 })?.cp2EvidenceGate`
: `window.obscurM6VoiceReplay?.runAccountSwitchReplayCapture?.({ clearAppEvents: true, captureWindowSize: 400 })?.cp2EvidenceGate`
8. CP3 suite gate verdict probe:
: `window.obscurM6VoiceReplay?.runCp3ReplaySuiteCapture?.({ clearAppEvents: true, captureWindowSize: 400 })?.suiteGate`
9. CP3 suite gate one-copy probe (recommended for quick pass/fail checks):
: `window.obscurM6VoiceReplay?.runCp3ReplaySuiteGateProbe?.({ clearAppEvents: true, captureWindowSize: 400 })`
: `copy(window.obscurM6VoiceReplay?.runCp3ReplaySuiteGateProbeJson?.({ clearAppEvents: true, captureWindowSize: 400 }))`
10. Single-device CP3 self-test (recommended when only a small number of real accounts are available):
: `window.obscurM6VoiceReplay?.runCp3SingleDeviceSelfTest?.({ clearAppEvents: true, captureWindowSize: 400 })`
: `copy(window.obscurM6VoiceReplay?.runCp3SingleDeviceSelfTestJson?.({ clearAppEvents: true, captureWindowSize: 400 }))`
11. Long-session CP4-prep deterministic bundle:
: `window.obscurM6VoiceReplay?.runLongSessionReplayCapture?.({ clearAppEvents: true, captureWindowSize: 400, cycleCount: 6 })`
: `copy(window.obscurM6VoiceReplay?.runLongSessionReplayCaptureJson?.({ clearAppEvents: true, captureWindowSize: 400, cycleCount: 6 }))`
12. Long-session CP4 readiness gate probe:
: `window.obscurM6VoiceReplay?.runLongSessionReplayCapture?.({ clearAppEvents: true, captureWindowSize: 400, cycleCount: 6 })?.cp4ReadinessGate`
13. Long-session CP4 compact self-test probe:
: `window.obscurM6VoiceReplay?.runCp4LongSessionSelfTest?.({ clearAppEvents: true, captureWindowSize: 400, cycleCount: 6 })`
: `copy(window.obscurM6VoiceReplay?.runCp4LongSessionSelfTestJson?.({ clearAppEvents: true, captureWindowSize: 400, cycleCount: 6 }))`
14. Long-session CP4 gate probe (recommended quick verdict):
: `window.obscurM6VoiceReplay?.runCp4LongSessionGateProbe?.({ clearAppEvents: true, captureWindowSize: 400, cycleCount: 6 })`
: `copy(window.obscurM6VoiceReplay?.runCp4LongSessionGateProbeJson?.({ clearAppEvents: true, captureWindowSize: 400, cycleCount: 6 }))`
15. Long-session CP4 checkpoint bundle (recommended one-copy release-readiness export):
: `window.obscurM6VoiceReplay?.runCp4CheckpointCapture?.({ clearAppEvents: true, captureWindowSize: 400, cycleCount: 6 })`
: `copy(window.obscurM6VoiceReplay?.runCp4CheckpointCaptureJson?.({ clearAppEvents: true, captureWindowSize: 400, cycleCount: 6 }))`
16. Long-session CP4 checkpoint gate probe (recommended quick release verdict):
: `window.obscurM6VoiceReplay?.runCp4CheckpointGateProbe?.({ clearAppEvents: true, captureWindowSize: 400, cycleCount: 6 })`
: `copy(window.obscurM6VoiceReplay?.runCp4CheckpointGateProbeJson?.({ clearAppEvents: true, captureWindowSize: 400, cycleCount: 6 }))`
17. Long-session gate diagnostics event slice:
: `window.obscurAppEvents.getCrossDeviceSyncDigest(400).events["messaging.realtime_voice.long_session_gate"]`
18. Long-session gate summary counters:
: `window.obscurAppEvents.getCrossDeviceSyncDigest(400).summary.realtimeVoiceSession.longSessionGateCount`
: `window.obscurAppEvents.getCrossDeviceSyncDigest(400).summary.realtimeVoiceSession.longSessionGatePassCount`
: `window.obscurAppEvents.getCrossDeviceSyncDigest(400).summary.realtimeVoiceSession.longSessionGateFailCount`
: `window.obscurAppEvents.getCrossDeviceSyncDigest(400).summary.realtimeVoiceSession.unexpectedLongSessionGateFailCount`
: `window.obscurAppEvents.getCrossDeviceSyncDigest(400).summary.realtimeVoiceSession.latestLongSessionGatePass`
: `window.obscurAppEvents.getCrossDeviceSyncDigest(400).summary.realtimeVoiceSession.latestLongSessionGateFailedCheckSample`
19. CP4 checkpoint gate diagnostics event slice:
: `window.obscurAppEvents.getCrossDeviceSyncDigest(400).events["messaging.realtime_voice.cp4_checkpoint_gate"]`
20. CP4 checkpoint gate summary counters:
: `window.obscurAppEvents.getCrossDeviceSyncDigest(400).summary.realtimeVoiceSession.checkpointGateCount`
: `window.obscurAppEvents.getCrossDeviceSyncDigest(400).summary.realtimeVoiceSession.checkpointGatePassCount`
: `window.obscurAppEvents.getCrossDeviceSyncDigest(400).summary.realtimeVoiceSession.checkpointGateFailCount`
: `window.obscurAppEvents.getCrossDeviceSyncDigest(400).summary.realtimeVoiceSession.unexpectedCheckpointGateFailCount`
: `window.obscurAppEvents.getCrossDeviceSyncDigest(400).summary.realtimeVoiceSession.latestCheckpointGatePass`
: `window.obscurAppEvents.getCrossDeviceSyncDigest(400).summary.realtimeVoiceSession.latestCheckpointGateFailedCheckSample`
21. Transition event slice:
: `window.obscurAppEvents.getCrossDeviceSyncDigest(400).events["messaging.realtime_voice.session_transition"]`
22. Unified CP2 summary probes:
: `window.obscurAppEvents.getCrossDeviceSyncDigest(400).summary.asyncVoiceNote`
: `window.obscurAppEvents.getCrossDeviceSyncDigest(400).summary.deleteConvergence`
23. M6 capture unified probes:
: `JSON.parse(window.obscurM6VoiceCapture?.captureJson(400) ?? "{}")?.voice?.asyncVoiceNoteSummary`
: `JSON.parse(window.obscurM6VoiceCapture?.captureJson(400) ?? "{}")?.voice?.deleteConvergenceSummary`
: `JSON.parse(window.obscurM6VoiceCapture?.captureJson(400) ?? "{}")?.voice?.voiceNoteEvents`
: `JSON.parse(window.obscurM6VoiceCapture?.captureJson(400) ?? "{}")?.voice?.deleteConvergenceEvents`
: `JSON.parse(window.obscurM6VoiceCapture?.captureJson(400) ?? "{}")?.voice?.longSessionGateEvents`
: `JSON.parse(window.obscurM6VoiceCapture?.captureJson(400) ?? "{}")?.voice?.checkpointGateEvents`
: `JSON.parse(window.obscurM6VoiceCapture?.captureJson(400) ?? "{}")?.voice?.releaseReadinessGateEvents`
: `JSON.parse(window.obscurM6VoiceCapture?.captureJson(400) ?? "{}")?.voice?.releaseEvidenceGateEvents`
: `JSON.parse(window.obscurM6VoiceCapture?.captureJson(400) ?? "{}")?.voice?.closeoutGateEvents`
24. CP4 release-readiness one-copy bundle (recommended for operator handoff):
: `window.obscurM6VoiceReplay?.runCp4ReleaseReadinessCapture?.({ clearAppEvents: true, captureWindowSize: 400, cycleCount: 6 })`
: `copy(window.obscurM6VoiceReplay?.runCp4ReleaseReadinessCaptureJson?.({ clearAppEvents: true, captureWindowSize: 400, cycleCount: 6 }))`
25. CP4 release-readiness gate probe (recommended quick pass/fail verdict):
: `window.obscurM6VoiceReplay?.runCp4ReleaseReadinessGateProbe?.({ clearAppEvents: true, captureWindowSize: 400, cycleCount: 6 })`
: `copy(window.obscurM6VoiceReplay?.runCp4ReleaseReadinessGateProbeJson?.({ clearAppEvents: true, captureWindowSize: 400, cycleCount: 6 }))`
26. CP4 release-readiness diagnostics event slice:
: `window.obscurAppEvents.getCrossDeviceSyncDigest(400).events["messaging.realtime_voice.cp4_release_readiness_gate"]`
27. CP4 release-readiness gate summary counters:
: `window.obscurAppEvents.getCrossDeviceSyncDigest(400).summary.realtimeVoiceSession.releaseReadinessGateCount`
: `window.obscurAppEvents.getCrossDeviceSyncDigest(400).summary.realtimeVoiceSession.releaseReadinessGatePassCount`
: `window.obscurAppEvents.getCrossDeviceSyncDigest(400).summary.realtimeVoiceSession.releaseReadinessGateFailCount`
: `window.obscurAppEvents.getCrossDeviceSyncDigest(400).summary.realtimeVoiceSession.unexpectedReleaseReadinessGateFailCount`
: `window.obscurAppEvents.getCrossDeviceSyncDigest(400).summary.realtimeVoiceSession.latestReleaseReadinessGatePass`
: `window.obscurAppEvents.getCrossDeviceSyncDigest(400).summary.realtimeVoiceSession.latestReleaseReadinessGateFailedCheckSample`
28. CP4 release-evidence one-copy packet (recommended operator handoff):
: `window.obscurM6VoiceReplay?.runCp4ReleaseEvidenceCapture?.({ clearAppEvents: true, captureWindowSize: 400, cycleCount: 6, eventSliceLimit: 3 })`
: `copy(window.obscurM6VoiceReplay?.runCp4ReleaseEvidenceCaptureJson?.({ clearAppEvents: true, captureWindowSize: 400, cycleCount: 6, eventSliceLimit: 3 }))`
29. CP4 release-evidence gate probe:
: `window.obscurM6VoiceReplay?.runCp4ReleaseEvidenceGateProbe?.({ clearAppEvents: true, captureWindowSize: 400, cycleCount: 6, eventSliceLimit: 3 })`
: `copy(window.obscurM6VoiceReplay?.runCp4ReleaseEvidenceGateProbeJson?.({ clearAppEvents: true, captureWindowSize: 400, cycleCount: 6, eventSliceLimit: 3 }))`
30. CP4 release-evidence diagnostics event slice:
: `window.obscurAppEvents.getCrossDeviceSyncDigest(400).events["messaging.realtime_voice.cp4_release_evidence_gate"]`
31. CP4 release-evidence gate summary counters:
: `window.obscurAppEvents.getCrossDeviceSyncDigest(400).summary.realtimeVoiceSession.releaseEvidenceGateCount`
: `window.obscurAppEvents.getCrossDeviceSyncDigest(400).summary.realtimeVoiceSession.releaseEvidenceGatePassCount`
: `window.obscurAppEvents.getCrossDeviceSyncDigest(400).summary.realtimeVoiceSession.releaseEvidenceGateFailCount`
: `window.obscurAppEvents.getCrossDeviceSyncDigest(400).summary.realtimeVoiceSession.unexpectedReleaseEvidenceGateFailCount`
: `window.obscurAppEvents.getCrossDeviceSyncDigest(400).summary.realtimeVoiceSession.latestReleaseEvidenceGatePass`
: `window.obscurAppEvents.getCrossDeviceSyncDigest(400).summary.realtimeVoiceSession.latestReleaseEvidenceGateFailedCheckSample`
32. v1.2.0 closeout one-copy bundle:
: `window.obscurM6VoiceReplay?.runV120CloseoutCapture?.({ clearAppEvents: true, captureWindowSize: 400, cycleCount: 6, eventSliceLimit: 3 })`
: `copy(window.obscurM6VoiceReplay?.runV120CloseoutCaptureJson?.({ clearAppEvents: true, captureWindowSize: 400, cycleCount: 6, eventSliceLimit: 3 }))`
33. v1.2.0 closeout gate probe:
: `window.obscurM6VoiceReplay?.runV120CloseoutGateProbe?.({ clearAppEvents: true, captureWindowSize: 400, cycleCount: 6, eventSliceLimit: 3 })`
: `copy(window.obscurM6VoiceReplay?.runV120CloseoutGateProbeJson?.({ clearAppEvents: true, captureWindowSize: 400, cycleCount: 6, eventSliceLimit: 3 }))`
34. v1.2.0 closeout diagnostics event slice:
: `window.obscurAppEvents.getCrossDeviceSyncDigest(400).events["messaging.realtime_voice.v120_closeout_gate"]`
35. v1.2.0 closeout summary counters:
: `window.obscurAppEvents.getCrossDeviceSyncDigest(400).summary.realtimeVoiceSession.closeoutGateCount`
: `window.obscurAppEvents.getCrossDeviceSyncDigest(400).summary.realtimeVoiceSession.closeoutGatePassCount`
: `window.obscurAppEvents.getCrossDeviceSyncDigest(400).summary.realtimeVoiceSession.closeoutGateFailCount`
: `window.obscurAppEvents.getCrossDeviceSyncDigest(400).summary.realtimeVoiceSession.unexpectedCloseoutGateFailCount`
: `window.obscurAppEvents.getCrossDeviceSyncDigest(400).summary.realtimeVoiceSession.latestCloseoutGatePass`
: `window.obscurAppEvents.getCrossDeviceSyncDigest(400).summary.realtimeVoiceSession.latestCloseoutGateFailedCheckSample`
22. Delete convergence event slices:
: `window.obscurAppEvents.getCrossDeviceSyncDigest(400).events["messaging.delete_for_everyone_remote_result"]`
23. Voice-note diagnostics slices:
: `window.obscurAppEvents.getCrossDeviceSyncDigest(400).events["messaging.voice_note.recording_start_failed"]`
: `window.obscurAppEvents.getCrossDeviceSyncDigest(400).events["messaging.voice_note.recording_unsupported"]`
24. One-copy CP2 export bundle (fallback when helper is unavailable):
: `copy(JSON.stringify((() => {`
: `  const digest = window.obscurAppEvents?.getCrossDeviceSyncDigest?.(400);`
: `  return {`
: `    realtimeVoiceSession: digest?.summary?.realtimeVoiceSession ?? null,`
: `    asyncVoiceNote: digest?.summary?.asyncVoiceNote ?? null,`
: `    deleteConvergence: digest?.summary?.deleteConvergence ?? null,`
: `    transitions: digest?.events?.["messaging.realtime_voice.session_transition"] ?? [],`
: `    longSessionGate: digest?.events?.["messaging.realtime_voice.long_session_gate"] ?? [],`
: `    voiceNoteStartFailed: digest?.events?.["messaging.voice_note.recording_start_failed"] ?? [],`
: `    deleteRemoteResult: digest?.events?.["messaging.delete_for_everyone_remote_result"] ?? [],`
: `    recentWarnOrError: digest?.recentWarnOrError ?? [],`
: `    m0Triage: window.obscurM0Triage?.capture?.(300) ?? null,`
: `  };`
: `})(), null, 2))`
25. Escalate immediately if:
: `recoveryExhaustedCount > 0` appears during expected recoverable weak-network replay,
: transitions show repeated unsupported reasons on a previously supported runtime without capability changes,
: weak-network `cp2EvidenceGate.pass` is `false` with missing degraded/recovery transition checks,
: account-switch `cp2EvidenceGate.pass` is `false` with missing multi-room/end/second-active transition checks,
: long-session `cp4ReadinessGate.pass` is `false` on nominal replay (`injectRecoveryExhausted: false`),
: `deleteConvergence.remoteFailedCount > 0` or `asyncVoiceNote.recordingStartFailedCount > 0` during expected happy-path replay.

### Post-v1 M10 CP2 Trust + Responsiveness Triage Checks

For `v1.2.2` CP2 anti-abuse and responsiveness incidents, use this order first:

1. One-command M10 CP2 triage capture (preferred):
: `copy(window.obscurM10TrustControls?.runCp2TriageCaptureJson?.({ eventWindowSize: 400, expectedStable: true }))`
2. CP2 gate-only probe:
: `window.obscurM10TrustControls?.runCp2TriageCapture?.({ eventWindowSize: 400, expectedStable: true })?.cp2TriageGate`
3. CP2 stability-gate probe (emits canonical event + returns gate verdict):
: `copy(window.obscurM10TrustControls?.runCp2StabilityGateProbeJson?.({ eventWindowSize: 400, expectedStable: true }))`
: `window.obscurM10TrustControls?.runCp2StabilityGateProbe?.({ eventWindowSize: 400, expectedStable: true })?.cp2TriageGate`
4. CP3 readiness probe (emits canonical event + returns readiness verdict):
: `copy(window.obscurM10TrustControls?.runCp3ReadinessCaptureJson?.({ eventWindowSize: 400, expectedStable: true }))`
: `window.obscurM10TrustControls?.runCp3ReadinessGateProbe?.({ eventWindowSize: 400, expectedStable: true })`
5. CP3 suite probe (one-call aggregate CP3 verdict + canonical event):
: `copy(window.obscurM10TrustControls?.runCp3SuiteCaptureJson?.({ eventWindowSize: 400, expectedStable: true }))`
: `window.obscurM10TrustControls?.runCp3SuiteGateProbe?.({ eventWindowSize: 400, expectedStable: true })`
6. CP4 closeout probe (one-call aggregate closeout verdict + canonical event):
: `copy(window.obscurM10TrustControls?.runCp4CloseoutCaptureJson?.({ eventWindowSize: 400, expectedStable: true }))`
: `window.obscurM10TrustControls?.runCp4CloseoutGateProbe?.({ eventWindowSize: 400, expectedStable: true })`
7. v1.3 aggregate closeout probe (one-call release-lane closeout verdict + canonical event):
: `copy(window.obscurM10TrustControls?.runV130CloseoutCaptureJson?.({ eventWindowSize: 400, expectedStable: true }))`
: `window.obscurM10TrustControls?.runV130CloseoutGateProbe?.({ eventWindowSize: 400, expectedStable: true })`
8. v1.3 evidence probe (one-call final evidence verdict + canonical event):
: `copy(window.obscurM10TrustControls?.runV130EvidenceCaptureJson?.({ eventWindowSize: 400, expectedStable: true }))`
: `window.obscurM10TrustControls?.runV130EvidenceGateProbe?.({ eventWindowSize: 400, expectedStable: true })`
9. Digest summary probes:
: `window.obscurAppEvents.getCrossDeviceSyncDigest(400).summary.incomingRequestAntiAbuse`
: `window.obscurAppEvents.getCrossDeviceSyncDigest(400).summary.uiResponsiveness`
: `window.obscurAppEvents.getCrossDeviceSyncDigest(400).summary.m10TrustControls`
10. Event slices for freeze-route correlation:
: `window.obscurAppEvents.getCrossDeviceSyncDigest(400).events["navigation.route_stall_hard_fallback"]`
: `window.obscurAppEvents.getCrossDeviceSyncDigest(400).events["navigation.route_mount_probe_slow"]`
: `window.obscurAppEvents.getCrossDeviceSyncDigest(400).events["navigation.route_mount_performance_guard_enabled"]`
: `window.obscurAppEvents.getCrossDeviceSyncDigest(400).events["navigation.page_transition_watchdog_timeout"]`
: `window.obscurAppEvents.getCrossDeviceSyncDigest(400).events["navigation.page_transition_effects_disabled"]`
: `window.obscurAppEvents.getCrossDeviceSyncDigest(400).events["runtime.profile_boot_stall_timeout"]`
: `window.obscurAppEvents.getCrossDeviceSyncDigest(400).events["messaging.m10.cp2_stability_gate"]`
: `window.obscurAppEvents.getCrossDeviceSyncDigest(400).events["messaging.m10.cp3_readiness_gate"]`
: `window.obscurAppEvents.getCrossDeviceSyncDigest(400).events["messaging.m10.cp3_suite_gate"]`
: `window.obscurAppEvents.getCrossDeviceSyncDigest(400).events["messaging.m10.cp4_closeout_gate"]`
: `window.obscurAppEvents.getCrossDeviceSyncDigest(400).events["messaging.m10.v130_closeout_gate"]`
: `window.obscurAppEvents.getCrossDeviceSyncDigest(400).events["messaging.m10.v130_evidence_gate"]`
11. Trust-control action slice:
: `window.obscurM10TrustControls?.capture?.(400)?.recentTrustControlEvents`
12. Escalate immediately if CP2/CP3/CP4/v1.3 gates fail on:
: `incomingRequestRiskNotHigh`,
: `uiResponsivenessRiskNotHigh`,
: `routeStallHardFallbackCountZero`,
: `transitionEffectsDisabledCountZero`,
: `cp2UnexpectedFailCountZero`,
: `cp3ReadinessUnexpectedFailCountZero`,
: `cp3SuiteUnexpectedFailCountZero`,
: `cp4CloseoutUnexpectedFailCountZero`,
: `v130CloseoutUnexpectedFailCountZero`.

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
