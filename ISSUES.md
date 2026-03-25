# Issue Status Snapshot (Post-v1 Monitoring and Release Continuation)

Last updated: 2026-03-24

This file tracks runtime issue status for post-v1 release continuation and stabilization monitoring.

## Current State

- Active release blockers in this file: none.
- Previous v0.9.2 critical incidents are now marked resolved in manual verification and moved to monitoring status.
- Verification source:
  - manual two-device replay + navigation stress replay on dev server,
  - automated reliability/type/docs/release-pack gates passing in this workspace.

## Post-v1 Roadmap Status

- Canonical roadmap:
  - `docs/21-post-v1-value-roadmap.md`.
- Canonical version-bound execution cadence:
  - `docs/23-versioned-phase-plan-v1.0.4-v1.0.6.md`.
  - `docs/25-versioned-phase-plan-v1.0.7-v1.0.9.md`.
  - `docs/30-versioned-phase-plan-v1.0.10-v1.1.0.md`.
- M0 status (completed 2026-03-22):
  - post-v1 pillar scope + acceptance lock is documented,
  - maintainer runbook now includes post-v1 baseline/diagnostics checklist,
  - M0 acceptance gates passed on current `main`:
    - `pnpm version:check`,
    - `pnpm docs:check`,
    - `pnpm release:test-pack -- --skip-preflight`.
- M1 status (started 2026-03-22):
  - anti-abuse foundation work started on incoming request path,
  - unknown-sender connection-request burst guard landed with reason-coded quarantine diagnostics,
  - Requests inbox now surfaces anti-spam quarantine summary + per-peer anti-spam signal badges using canonical app-event diagnostics,
  - focused anti-abuse tests are green (`incoming-request-anti-abuse`, `incoming-dm-event-handler`),
  - community operator visibility slice landed in Group Management (members tab) with deterministic health/governance signals from typed helper logic (`community-operator-health`),
  - focused operator-health regression coverage is green (`community-operator-health.test.ts`),
  - M1 closeout automation replay is green on 2026-03-23 (`vitest` focused suites + `tsc --noEmit` + `docs:check`),
  - remaining gate: manual two-device replay evidence for anti-abuse quarantine and community operator visibility before marking M1 complete.
- M2 status (started 2026-03-23):
  - startup/profile-binding diagnostics hardening landed with reason-coded events:
    - `runtime.profile_binding_refresh_timeout`,
    - `runtime.profile_binding_refresh_failed`,
  - startup auto-unlock now emits explicit scope drift diagnostics:
    - `auth.auto_unlock_scope_drift_detected` when fallback credentials imply cross-profile scope mismatch,
  - group sendability diagnostics now include room-key portability mismatch reason codes on canonical send-block path:
    - `groups.room_key_missing_send_blocked` includes `reasonCode`, `localRoomKeyCount`, `hasTargetGroupRecord`, `activeProfileId`, and group-key hint sample,
  - backup-restore now emits explicit profile-scope mismatch diagnostics on canonical restore apply:
    - `account_sync.backup_restore_profile_scope_mismatch` with reason codes for explicit profile mismatch and restore-time scope drift,
  - runtime activation now emits explicit profile/account scope mismatch diagnostics on the canonical activation owner:
    - `runtime.activation.profile_scope_mismatch` with reason-coded profile/account divergence context across bound session, projection scope, and account-sync scope,
  - async voice-note Stage A capability hardening started:
    - `VoiceRecorder` now emits explicit unsupported/start-failure diagnostics (`messaging.voice_note.recording_unsupported`, `messaging.voice_note.recording_start_failed`) and blocks unsupported runtimes before capture attempts,
    - recorded voice-note files are now routed into the canonical composer attachment/send flow from `main-shell`,
  - voice-note Stage A metadata/search-readiness slice landed:
    - typed voice-note metadata parsing + search tokens now live in canonical messaging services (`voice-note-metadata`, `message-search-index`),
    - chat-history search now matches attachment metadata (including voice-note duration/name tokens) instead of content-only text,
    - recorder output now uses duration-aware filenames (`voice-note-<timestamp>-d<seconds>.<ext>`) and emits `messaging.voice_note.recording_complete` diagnostics,
    - message timeline audio cards now surface voice-note-aware labels and parsed duration chips in-bubble when voice-note filename metadata is present,
    - voice-note playback now surfaces a recorded-at context row in `AudioPlayer` (timeline + lightbox paths) when parsed metadata is available,
    - chat-history search now includes quick in-panel filtering (`All` / `Voice Notes`) with voice-note count badges and voice-note-only empty-state handling,
    - media gallery now supports type-aware quick filters (`All` / `Images` / `Videos` / `Voice Notes`) with count badges and voice-note duration labels on audio tiles,
    - shared attachment inference now keeps voice-note-prefixed `.webm` files classified as dedicated `voice_note` attachments to prevent voice-note/video misrouting in UI surfaces,
    - canonical incoming/outgoing local media cache paths now treat voice notes as temporary audio and skip Vault persistence for `voice_note` attachments,
  - focused M2-A/B suites are green (`desktop-profile-bootstrap`, `auth-gateway`, `group-service`, `encrypted-account-backup-service`, `runtime-activation-manager`, `voice-note-recording-capability`, `log-app-event`, `m0-triage-capture`, plus `tsc --noEmit`).
  - `v1.0.3` shipped on 2026-03-23 from `main` with:
    - voice-note Stage A UX split (`VoiceNoteCard` for temporary async voice vs generic uploaded audio cards),
    - light/dark contrast hardening for gradient surfaces and invite/message cards,
    - sidebar action-role clarification (`+` create; header `...` global section controls),
    - in-chat search jump hardening for virtualized + paged message histories.
  - next active M2 closeout focus after `v1.0.3`:
    - complete manual two-device evidence bundle for M2 acceptance,
    - continue runtime watch for long-history search-jump navigation behavior and collect diagnostics on any miss.
  - `v1.0.4` M2 checkpoint (`CP1`) progress:
    - search-jump flow now includes deterministic request/resolution diagnostics (`messaging.search_jump_requested`, `messaging.search_jump_resolved`, `messaging.search_jump_unresolved`),
    - search results now pass timestamp context to timeline jump so navigation can fall back to timestamp-based positioning when direct id match is unavailable,
    - cross-device digest and M0 triage focus categories now include search-jump events for reproducible manual verification.
  - release cadence lock:
    - `v1.0.4` is now the M2 closeout version (checkpointed `CP1-CP4`),
    - `v1.0.5` is now the M3 delivery version,
    - `v1.0.6` is now the M4 stabilization version.
