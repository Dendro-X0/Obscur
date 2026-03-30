# Issue Status Snapshot (Post-v1 Monitoring and Release Continuation)

Last updated: 2026-03-25

This file tracks runtime issue status for post-v1 release continuation and stabilization monitoring.

## Current State

- Active release blockers in this file: none.
- Previous v0.9.2 critical incidents are now marked resolved in manual verification and moved to monitoring status.
- Verification source:
  - manual two-device replay + navigation stress replay on dev server,
  - automated reliability/type/docs/release-pack gates passing in this workspace.

## Post-v1 Roadmap Status

- Canonical roadmap:
  - `docs/roadmap/current-roadmap.md`.
- Canonical version-bound execution cadence:
  - `docs/archive/versioned/23-versioned-phase-plan-v1.0.4-v1.0.6.md`.
  - `docs/archive/versioned/25-versioned-phase-plan-v1.0.7-v1.0.9.md`.
  - `docs/archive/versioned/30-versioned-phase-plan-v1.0.10-v1.1.0.md`.
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
    - CP4 checkpoint digest lane now emits canonical event + summary fields from the same owner path:
      - new compact event: `messaging.realtime_voice.cp4_checkpoint_gate`,
      - realtime-voice digest summary now includes:
        - `checkpointGateCount`,
        - `checkpointGatePassCount`,
        - `checkpointGateFailCount`,
        - `unexpectedCheckpointGateFailCount`,
        - `latestCheckpointGatePass`,
        - `latestCheckpointGateFailedCheckSample`.
      - unexpected checkpoint failures (failed while `expectedPass === true`) now escalate realtime voice digest risk to `high`.
    - deterministic CP4 release-readiness helper lane landed in canonical replay bridge owner:
      - `runCp4ReleaseReadinessCapture(...)`,
      - `runCp4ReleaseReadinessCaptureJson(...)`,
      - `runCp4ReleaseReadinessGateProbe(...)`,
      - `runCp4ReleaseReadinessGateProbeJson(...)`,
      returning one-copy checkpoint evidence + latest digest/event alignment checks.
    - stale replay-bridge upgrade guard now requires CP4 release-readiness helper APIs to avoid stale runtime bridge surfaces during CP4 operator verification.
    - CP4 release-readiness helper now emits canonical diagnostics event:
      - `messaging.realtime_voice.cp4_release_readiness_gate`,
      and realtime voice digest summary now includes release-readiness gate counters/latest gate sample:
      - `releaseReadinessGateCount`,
      - `releaseReadinessGatePassCount`,
      - `releaseReadinessGateFailCount`,
      - `unexpectedReleaseReadinessGateFailCount`,
      - `latestReleaseReadinessGatePass`,
      - `latestReleaseReadinessGateFailedCheckSample`.
    - deterministic CP4 release-evidence packet helper landed in canonical replay bridge owner:
      - `runCp4ReleaseEvidenceCapture(...)`,
      - `runCp4ReleaseEvidenceCaptureJson(...)`,
      - `runCp4ReleaseEvidenceGateProbe(...)`,
      - `runCp4ReleaseEvidenceGateProbeJson(...)`,
      with one-copy event slices for:
      - `messaging.realtime_voice.long_session_gate`,
      - `messaging.realtime_voice.cp4_checkpoint_gate`,
      - `messaging.realtime_voice.cp4_release_readiness_gate`.
    - CP4 release-evidence helper now emits canonical diagnostics event:
      - `messaging.realtime_voice.cp4_release_evidence_gate`,
      and realtime voice digest summary now includes release-evidence counters/latest gate sample:
      - `releaseEvidenceGateCount`,
      - `releaseEvidenceGatePassCount`,
      - `releaseEvidenceGateFailCount`,
      - `unexpectedReleaseEvidenceGateFailCount`,
      - `latestReleaseEvidenceGatePass`,
      - `latestReleaseEvidenceGateFailedCheckSample`.
    - one-copy `m6-voice-capture` bundle now includes CP4 gate event slices:
      - `voice.longSessionGateEvents`,
      - `voice.checkpointGateEvents`,
      - `voice.releaseReadinessGateEvents`,
      - `voice.releaseEvidenceGateEvents`.
    - stale replay-bridge upgrade guard now requires CP4 release-evidence helper APIs so stale runtime bridge surfaces are replaced before CP4 operator verification.
    - deterministic `v1.2.0` closeout helper lane landed on the same canonical owner:
      - `window.obscurM6VoiceReplay.runV120CloseoutCapture(...)`,
      - `window.obscurM6VoiceReplay.runV120CloseoutCaptureJson(...)`,
      - `window.obscurM6VoiceReplay.runV120CloseoutGateProbe(...)`,
      - `window.obscurM6VoiceReplay.runV120CloseoutGateProbeJson(...)`,
      composing CP3 suite evidence + CP4 release-evidence packet into one aggregate closeout gate.
    - canonical closeout diagnostics are now emitted from this same lane:
      - `messaging.realtime_voice.v120_closeout_gate`,
      with digest summary counters/sample fields:
      - `closeoutGateCount`,
      - `closeoutGatePassCount`,
      - `closeoutGateFailCount`,
      - `unexpectedCloseoutGateFailCount`,
      - `latestCloseoutGatePass`,
      - `latestCloseoutGateFailedCheckSample`.
    - one-copy `m6-voice-capture` bundle now includes closeout event slice:
      - `voice.closeoutGateEvents`.
    - stale replay-bridge upgrade guard now requires `runV120Closeout*` APIs so stale runtime bridge objects cannot shadow closeout tooling during CP4/v1.2.0 verification.
    - focused continuation validation is green:
      - `pnpm --dir apps/pwa exec vitest run app/shared/m6-voice-replay-bridge.test.ts app/shared/m6-voice-capture.test.ts app/shared/log-app-event.test.ts`,
      - `pnpm --dir apps/pwa exec tsc --noEmit --pretty false`,
      - `pnpm docs:check`,
      - `pnpm version:check`.
  - `v1.2.0` CP4 closeout runtime evidence accepted on 2026-03-25:
    - canonical closeout replay helper returned accepted aggregate pass:
      - `closeoutPass === true`,
      - `cp3SuitePass === true`,
      - `weakNetworkCp2Pass === true`,
      - `accountSwitchCp2Pass === true`,
      - `cp4ReleaseEvidencePass === true`,
      - `cp4ReleaseReadinessPass === true`,
      - `cp4CheckpointPass === true`.
    - delete convergence remained clean in the accepted closeout replay:
      - weak-network/account-switch/long-session delete remote failure counts were `0`.
    - accepted replay emitted canonical closeout-chain diagnostics:
      - `messaging.realtime_voice.long_session_gate`,
      - `messaging.realtime_voice.cp4_checkpoint_gate`,
      - `messaging.realtime_voice.cp4_release_readiness_gate`,
      - `messaging.realtime_voice.cp4_release_evidence_gate`,
      - `messaging.realtime_voice.v120_closeout_gate`.
    - separate relay runtime performance-gate telemetry reported `performanceGateStatus: "warn"` with insufficient sample counts, but this was informational and did not invalidate the secure-voice closeout gate because the canonical closeout verdict stayed green.
    - `v1.2.0` release closeout is complete:
      - `pnpm release:test-pack -- --skip-preflight` passed,
      - `pnpm release:preflight -- --tag v1.2.0` passed on clean tree,
      - tag `v1.2.0` published and GitHub Release is live.
  - `v1.2.1` started (`M10` CP1 lane):
    - docs-first scope lock is active for anti-abuse intelligence + trust controls,
    - roadmap/changelog/issues are synchronized with `v1.2.0` release completion,
    - release-tracked version alignment moved to `1.2.1`,
    - CP1 shared-intel/relay-risk contract owner is now landed:
      - `app/features/messaging/services/m10-shared-intel-policy.ts`,
    - contract boundaries now hard-fail plaintext-like payload metadata with explicit reason code:
      - `contract_violation_plaintext_boundary`,
    - local-first attack-mode safety toggle contracts are now active:
      - `standard|strict` profile gates with deterministic allow/block reason codes,
    - canonical incoming-request anti-abuse owner now consumes CP1 policy decisions:
      - `attack_mode_strict_relay_high_risk`,
      - `attack_mode_peer_shared_intel_blocked`,
      - `attack_mode_contract_violation`,
    - requests inbox anti-spam summary now includes strict-mode quarantine reason counters/badges,
    - signed shared-intel signals are now profile-scoped + persistent (normalized read/write + hydration) via canonical M10 policy owner,
    - attack-mode profile persistence now converges on canonical privacy settings owner (`attackModeSafetyProfileV121`),
    - deterministic operator replay bridge is available for CP1 verification:
      - `window.obscurM10TrustControls.getSnapshot()`,
      - `window.obscurM10TrustControls.captureJson(300)`,
      - `window.obscurM10TrustControls.setAttackModeSafetyProfile("strict")`,
      - `window.obscurM10TrustControls.replaceSignedSharedIntelSignals([...])`,
      - `window.obscurM10TrustControls.ingestSignedSharedIntelSignalsJson({ payloadJson, replaceExisting, requireSignatureVerification })`,
      - `window.obscurM10TrustControls.exportSignedSharedIntelSignalsJson()`,
    - CP1 trust controls now have a settings UI surface for operator/user policy control:
      - `apps/pwa/app/features/settings/components/auto-lock-settings-panel.tsx`,
      - strict/standard attack-mode toggle uses canonical M10 policy owner,
      - signed shared-intel JSON import/export editor includes deterministic ingest evidence summary with signature/replace options,
    - CP1 ingest contract now provides typed acceptance/rejection evidence for shared-intel feeds:
      - `invalid_shape`,
      - `expired`,
      - `missing_signature_verifier`,
      - `invalid_signature`,
      with deterministic dedupe by `signalId` + latest `issuedAtUnixMs`,
    - focused CP1 validation is green:
      - `pnpm --dir apps/pwa exec vitest run app/features/messaging/services/m10-shared-intel-policy.test.ts app/features/messaging/services/incoming-request-anti-abuse.test.ts app/features/messaging/services/incoming-request-quarantine-summary.test.ts`,
      - `pnpm --dir apps/pwa exec vitest run app/features/messaging/controllers/incoming-dm-event-handler.test.ts`,
      - `pnpm --dir apps/pwa exec vitest run app/shared/m10-trust-controls-bridge.test.ts app/features/settings/services/privacy-settings-service.test.ts`,
      - `pnpm --dir apps/pwa exec vitest run app/features/settings/components/auto-lock-settings-panel.test.tsx`,
      - `pnpm --dir apps/pwa exec tsc --noEmit --pretty false`.
    - `v1.2.1` tag has been pushed.
  - `v1.2.2` started (`M10` CP2 lane):
    - trust-controls panel now includes reversible operations (`Undo Last Change`) for import/clear mutations:
      - `apps/pwa/app/features/settings/components/auto-lock-settings-panel.tsx`,
    - panel now surfaces compact trust snapshot counters (`signalCount`, `activeCount`, `block/watch`) for operator clarity,
    - trust-control actions now emit canonical diagnostics events:
      - `messaging.m10.trust_controls_profile_changed`,
      - `messaging.m10.trust_controls_import_result`,
      - `messaging.m10.trust_controls_clear_applied`,
      - `messaging.m10.trust_controls_undo_applied`,
    - M10 bridge capture now includes `recentTrustControlEvents` for replay triage:
      - `apps/pwa/app/shared/m10-trust-controls-bridge.ts`,
    - cross-device digest now exposes compact UI responsiveness risk signals:
      - `summary.uiResponsiveness` in `apps/pwa/app/shared/log-app-event.ts`,
      - includes route stall/fallback, mount-probe slow, transition watchdog, transition-disablement, and startup profile-boot stall evidence,
      - now also includes `routeMountPerformanceGuardEnabledCount`,
    - M10 trust-controls capture now includes `recentResponsivenessEvents` for one-packet operator triage:
      - `apps/pwa/app/shared/m10-trust-controls-bridge.ts`,
    - deterministic CP2 triage helper APIs are now available on M10 bridge:
      - `window.obscurM10TrustControls.runCp2TriageCapture({ eventWindowSize, expectedStable })`,
      - `window.obscurM10TrustControls.runCp2TriageCaptureJson({ eventWindowSize, expectedStable })`,
      - with explicit `cp2TriageGate` pass/fail checks for anti-abuse + responsiveness posture,
    - deterministic CP3 readiness helper APIs are now available on M10 bridge:
      - `window.obscurM10TrustControls.runCp3ReadinessCapture({ eventWindowSize, expectedStable })`,
      - `window.obscurM10TrustControls.runCp3ReadinessCaptureJson({ eventWindowSize, expectedStable })`,
      - `window.obscurM10TrustControls.runCp3ReadinessGateProbe({ eventWindowSize, expectedStable })`,
      - `window.obscurM10TrustControls.runCp3ReadinessGateProbeJson({ eventWindowSize, expectedStable })`,
      - canonical readiness event: `messaging.m10.cp3_readiness_gate`,
    - deterministic CP3 suite helper APIs are now available on M10 bridge:
      - `window.obscurM10TrustControls.runCp3SuiteCapture({ eventWindowSize, expectedStable })`,
      - `window.obscurM10TrustControls.runCp3SuiteCaptureJson({ eventWindowSize, expectedStable })`,
      - `window.obscurM10TrustControls.runCp3SuiteGateProbe({ eventWindowSize, expectedStable })`,
      - `window.obscurM10TrustControls.runCp3SuiteGateProbeJson({ eventWindowSize, expectedStable })`,
      - canonical suite event: `messaging.m10.cp3_suite_gate`,
    - deterministic CP4 closeout helper APIs are now available on M10 bridge:
      - `window.obscurM10TrustControls.runCp4CloseoutCapture({ eventWindowSize, expectedStable })`,
      - `window.obscurM10TrustControls.runCp4CloseoutCaptureJson({ eventWindowSize, expectedStable })`,
      - `window.obscurM10TrustControls.runCp4CloseoutGateProbe({ eventWindowSize, expectedStable })`,
      - `window.obscurM10TrustControls.runCp4CloseoutGateProbeJson({ eventWindowSize, expectedStable })`,
      - canonical closeout event: `messaging.m10.cp4_closeout_gate`,
    - digest now exposes CP3 readiness posture under `summary.m10TrustControls`:
      - `cp3ReadinessGateCount`, pass/fail/unexpected-fail counters, latest CP3 check sample fields,
    - digest now exposes CP3 suite posture under `summary.m10TrustControls`:
      - `cp3SuiteGateCount`, pass/fail/unexpected-fail counters, latest CP3 suite check sample fields,
    - digest now exposes CP4 closeout posture under `summary.m10TrustControls`:
      - `cp4CloseoutGateCount`, pass/fail/unexpected-fail counters, latest CP4 closeout check sample fields,
    - deterministic v1.3 aggregate closeout helper APIs are now available on M10 bridge:
      - `window.obscurM10TrustControls.runV130CloseoutCapture({ eventWindowSize, expectedStable })`,
      - `window.obscurM10TrustControls.runV130CloseoutCaptureJson({ eventWindowSize, expectedStable })`,
      - `window.obscurM10TrustControls.runV130CloseoutGateProbe({ eventWindowSize, expectedStable })`,
      - `window.obscurM10TrustControls.runV130CloseoutGateProbeJson({ eventWindowSize, expectedStable })`,
      - canonical aggregate closeout event: `messaging.m10.v130_closeout_gate`,
    - digest now exposes v1.3 aggregate closeout posture under `summary.m10TrustControls`:
      - `v130CloseoutGateCount`, pass/fail/unexpected-fail counters, latest v1.3 closeout check sample fields,
    - deterministic v1.3 evidence helper APIs are now available on M10 bridge:
      - `window.obscurM10TrustControls.runV130EvidenceCapture({ eventWindowSize, expectedStable })`,
      - `window.obscurM10TrustControls.runV130EvidenceCaptureJson({ eventWindowSize, expectedStable })`,
      - `window.obscurM10TrustControls.runV130EvidenceGateProbe({ eventWindowSize, expectedStable })`,
      - `window.obscurM10TrustControls.runV130EvidenceGateProbeJson({ eventWindowSize, expectedStable })`,
      - canonical evidence event: `messaging.m10.v130_evidence_gate`,
    - digest now exposes v1.3 evidence posture under `summary.m10TrustControls`:
      - `v130EvidenceGateCount`, pass/fail/unexpected-fail counters, latest v1.3 evidence check sample fields,
    - app-shell responsiveness hardening landed on canonical owner:
      - `apps/pwa/app/components/app-shell.tsx` now enables a route-mount performance guard after consecutive slow settles and disables transition effects fail-open,
      - emits `navigation.route_mount_performance_guard_enabled` and enriched `navigation.page_transition_effects_disabled` context for deterministic triage,
    - route-mount diagnostics state now tracks consecutive slow settles:
      - `consecutiveSlowSampleCount` in `apps/pwa/app/components/page-transition-recovery.ts`,
    - focused CP2 slice validation is green:
      - `pnpm --dir apps/pwa exec vitest run app/features/settings/components/auto-lock-settings-panel.test.tsx app/shared/m10-trust-controls-bridge.test.ts app/features/messaging/services/m10-shared-intel-policy.test.ts`,
      - `pnpm --dir apps/pwa exec vitest run app/shared/log-app-event.test.ts`,
      - `pnpm --dir apps/pwa exec vitest run app/components/page-transition-recovery.test.ts app/components/app-shell.test.tsx`,
      - `pnpm --dir apps/pwa exec tsc --noEmit --pretty false`.
  - `v1.2.3` tag is now pushed on GitHub.
  - `v1.2.4` development lane is now active on `main` for M10 CP3/CP4 closeout slices.
  - `v1.2.4` demo-asset execution pack is now defined:
    - matrix doc: `docs/34-v1.2.4-m10-demo-asset-matrix.md`,
    - output folder: `docs/assets/demo/v1.2.4/`,
    - includes required CP3/CP4/v130 pass-lane JSON captures and digest/event bundle checklist.
  - deterministic demo-bundle automation is now available for this lane:
    - `pnpm demo:m10:init` (create missing template files),
    - `pnpm demo:m10:check:structure` (schema/structure gate),
    - `pnpm demo:m10:materialize` (derive canonical pass-lane files from raw evidence captures; now supports one-shot `--bundle` input),
    - `pnpm demo:m10:check` (strict pass-lane gate),
    - `pnpm demo:m10:status` (writes machine-readable readiness report).
  - one-shot demo evidence export helper is now available on canonical M10 bridge:
    - `window.obscurM10TrustControls.runV124DemoAssetBundleCaptureJson({ eventWindowSize, expectedStable })`.
  - raw capture staging folder is now tracked for one-copy operator handoff:
    - `docs/assets/demo/v1.2.4/raw/README.md`.
  - demo bundle now emits progress status file:
    - `docs/assets/demo/v1.2.4/m10-status.json`,
    - use `strictReady` as the phase-complete signal for demo-asset gate.
  - latest M10 demo evidence gate result:
    - `pnpm demo:m10:check` is green,
    - `strictReady: true` is confirmed in `docs/assets/demo/v1.2.4/m10-status.json`.
  - `v1.2.4` tag is now pushed on GitHub.
  - `v1.2.6` development lane is now closed out; `v1.2.7` is active on `main` for final M10 execution toward `v1.3.0`.
  - `v1.2.6` closeout automation slice landed:
    - `pnpm closeout:v130:check` now runs strict RC artifact verification + docs/version + focused M10 test/typecheck checks in one command (without rewriting `m10-status.json`) and enforces a clean working tree by default,
    - `--allow-dirty` is now an explicit local-only escape hatch for non-release runs,
    - `pnpm closeout:v130:check:refresh-status` runs the same gate but refreshes `m10-status.json`,
    - `pnpm closeout:v130:check:with-preflight` adds `release:preflight -- --tag v1.3.0` for release-bound runs.
  - `v1.2.7` closeout gate tightening slice landed:
    - `closeout:v130:check` now also validates v1.3 manual packet structure,
    - `pnpm closeout:v130:check:manual` requires strict manual packet completeness,
    - `pnpm closeout:v130:check:release-ready` combines strict manual packet + release preflight in one command.
  - `v1.2.7` closeout-operator flow slice landed:
    - `pnpm demo:m10:rc:refresh` now runs `materialize -> strict check -> status -> next` in one command,
    - optional local closeout validation path is available via:
      - `pnpm demo:m10:rc:refresh -- --with-closeout-check`.
  - tag-workflow observability slice landed:
    - `pnpm release:workflow-status -- --tag v1.2.6` now prints canonical
      `Obscur Full Release` run and per-job state from GitHub API,
    - use this command to verify whether tag lanes are still running vs completed
      before concluding that release publishing is blocked.
  - `v1.2.7` manual evidence packet slice landed:
    - `pnpm demo:v130:init` now scaffolds a deterministic closeout packet at
      `docs/assets/demo/v1.3.0/` for manual QA + performance/UX verification + GIF capture,
    - packet includes:
      - `manual-verification-checklist.md`,
      - `gif-shot-list.md`,
      - `runtime-evidence-summary.json`,
      - `raw/` capture staging templates.
    - packet validation commands are now available:
      - `pnpm demo:v130:check` (structure check),
      - `pnpm demo:v130:check:strict` (final strict closeout check before tag push).
  - deterministic one-shot release-candidate helper is now available on canonical M10 bridge:
    - `window.obscurM10TrustControls.runV130ReleaseCandidateCapture({ eventWindowSize, expectedStable })`,
    - `window.obscurM10TrustControls.runV130ReleaseCandidateCaptureJson({ eventWindowSize, expectedStable })`,
    - `window.obscurM10TrustControls.runV130ReleaseCandidateGateProbe({ eventWindowSize, expectedStable })`,
    - `window.obscurM10TrustControls.runV130ReleaseCandidateGateProbeJson({ eventWindowSize, expectedStable })`,
    - canonical release-candidate event: `messaging.m10.v130_release_candidate_gate`.
  - deterministic `v1.2.5` release-candidate asset automation is now available:
    - `pnpm demo:m10:rc:init`,
    - `pnpm demo:m10:rc:materialize -- --capture docs/assets/demo/v1.2.5/raw/m10-v130-release-candidate-capture.json`,
    - `pnpm demo:m10:rc:check:structure`,
    - `pnpm demo:m10:rc:check`,
    - `pnpm demo:m10:rc:status`.
  - release-candidate capture and artifact checks now require explicit `v130ReleaseCandidate` event slices
    so one-shot closeout bundles prove their own gate-event visibility.
  - release-candidate evidence matrix and output folder are now tracked:
    - matrix: `docs/35-v1.2.5-m10-release-candidate-matrix.md`,
    - artifacts: `docs/assets/demo/v1.2.5/`.
  - latest release-candidate artifact gate result:
    - `pnpm demo:m10:rc:check` is green,
    - `docs/assets/demo/v1.2.5/m10-status.json` reports `strictReady: true` on materialized runtime evidence.
  - focused v1.2.5 lane validation is green:
    - `pnpm --dir apps/pwa exec vitest run app/shared/m10-trust-controls-bridge.test.ts`,
    - `pnpm --dir apps/pwa exec tsc --noEmit --pretty false`.

## v1 Readiness Status

- Pre-v1 hardening plan is tracked at:
  - `docs/19-v1-readiness-stability-plan.md`.
- Official `v1.0.0` launch sequencing is tracked at:
  - `docs/releases/release-closeout-guide.md`.
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
  - complete launch execution checklist in `docs/releases/release-closeout-guide.md` on the final clean-tree release commit.

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