- M3 status (started 2026-03-23):
  - `v1.0.5` CP1 foundation slice started with deterministic real-time voice capability contracts in
    `app/features/messaging/services/realtime-voice-capability.ts`,
  - capability classification now exposes secure-context/media-devices/WebRTC addTrack readiness and Opus capability status for future beta gating,
  - focused CP1 tests are green:
    - `app/features/messaging/services/realtime-voice-capability.test.ts`,
    - `pnpm --dir apps/pwa exec tsc --noEmit --pretty false`.
- M4 status (completed 2026-03-23):
  - `v1.0.6` CP1 stabilization slice started on long-history in-chat search navigation,
  - canonical jump owner (`message-list`) now requires dom target materialization before marking timestamp fallback jumps as resolved,
  - unresolved timestamp fallback now emits explicit reason code:
    - `messaging.search_jump_unresolved` with `reasonCode: "timestamp_fallback_dom_not_resolved"`,
  - typed search-jump step/dom-resolution helper contracts landed:
    - `app/features/messaging/components/message-search-jump.ts`,
  - `v1.0.6` CP2 diagnostics slice started:
    - cross-device digest summary now includes `summary.searchJumpNavigation` for search-jump risk-level/counter triage in `app/shared/log-app-event.ts`,
    - search-jump replay checklist now includes summary probe in `docs/08-maintainer-playbook.md`,
  - `v1.0.6` CP3 soak-evidence prep landed:
    - new one-copy stabilization capture helper:
      - `window.obscurM4Stabilization?.captureJson(400)`,
    - helper is installed at boot in `app/components/providers.tsx` and captures:
      - search-jump summary risk/counters,
      - recent search-jump requested/resolved/unresolved event slices,
      - route-mount and UI responsiveness snapshots for long-session replay triage,
    - CP3 manual replay checklist/matrix is documented in:
      - `docs/24-v1.0.6-cp3-soak-matrix.md`,
  - focused CP1 suites are green:
    - `app/features/messaging/components/message-search-jump.test.ts`,
    - `app/features/messaging/components/chat-view.test.tsx`,
    - `app/shared/log-app-event.test.ts`,
    - `app/shared/m0-triage-capture.test.ts`,
    - `pnpm --dir apps/pwa exec tsc --noEmit --pretty false`.
  - CP4 release gates and tag flow completed:
    - `pnpm version:check`,
    - `pnpm docs:check`,
    - `pnpm release:integrity-check`,
    - `pnpm release:artifact-version-contract-check`,
    - `pnpm release:ci-signal-check`,
    - `pnpm release:test-pack -- --skip-preflight`,
    - `pnpm release:preflight -- --tag v1.0.6`,
    - `v1.0.6` pushed and released.
- M5 status (started 2026-03-23):
  - `v1.0.7` planning kickoff is docs-first and owner-safe (no runtime path changes yet),
  - next sequence is locked to one milestone per version in:
    - `docs/25-versioned-phase-plan-v1.0.7-v1.0.9.md`,
  - CP1 convergence hardening landed on canonical community recovery owner:
    - duplicate persisted group rows now merge instead of letting newer placeholder regressions overwrite richer metadata/member coverage,
    - joined-ledger merge now backfills active-account member coverage and prevents placeholder `Private Group` name drift when richer ledger metadata exists,
    - recovery diagnostics now expose:
      - `persistedDuplicateMergeCount`,
      - `placeholderDisplayNameRecoveredCount`,
      - `localMemberBackfillCount`,
  - focused CP1 tests are green:
    - `pnpm --dir apps/pwa exec vitest run app/features/groups/services/community-membership-recovery.test.ts app/features/groups/providers/group-provider.test.tsx app/features/groups/providers/group-provider.cross-device-membership.integration.test.tsx`,
    - `pnpm --dir apps/pwa exec tsc --noEmit --pretty false`,
  - CP2 diagnostics slice landed:
    - cross-device digest now includes `summary.communityLifecycleConvergence` with convergence-repair counters and risk level,
    - M0 sync-restore focus now includes `groups.membership_recovery_hydrate` and `groups.membership_ledger_load` for first-response incident bundles,
  - focused CP2 tests are green:
    - `pnpm --dir apps/pwa exec vitest run app/shared/log-app-event.test.ts app/shared/m0-triage-capture.test.ts`,
    - `pnpm --dir apps/pwa exec tsc --noEmit --pretty false`,
  - CP3 manual replay matrix is defined:
    - `docs/26-v1.0.7-cp3-community-convergence-matrix.md`,
  - CP3 status:
    - operator two-device/account-switch replay evidence captured and accepted against matrix criteria,
  - CP4 release-gate replay is green in this checkpoint workspace (2026-03-23):
    - `pnpm --dir apps/pwa exec vitest run app/features/groups/services/community-membership-recovery.test.ts app/features/groups/providers/group-provider.test.tsx app/features/groups/providers/group-provider.cross-device-membership.integration.test.tsx app/shared/log-app-event.test.ts app/shared/m0-triage-capture.test.ts`,
    - `pnpm --dir apps/pwa exec tsc --noEmit --pretty false`,
    - `pnpm version:check`,
    - `pnpm docs:check`,
    - `pnpm release:integrity-check`,
    - `pnpm release:artifact-version-contract-check`,
    - `pnpm release:ci-signal-check`,
    - `pnpm release:test-pack -- --skip-preflight`,
    - `pnpm release:preflight -- --tag v1.0.7 --allow-dirty true`,
  - remaining before tag cut:
    - completed: strict clean-tree `pnpm release:preflight -- --tag v1.0.7` passed before push/tag,
    - completed: `main` and `v1.0.7` are published on origin.
- M6 status (started 2026-03-23):
  - `v1.0.8` CP1 lifecycle-contract slice landed on canonical voice-session owner:
    - `app/features/messaging/services/realtime-voice-session-lifecycle.ts`,
  - bounded typed lifecycle now covers:
    - `create/join -> connecting`,
    - `connected -> active` only with peer-session evidence,
    - degraded transport + bounded recovery attempts,
    - deterministic leave/session-closed terminal transitions,
  - reason-coded unsupported/degraded outcomes are explicit and replay-safe:
    - capability unsupported propagation,
    - `opus_codec_missing`,
    - `network_degraded`,
    - `transport_timeout`,
    - `peer_evidence_missing`,
    - `recovery_exhausted`,
  - focused CP1 tests are green:
    - `pnpm --dir apps/pwa exec vitest run app/features/messaging/services/realtime-voice-session-lifecycle.test.ts`,
    - `pnpm --dir apps/pwa exec tsc --noEmit --pretty false`.
  - CP2 diagnostics slice landed for realtime voice unsupported/degraded triage:
    - canonical transition diagnostics helper emits `messaging.realtime_voice.session_transition` with reason-coded phase context from
      `app/features/messaging/services/realtime-voice-session-diagnostics.ts`,
    - cross-device digest now exposes `summary.realtimeVoiceSession` risk/counter signals in
      `app/shared/log-app-event.ts`,
    - M0 triage focus now includes realtime voice transition events in
      `app/shared/m0-triage-capture.ts`,
  - focused CP2 tests are green:
    - `pnpm --dir apps/pwa exec vitest run app/features/messaging/services/realtime-voice-session-lifecycle.test.ts app/features/messaging/services/realtime-voice-session-diagnostics.test.ts app/shared/log-app-event.test.ts app/shared/m0-triage-capture.test.ts`,
    - `pnpm --dir apps/pwa exec tsc --noEmit --pretty false`.
  - CP3 weak-network replay prep helper landed:
    - `window.obscurM6VoiceCapture?.captureJson(400)` in
      `app/shared/m6-voice-capture.ts`,
    - helper is installed at boot in
      `app/components/providers.tsx`,
  - focused CP3 helper tests are green:
    - `pnpm --dir apps/pwa exec vitest run app/shared/m6-voice-capture.test.ts`,
    - `pnpm --dir apps/pwa exec tsc --noEmit --pretty false`.
  - CP3 manual replay matrix is defined:
    - `docs/27-v1.0.8-cp3-voice-replay-matrix.md`,
  - CP3 replay bridge is now available for deterministic transition evidence:
    - `window.obscurM6VoiceReplay?.runWeakNetworkReplay?.()` from
      `app/shared/m6-voice-replay-bridge.ts`,
  - CP3 status:
    - operator weak-network replay evidence captured and accepted (2026-03-23):
      - transition chain observed:
        `idle -> connecting -> active -> degraded -> connecting -> active`,
      - no `recovery_exhausted`/unsupported terminal failure observed in replay window.
  - CP4 status:
    - strict clean-tree release preflight passed:
      - `pnpm release:preflight -- --tag v1.0.8`,
    - `main` and tag `v1.0.8` are published on origin.
- M7 status (started 2026-03-23):
  - `v1.0.9` CP1 anti-abuse hardening started on canonical incoming-request owner:
    - `app/features/messaging/services/incoming-request-anti-abuse.ts`,
  - incoming unknown-sender burst control now applies deterministic per-peer cooldown after rate-limit quarantine:
    - new reason code `peer_cooldown_active`,
  - cooldown diagnostics are surfaced in canonical quarantine event context:
    - `app/features/messaging/controllers/incoming-dm-event-handler.ts`,
  - quarantine summary + Requests inbox UI now include cooldown reason counters/labels:
    - `app/features/messaging/services/incoming-request-quarantine-summary.ts`,
    - `app/features/messaging/components/requests-inbox-panel.tsx`,
  - focused CP1 automation replay is green:
    - `pnpm --dir apps/pwa exec vitest run app/features/messaging/services/incoming-request-anti-abuse.test.ts app/features/messaging/services/incoming-request-quarantine-summary.test.ts`,
    - `pnpm --dir apps/pwa exec tsc --noEmit --pretty false`,
  - CP2 diagnostics slice landed:
    - cross-device digest now includes `summary.incomingRequestAntiAbuse` + compact `messaging.request.incoming_quarantined` event slices in
      `app/shared/log-app-event.ts`,
    - M0 sync/restore focus now includes `messaging.request.incoming_quarantined` in
      `app/shared/m0-triage-capture.ts`,
    - maintainer anti-abuse replay checks now include digest summary probes in
      `docs/08-maintainer-playbook.md`,
  - CP3 prep helper landed:
    - one-copy anti-abuse evidence export is available via
      `window.obscurM7AntiAbuseCapture?.captureJson(400)` from
      `app/shared/m7-anti-abuse-capture.ts`,
    - helper is installed at boot in
      `app/components/providers.tsx`,
    - helper now emits deterministic CP3 gate readiness in
      `antiAbuse.replayReadiness.readyForCp3Evidence` plus observed reason-code timeline,
  - DM delete-for-everyone convergence hardening landed for voice-note/attachment-heavy rows:
    - delete target derivation now computes NIP-17 rumor ids even when `dmFormat` is missing on hydrated messages,
    - attachment-only rows now use attachment-markdown + created-at fallback candidates to improve cross-device recipient delete matching,
    - implementation in `app/features/main-shell/hooks/use-chat-actions.ts`,
    - manual two-device verification confirmed voice-note end-to-end delete convergence (sender + recipient disappearance),
  - focused CP2 automation replay is green:
    - `pnpm --dir apps/pwa exec vitest run app/shared/log-app-event.test.ts app/shared/m0-triage-capture.test.ts`,
    - `pnpm --dir apps/pwa exec vitest run app/shared/m7-anti-abuse-capture.test.ts`,
    - `pnpm --dir apps/pwa exec vitest run app/features/main-shell/hooks/use-chat-actions.delete-targets.test.ts app/features/messaging/controllers/incoming-dm-event-handler.test.ts`,
    - `pnpm --dir apps/pwa exec tsc --noEmit --pretty false`,
  - CP4 preflight gate replay is green on clean `main` for `v1.0.9`:
    - `pnpm release:preflight -- --tag v1.0.9`,
  - deterministic CP3 replay bridge landed to reduce manual timing fragility:
    - `window.obscurM7AntiAbuseReplay?.runPeerCooldownReplay({ clearAppEvents: true })`,
    - one-copy replay + diagnostics bundle export:
      `copy(window.obscurM7AntiAbuseReplay?.runPeerCooldownReplayCaptureJson({ clearAppEvents: true }))`,
    - implementation in `app/shared/m7-anti-abuse-replay-bridge.ts`,
    - replay matrix in `docs/28-v1.0.9-cp3-anti-abuse-replay-matrix.md`,
  - DM sidebar restore regression after `Delete Chat` is fixed:
    - selecting a DM now auto-removes that conversation from hidden-chat state, so reopen flows from profile/deep-link paths restore sidebar visibility,
    - implementation in `app/features/messaging/providers/messaging-provider.tsx`,
    - focused helper/test coverage in `app/features/messaging/utils/conversation-visibility.ts` and `.test.ts`,
  - voice-note card display cleanup landed:
    - voice-note cards show `Voice Notes` instead of raw generated filenames in
      `app/features/messaging/components/voice-note-card.tsx`,
    - focused coverage updated in `app/features/messaging/components/voice-note-card.test.tsx`,
  - remaining before CP1+CP2 closeout:
    - capture and attach anti-abuse replay evidence bundle (`peer_rate_limited -> peer_cooldown_active -> digest summary`).
- M8 status (started 2026-03-23):
  - `v1.0.10` lane is started with docs-first checkpoint lock for community-platform completion + lifecycle resilience:
    - `docs/30-versioned-phase-plan-v1.0.10-v1.1.0.md`,
  - CP1 implementation scope is locked to canonical group lifecycle owners (no owner expansion):
    - `app/features/groups/services/community-membership-recovery.ts`,
    - `app/features/groups/services/group-service.ts`,
    - `app/features/groups/providers/group-provider.tsx`,
  - CP1 convergence hardening landed on canonical group provider owner:
    - group add/dedupe paths now deterministically merge duplicate community rows instead of first-write-wins,
    - existing-group `addGroup` now reconciles richer metadata/member/admin coverage and persists converged rows,
    - implementation in `app/features/groups/providers/group-provider.tsx`,
  - CP1 room-key sendability diagnostics hardening landed on canonical group send owner:
    - missing room-key send blocks now emit joined-membership mismatch reason code:
      `target_room_key_missing_after_membership_joined`,
    - implementation in `app/features/groups/services/group-service.ts`,
  - CP1 profile-scope convergence hardening landed for group hydration/store ownership:
    - chat-state store cache/pending entries are now scoped by `profileId + publicKeyHex` to prevent cross-scope cache bleed during profile rebinding windows,
    - implementation in `app/features/messaging/services/chat-state-store.ts`,
    - group hydration continues to use canonical chat-state owner with scope-safe reads in
      `app/features/groups/providers/group-provider.tsx`,
  - profile-scope isolation regression is now enforced as a normal passing test:
    - `app/features/groups/providers/group-provider.cross-device-membership.integration.test.tsx`
      (`keeps group visibility isolated by profile scope before profile rebind`),
  - chat-state owner coverage now includes profile-scoped cache/pending isolation validation:
    - `app/features/messaging/services/chat-state-store.replace-event.test.ts`
      (`keeps chat-state cache and pending writes isolated per profile scope for the same public key`),
  - CP2-prep helper landed for one-copy community lifecycle evidence bundles:
    - `window.obscurM8CommunityCapture?.captureJson(400)` in
      `app/shared/m8-community-capture.ts`,
    - helper is installed at boot in
      `app/components/providers.tsx`,
    - replay readiness probe:
      `JSON.parse(window.obscurM8CommunityCapture?.captureJson(400) ?? "{}")?.community?.replayReadiness`,
    - maintainer runbook updated in `docs/08-maintainer-playbook.md`,
  - focused CP1 automation replay is green:
    - `pnpm --dir apps/pwa exec vitest run app/features/messaging/services/chat-state-store.replace-event.test.ts app/features/groups/services/community-membership-recovery.test.ts app/features/groups/services/group-service.test.ts app/features/groups/providers/group-provider.test.tsx app/features/groups/providers/group-provider.cross-device-membership.integration.test.tsx`,
    - `pnpm --dir apps/pwa exec tsc --noEmit --pretty false`,
  - focused CP1/CP2-prep automation replay is green:
    - `pnpm --dir apps/pwa exec vitest run app/shared/m8-community-capture.test.ts app/features/messaging/services/chat-state-store.replace-event.test.ts app/features/groups/services/community-membership-recovery.test.ts app/features/groups/services/group-service.test.ts app/features/groups/providers/group-provider.test.tsx app/features/groups/providers/group-provider.cross-device-membership.integration.test.tsx`,
    - `pnpm --dir apps/pwa exec tsc --noEmit --pretty false`,
    - `pnpm docs:check`,
  - deterministic CP2 replay bridge is now available for convergence-evidence generation:
    - `window.obscurM8CommunityReplay?.runConvergenceReplay({ clearAppEvents: true })`,
    - preferred one-copy CP3 export (with explicit gate verdict):
      `copy(JSON.stringify(window.obscurM8CommunityReplay?.runConvergenceReplayCapture({ clearAppEvents: true }), null, 2))`,
    - one-copy replay + capture export:
      `copy(window.obscurM8CommunityReplay?.runConvergenceReplayCaptureJson({ clearAppEvents: true }))`,
    - implementation in `app/shared/m8-community-replay-bridge.ts`,
    - helper is installed at boot in `app/components/providers.tsx`,
  - focused CP2 replay-bridge automation replay is green:
    - `pnpm --dir apps/pwa exec vitest run app/shared/m8-community-replay-bridge.test.ts app/shared/m8-community-capture.test.ts app/features/messaging/services/chat-state-store.replace-event.test.ts app/features/groups/services/community-membership-recovery.test.ts app/features/groups/services/group-service.test.ts app/features/groups/providers/group-provider.test.tsx app/features/groups/providers/group-provider.cross-device-membership.integration.test.tsx`,
    - `pnpm --dir apps/pwa exec tsc --noEmit --pretty false`,
    - `pnpm docs:check`,
  - CP3 deterministic matrix is now documented for the `v1.0.10` lane:
    - `docs/31-v1.0.10-cp3-community-replay-matrix.md`,
  - deterministic replay execution evidence captured in operator run (2026-03-23):
    - observed chain:
      `groups.membership_ledger_load -> groups.membership_recovery_hydrate -> messaging.chat_state_groups_update -> groups.room_key_missing_send_blocked`,
    - expected sendability mismatch reason code observed:
      `target_room_key_missing_after_membership_joined`,
    - one-copy bundle export command executed:
      `copy(window.obscurM8CommunityReplay?.runConvergenceReplayCaptureJson({ clearAppEvents: true }))`,
  - release-gate preflight replay for `v1.0.10` is green in current checkpoint workspace:
    - `pnpm version:check`,
    - `pnpm docs:check`,
    - `pnpm release:preflight -- --tag v1.0.10 --allow-dirty true`,
  - CP1 acceptance gates for `v1.0.10` are defined and must pass before release handoff:
    - focused `vitest` suites for touched owners,
    - `pnpm --dir apps/pwa exec tsc --noEmit --pretty false`,
    - `pnpm docs:check`,
  - CP2 and CP3/CP4 closeout sequencing is locked:
    - `v1.0.11` carries diagnostics/replay-helper expansion,
    - `v1.1.0` carries matrix evidence attachment + strict release closeout.
  - `v1.0.11` CP2 diagnostics checkpoint landed on canonical digest/capture owners:
    - `summary.membershipSendability` now includes reason-partitioned room-key send-block counters in
      `app/shared/log-app-event.ts`:
      - `joinedMembershipRoomKeyMismatchCount`,
      - `localProfileScopeRoomKeyMissingCount`,
      - `noLocalRoomKeysCount`,
      - `latestReasonCode`,
    - membership-sendability risk level is now severity-aware:
      - `high` only for `target_room_key_missing_after_membership_joined`,
      - `watch` for non-joined send blocks and group-visibility/chat-state parity lag,
    - M8 capture parser contract is synced in
      `app/shared/m8-community-capture.ts`,
    - focused CP2 automation replay is green:
      - `pnpm --dir apps/pwa exec vitest run app/shared/log-app-event.test.ts app/shared/m8-community-capture.test.ts app/shared/m8-community-replay-bridge.test.ts`,
      - `pnpm --dir apps/pwa exec tsc --noEmit --pretty false`.
    - maintainer replay docs now include CP2 reason-partitioned sendability interpretation:
      - `docs/08-maintainer-playbook.md`,
      - `docs/31-v1.0.10-cp3-community-replay-matrix.md`.
    - account-switch scope convergence diagnostics are now included in digest and capture contracts:
      - `summary.accountSwitchScopeConvergence` in `app/shared/log-app-event.ts`,
      - reason-coded counters:
        - `backupRestoreProfileScopeMismatchCount`,
        - `runtimeActivationProfileScopeMismatchCount`,
        - `autoUnlockScopeDriftDetectedCount`,
      - severity policy:
        - `high` for runtime/restore profile-scope mismatch,
        - `watch` for auto-unlock scope drift without runtime/restore mismatch evidence,
      - M8 capture readiness now surfaces CP3 gate signal:
        - `community.replayReadiness.readyForCp3Evidence` in `app/shared/m8-community-capture.ts`.
  - `v1.0.11` CP2 closeout status:
    - code/tests/docs slice is complete and published on `main`,
    - deterministic CP3 evidence export now includes `cp3EvidenceGate.pass` + `cp3EvidenceGate.failedChecks` for operator-side one-copy verification,
  - `v1.1.0` CP3 status:
    - manual deterministic replay evidence capture is accepted via
      `window.obscurM8CommunityReplay?.runConvergenceReplayCapture({ clearAppEvents: true })`,
    - operator capture shows:
      - `cp3EvidenceGate.pass: true`,
      - `cp3EvidenceGate.failedChecks: []`,
    - observed replay chain remains expected:
      `groups.membership_ledger_load -> groups.membership_recovery_hydrate -> messaging.chat_state_groups_update -> groups.room_key_missing_send_blocked`.
  - `v1.1.0` remaining closeout work:
    - CP4 strict release-gate replay (`version:check`, `docs:check`, focused tests, `tsc`, `release:test-pack`, `release:preflight -- --tag v1.1.0`).
  - `v1.1.0` CP4 release closeout status:
    - strict release gates passed and `v1.1.0` is published.
- M9 status (started 2026-03-23):
  - `v1.1.1` CP1 release status:
    - `main` and tag `v1.1.1` are published with strict release preflight green.
  - `v1.1.1` CP1 lifecycle hardening started on canonical voice-session owner:
    - added deterministic remote-close transition in
      `app/features/messaging/services/realtime-voice-session-lifecycle.ts`:
      `markRealtimeVoiceSessionClosed(state, { nowUnixMs })`,
    - closure now converges to `phase: "ended"` with reason `session_closed` from
      `connecting|active|degraded|leaving`,
    - this prevents stuck interactive voice states when peer/session close is observed before local leave completion.
  - `v1.1.1` CP1 active-session evidence hardening landed on the same canonical lifecycle owner:
    - `markRealtimeVoiceSessionConnected(...)` now accepts `active`-phase updates so peer evidence refresh does not trigger `invalid_transition`,
    - active sessions now deterministically degrade to `phase: "degraded"` with reason `peer_evidence_missing` when peer evidence disappears during update,
    - focused regression coverage added in
      `app/features/messaging/services/realtime-voice-session-lifecycle.test.ts`.
  - `v1.1.1` CP1 terminal-race hardening landed on canonical lifecycle owner:
    - `markRealtimeVoiceSessionClosed(...)` and `markRealtimeVoiceSessionLeft(...)` now keep `ended` terminal states idempotent,
    - delayed local/remote callback ordering no longer rewrites terminal reason to `invalid_transition`,
    - race-order regression coverage added in
      `app/features/messaging/services/realtime-voice-session-lifecycle.test.ts`.
  - `v1.1.1` CP1 canonical session-owner slice landed for realtime voice:
    - new typed owner contract in
      `app/features/messaging/services/realtime-voice-session-owner.ts`,
    - owner centralizes lifecycle transitions + diagnostics emission under one path and rejects stale events (`eventUnixMs < lastTransitionAtUnixMs`) to prevent out-of-order state rollback,
    - deterministic replay bridge is now wired through canonical owner APIs in
      `app/shared/m6-voice-replay-bridge.ts`.
  - `v1.1.1` CP1 stale-event observability is now explicit:
    - ignored stale owner events emit
      `messaging.realtime_voice.session_event_ignored`
      with reason/timestamp/phase context from
      `app/features/messaging/services/realtime-voice-session-owner.ts`,
    - cross-device digest compact capture now includes this event in
      `app/shared/log-app-event.ts`.
  - focused owner/replay regression coverage is green:
    - `pnpm --dir apps/pwa exec vitest run app/features/messaging/services/realtime-voice-session-owner.test.ts app/shared/m6-voice-replay-bridge.test.ts`.
  - focused stale-event diagnostics coverage is green:
    - `pnpm --dir apps/pwa exec vitest run app/features/messaging/services/realtime-voice-session-owner.test.ts app/shared/log-app-event.test.ts`.
  - focused CP1 lifecycle/diagnostics validation is green:
    - `pnpm --dir apps/pwa exec vitest run app/features/messaging/services/realtime-voice-session-lifecycle.test.ts app/features/messaging/services/realtime-voice-session-diagnostics.test.ts`,
    - `pnpm --dir apps/pwa exec tsc --noEmit --pretty false`.
  - `v1.1.2` CP2 diagnostics slice started:
    - cross-device digest `summary.realtimeVoiceSession` now includes stale-ignore counters:
      - `staleEventIgnoredCount`,
      - `latestIgnoredReasonCode`,
      in `app/shared/log-app-event.ts`,
    - M6 one-copy voice capture now includes ignored-event replay evidence:
      - `voice.ignoredEvents` and expanded summary fields in
        `app/shared/m6-voice-capture.ts`,
    - M0 focused triage voice category now includes
      `messaging.realtime_voice.session_event_ignored` in
      `app/shared/m0-triage-capture.ts`.
  - `v1.1.2` CP2 replay-helper slice landed:
    - deterministic one-copy weak-network replay export is now available in
      `app/shared/m6-voice-replay-bridge.ts`:
      - `window.obscurM6VoiceReplay.runWeakNetworkReplayCapture(...)`,
      - `window.obscurM6VoiceReplay.runWeakNetworkReplayCaptureJson(...)`,
    - replay output now includes typed CP2 gate verdict fields:
      - `cp2EvidenceGate.pass`,
      - `cp2EvidenceGate.failedChecks`,
      - readiness probes aligned to degraded/recovery transition evidence.
  - `v1.1.2` CP2 account-switch replay-helper slice landed:
    - deterministic one-copy account-switch replay export is now available in
      `app/shared/m6-voice-replay-bridge.ts`:
      - `window.obscurM6VoiceReplay.runAccountSwitchReplayCapture(...)`,
      - `window.obscurM6VoiceReplay.runAccountSwitchReplayCaptureJson(...)`,
    - replay output now includes scenario-aware transition evidence:
      - `scenario: "account_switch"`,
      - `roomHintCount`,
      - `endedTransitionCount`,
      - `cp2EvidenceGate.pass/failedChecks`.
  - `v1.1.2` CP2 unified async-voice/delete diagnostics slice landed:
    - cross-device digest now includes:
      - `summary.asyncVoiceNote`,
      - `summary.deleteConvergence`,
      in `app/shared/log-app-event.ts`,
    - delete-for-everyone canonical path now emits reason-coded convergence diagnostics in
      `app/features/main-shell/hooks/use-chat-actions.ts`:
      - `messaging.delete_for_everyone_requested`,
      - `messaging.delete_for_everyone_rejected`,
      - `messaging.delete_for_everyone_local_applied`,
      - `messaging.delete_for_everyone_remote_result`,
    - M6 capture now exports unified one-copy voice-note/delete evidence in
      `app/shared/m6-voice-capture.ts`:
      - `voice.asyncVoiceNoteSummary`,
      - `voice.deleteConvergenceSummary`,
      - `voice.voiceNoteEvents`,
      - `voice.deleteConvergenceEvents`,
    - M0 focused voice triage now includes voice-note and delete-convergence probes in
      `app/shared/m0-triage-capture.ts`.
  - focused CP2 diagnostics/capture validation is green:
    - `pnpm --dir apps/pwa exec vitest run app/shared/log-app-event.test.ts app/shared/m6-voice-capture.test.ts app/shared/m0-triage-capture.test.ts`,
    - `pnpm --dir apps/pwa exec vitest run app/shared/m6-voice-replay-bridge.test.ts app/shared/m6-voice-capture.test.ts app/shared/log-app-event.test.ts app/shared/m0-triage-capture.test.ts`,
    - `pnpm --dir apps/pwa exec vitest run app/shared/log-app-event.test.ts app/shared/m6-voice-capture.test.ts app/shared/m0-triage-capture.test.ts app/shared/m6-voice-replay-bridge.test.ts app/features/main-shell/hooks/use-chat-actions.delete-targets.test.ts`,
    - `pnpm --dir apps/pwa exec tsc --noEmit --pretty false`.
  - `v1.1.2` release status:
    - `main` pushed and tag `v1.1.2` published.
  - post-`v1.1.2` continuation slice started (CP3 replay-suite prep):
    - deterministic one-copy suite helper is available in
      `app/shared/m6-voice-replay-bridge.ts`:
      - `window.obscurM6VoiceReplay.runCp3ReplaySuiteCapture(...)`,
      - `window.obscurM6VoiceReplay.runCp3ReplaySuiteCaptureJson(...)`,
      - `window.obscurM6VoiceReplay.runCp3ReplaySuiteGateProbe(...)`,
      - `window.obscurM6VoiceReplay.runCp3ReplaySuiteGateProbeJson(...)`,
    - suite output includes:
      - `weakNetwork` replay+capture+gate bundle,
      - `accountSwitch` replay+capture+gate bundle,
      - overall `suiteGate.pass/failedChecks`.
  - `v1.1.3` CP3 start status:
    - dedicated CP3 replay-suite matrix is now active:
      - `docs/32-v1.1.3-cp3-voice-suite-matrix.md`,
    - active major-phase plan and maintainer runbook are synced to this CP3 lane.
  - `v1.1.3` CP3 suite-gate hardening landed:
    - `app/shared/m6-voice-replay-bridge.ts` suite gate now validates unified CP2 diagnostics health on both replay paths:
      - async voice-note summary presence/risk/start-failure counters,
      - delete-convergence summary presence/risk/remote-failure counters.
    - suite/cp2 risk checks now require summary presence so capture-missing paths fail deterministically,
      backed by focused regression coverage in `app/shared/m6-voice-replay-bridge.test.ts`.
    - added single-device CP3 self-test helpers to reduce test-coverage blocking when only a small number of trusted accounts is available:
      - `window.obscurM6VoiceReplay.runCp3SingleDeviceSelfTest(...)`,
      - `window.obscurM6VoiceReplay.runCp3SingleDeviceSelfTestJson(...)`,
      - includes synthetic unsupported-runtime and recovery-exhausted probes with explicit pass/fail gates.
  - `v1.1.3` CP3 evidence accepted on limited-account test setup:
    - compact self-test projection returned:
      - `selfTestPass: true`,
      - `selfTestFailedChecks: []`,
      - `suitePass: true`,
      - `weakPass: true`,
      - `accountPass: true`,
      - `unsupportedProbePass: true`,
      - `recoveryExhaustedProbePass: true`.
  - `v1.1.4` started (`M9` CP4 prep lane):
    - added deterministic long-session replay helpers in
      `app/shared/m6-voice-replay-bridge.ts`:
      - `window.obscurM6VoiceReplay.runLongSessionReplay(...)`,
      - `window.obscurM6VoiceReplay.runLongSessionReplayCapture(...)`,
      - `window.obscurM6VoiceReplay.runLongSessionReplayCaptureJson(...)`,
      - `window.obscurM6VoiceReplay.runCp4LongSessionSelfTest(...)`,
      - `window.obscurM6VoiceReplay.runCp4LongSessionSelfTestJson(...)`,
    - helper output now includes `cp4ReadinessGate.pass/failedChecks` with transition-volume/recovery/diagnostics checks for sustained replay health.
    - CP4 self-test now emits a compact overall gate for nominal vs failure-injection lanes (pass/fail + failedChecks), reducing manual console inspection.
    - long-session replay capture now emits digest-visible diagnostics:
      - `messaging.realtime_voice.long_session_gate`.
    - cross-device digest realtime voice summary now includes CP4 gate counters and latest failure sample:
      - `longSessionGateCount`,
      - `longSessionGatePassCount`,
      - `longSessionGateFailCount`,
      - `unexpectedLongSessionGateFailCount`,
      - `latestLongSessionGatePass`,
      - `latestLongSessionGateFailedCheckSample`,
      with risk escalation to `high` only for unexpected non-injected gate failures.
    - dedicated matrix is active:
      - `docs/33-v1.1.4-cp4-voice-long-session-matrix.md`.
    - focused helper validation is green:
      - `pnpm --dir apps/pwa exec vitest run app/shared/log-app-event.test.ts app/shared/m6-voice-replay-bridge.test.ts app/shared/m6-voice-capture.test.ts`,
      - `pnpm --dir apps/pwa exec tsc --noEmit --pretty false`.
  - `v1.1.5` started (`M9` CP4 continuation lane):
    - release-tracked versions are aligned to `1.1.5`,
    - roadmap/changelog/issues are synced for next CP4 secure-voice hardening slices,
    - deterministic CP4 gate-probe helpers landed in canonical replay bridge owner:
      - `window.obscurM6VoiceReplay.runCp4LongSessionGateProbe(...)`,
      - `window.obscurM6VoiceReplay.runCp4LongSessionGateProbeJson(...)`,
      with expected-pass support for both nominal and failure-injection lanes.
    - stale replay-bridge upgrade guard now requires CP4 gate-probe APIs so stale injected bridge objects are auto-upgraded.
    - one-copy voice capture summary now includes CP4 long-session gate counters/latest gate sample from digest output, keeping capture bundles aligned with realtime voice digest schema.
    - focused continuation validation is green:
      - `pnpm --dir apps/pwa exec vitest run app/shared/m6-voice-replay-bridge.test.ts app/shared/m6-voice-capture.test.ts app/shared/log-app-event.test.ts`,
      - `pnpm --dir apps/pwa exec tsc --noEmit --pretty false`.
  - `v1.1.6` started (`M9` CP4 continuation lane):
    - deterministic CP4 checkpoint helper landed in canonical replay bridge owner:
      - `window.obscurM6VoiceReplay.runCp4CheckpointCapture(...)`,
      - `window.obscurM6VoiceReplay.runCp4CheckpointCaptureJson(...)`,
      with one-copy export of `longSession + gateProbe + selfTest + digestSummary + cp4CheckpointGate`.
    - compact CP4 checkpoint gate-probe helpers landed:
      - `window.obscurM6VoiceReplay.runCp4CheckpointGateProbe(...)`,
      - `window.obscurM6VoiceReplay.runCp4CheckpointGateProbeJson(...)`,
      for one-call checkpoint verdict export.
    - stale replay-bridge upgrade guard now requires CP4 checkpoint helper APIs (including checkpoint gate-probe methods) so stale injected bridge objects are auto-upgraded.
    - focused continuation validation is green:
      - `pnpm --dir apps/pwa exec vitest run app/shared/m6-voice-replay-bridge.test.ts app/shared/m6-voice-capture.test.ts app/shared/log-app-event.test.ts`,
      - `pnpm --dir apps/pwa exec tsc --noEmit --pretty false`.

## v1 Readiness Status

- Pre-v1 hardening plan is tracked at:
  - `docs/19-v1-readiness-stability-plan.md`.
- Official `v1.0.0` launch sequencing is tracked at:
  - `docs/20-v1-official-release-execution.md`.
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
  - complete R1-R3 launch execution in `docs/20-v1-official-release-execution.md` on the final clean-tree release commit.

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
