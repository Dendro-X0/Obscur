# 21 Post-v1 Value Roadmap

_Last reviewed: 2026-03-23 (baseline commit 4c869a7)._

This roadmap defines the long-term value track after the `v1.0.0` release.

Primary goals:
1. make Obscur communities substantially more useful for niche ecosystems (music, art, encryption, technology),
2. deliver secure and stable real-time voice communication,
3. protect legitimate users with privacy-preserving anti-fraud/anti-spam controls.

## Scope Lock

1. No new parallel owners for runtime, sync, identity, or transport lifecycles.
2. No plaintext-content moderation or centralized censorship controls.
3. No release claims without runtime evidence (tests + manual replay).
4. Anti-abuse controls must remain local-first, explainable, and user-configurable.

## Pillars

## P1 - Community Platform Expansion

Target outcomes:
1. richer community structure and governance UX,
2. better operator tools without central admin dependency,
3. stronger discoverability and engagement primitives.

Planned capability set:
1. structured community spaces (channels/topics),
2. richer member profile cards and participation signals,
3. governance history/audit surfaces (vote/result trace),
4. shared knowledge surfaces (pinned resources, media collections, event cards),
5. reliability-first invite/join/recovery UX.

## P2 - Voice Communication (Secure + Stable)

Target outcomes:
1. low-friction voice interaction for communities and trusted contacts,
2. deterministic fallback under relay/network degradation,
3. explicit runtime capability detection across desktop/web/mobile.

Planned capability set:
1. Stage A: async voice notes + playback/transcript/search affordances,
2. Stage B: small-room real-time voice beta with strict E2EE path,
3. adaptive quality and relay-failure handling,
4. explicit unsupported-path errors (never silent optimistic success).

## P3 - Privacy-Preserving Anti-Abuse (Anti-Fraud + Anti-Spam)

Target outcomes:
1. protect legitimate users without content censorship,
2. reduce spam/fraud pressure on identity-isolated accounts,
3. keep decisions transparent and reversible by users.

Planned capability set:
1. behavior/rate abuse scoring (invite bursts, DM bursts, join-leave churn),
2. suspicious-first-contact quarantine inbox,
3. optional signed shared blocklists and relay risk scoring,
4. attack-mode safety profile ("strict mode", emergency hardening),
5. reason-coded block/deny outcomes with local audit trail.

Hard constraints:
1. no plaintext message scanning,
2. no centralized universal-ban operator.

## P4 - Identity and Cross-Device Resilience

Target outcomes:
1. prevent account/session drift after device switches,
2. improve deterministic restore confidence for DM/group/media history,
3. preserve membership/sendability convergence.

Planned capability set:
1. stronger restore diagnostics and mismatch reason codes,
2. profile/account scope verification during startup binding,
3. backup/restore evidence gates for identity and room-key portability,
4. recoverability playbook updates for maintainers/operators.

## P5 - Performance and UX Reliability

Target outcomes:
1. eliminate route-freeze and blank-page class regressions,
2. smooth large-timeline scrolling and media-heavy sessions,
3. predictable startup behavior across relay quality bands.

Planned capability set:
1. route transition and startup budget instrumentation,
2. fail-open navigation behavior when relay transport is degraded,
3. continued virtualized timeline + media rendering optimization,
4. UI responsiveness guardrails for desktop and mobile.

## Milestones

## M0 - Post-v1 Baseline and Instrumentation Lock

Scope:
1. freeze post-v1 pillars and acceptance contracts,
2. add roadmap-linked diagnostics checklist into maintainer runbooks,
3. confirm current green baseline before feature expansion.

Acceptance:
1. `pnpm version:check`
2. `pnpm docs:check`
3. `pnpm release:test-pack -- --skip-preflight`

Current execution status (completed 2026-03-22):
1. Pillars and milestone acceptance contracts are frozen in this document.
2. Maintainer runbook includes a dedicated post-v1 M0 diagnostics checklist:
: `docs/08-maintainer-playbook.md`.
3. M0 baseline gate replay is green on `main`:
: `pnpm version:check`
: `pnpm docs:check`
: `pnpm release:test-pack -- --skip-preflight`

## M1 - Community Platform Foundation + Anti-Abuse Foundation

Scope:
1. deliver first community expansion slice (structure + governance visibility),
2. ship anti-abuse foundation (rate controls + quarantine + reason codes),
3. keep all moderation and state outcomes evidence-backed.

Acceptance:
1. two-device community join/send/recover replay passes,
2. anti-abuse decisions are reason-coded in diagnostics/UI,
3. no regression in existing DM/group delivery contracts.

Current execution status (started 2026-03-22):
1. Anti-abuse foundation slice landed on canonical incoming request path:
: unknown-sender `connection-request` burst guard (per-peer + global window) in
: `apps/pwa/app/features/messaging/services/incoming-request-anti-abuse.ts`.
2. Incoming DM owner now emits reason-coded quarantine diagnostics:
: `messaging.request.incoming_quarantined` app event with explicit `reasonCode` and threshold counters.
3. Focused regression coverage added and passing:
: `apps/pwa/app/features/messaging/services/incoming-request-anti-abuse.test.ts`
: `apps/pwa/app/features/messaging/controllers/incoming-dm-event-handler.test.ts`
: plus `pnpm --dir apps/pwa exec tsc --noEmit --pretty false`.
4. Requests inbox anti-abuse visibility slice landed:
: UI now surfaces quarantined-request summary + per-peer anti-spam signal badges from canonical app-event diagnostics via
: `apps/pwa/app/features/messaging/services/incoming-request-quarantine-summary.ts`
: and `apps/pwa/app/features/messaging/components/requests-inbox-panel.tsx`.
5. Community operator visibility slice landed in management UI:
: members tab now surfaces deterministic operator-health metrics (active/known/online-offline counts, kick-vote pressure, lifecycle drift, disband status) and reasoned governance signals from a typed helper in
: `apps/pwa/app/features/groups/services/community-operator-health.ts`
: and `apps/pwa/app/features/groups/components/group-management-dialog.tsx`.
6. Focused operator-health regression coverage added:
: `apps/pwa/app/features/groups/services/community-operator-health.test.ts`.
7. M1 closeout automation replay is green (2026-03-23):
: `pnpm --dir apps/pwa exec vitest run app/features/messaging/services/incoming-request-anti-abuse.test.ts app/features/messaging/services/incoming-request-quarantine-summary.test.ts app/features/messaging/controllers/incoming-dm-event-handler.test.ts app/features/groups/services/community-operator-health.test.ts`
: `pnpm --dir apps/pwa exec tsc --noEmit --pretty false`
: `pnpm docs:check`
8. Remaining before declaring M1 complete:
: manual two-device replay evidence for anti-abuse quarantine UX + community operator visibility UX, captured using
: `window.obscurAppEvents.findByName("messaging.request.incoming_quarantined", 30)`
: `window.obscurDeliveryDiagnostics?.getSnapshot()?.lastIncoming`
: `copy(window.obscurM0Triage?.captureJson(300))`.

## M2 - Identity/Sync Hardening + Voice Stage A

Scope:
1. strengthen restore and profile-binding resilience surfaces,
2. ship async voice capability (record/send/playback/search-ready metadata),
3. maintain deterministic fallback behavior when voice capabilities are unavailable.

Acceptance:
1. cross-device DM/group/media continuity replay stays green,
2. async voice works on supported runtimes and fails explicitly otherwise,
3. no startup-binding regressions in restart/account-switch flows.

Current execution status (started 2026-03-23):
1. Startup/profile-binding diagnostics hardening slice landed on canonical startup owners:
: `runtime.profile_binding_refresh_timeout` and `runtime.profile_binding_refresh_failed` now emit reason-coded app events from
: `apps/pwa/app/features/profiles/components/desktop-profile-bootstrap.tsx`.
2. Auto-unlock scope drift detection landed:
: `auth.auto_unlock_scope_drift_detected` now emits when bound-profile startup relies on cross-profile fallback remember/token scope in
: `apps/pwa/app/features/auth/components/auth-gateway.tsx`.
3. Focused regression coverage added and passing:
: `apps/pwa/app/features/profiles/components/desktop-profile-bootstrap.test.tsx`
: `apps/pwa/app/features/auth/components/auth-gateway.test.tsx`
: plus `pnpm --dir apps/pwa exec tsc --noEmit --pretty false`.
4. Room-key portability mismatch diagnostics landed on canonical group send path:
: `groups.room_key_missing_send_blocked` now includes reason-coded context (`reasonCode`, `localRoomKeyCount`, `hasTargetGroupRecord`, `activeProfileId`, `knownGroupHintSample`) from
: `apps/pwa/app/features/groups/services/group-service.ts`.
5. Focused portability diagnostics coverage added and passing:
: `apps/pwa/app/features/groups/services/group-service.test.ts`
: and digest contract coverage in
: `apps/pwa/app/shared/log-app-event.test.ts`.
6. Backup-restore profile-scope drift diagnostics landed on canonical restore owner:
: `account_sync.backup_restore_profile_scope_mismatch` now emits reason-coded warnings when restore runs with an explicit profile scope that diverges from the active bound profile, or active profile scope shifts during restore apply in
: `apps/pwa/app/features/account-sync/services/encrypted-account-backup-service.ts`.
7. Focused profile-scope drift regression coverage added and passing:
: `apps/pwa/app/features/account-sync/services/encrypted-account-backup-service.test.ts`
: plus triage/digest contract updates in
: `apps/pwa/app/shared/m0-triage-capture.test.ts`
: and `apps/pwa/app/shared/log-app-event.test.ts`.
8. Runtime activation scope-convergence diagnostics landed on canonical activation owner:
: `runtime.activation.profile_scope_mismatch` now emits reason-coded warnings when bound-profile/session identity diverges from account-projection or account-sync scope in
: `apps/pwa/app/features/runtime/components/runtime-activation-manager.tsx`.
9. Focused activation scope diagnostics coverage added and passing:
: `apps/pwa/app/features/runtime/components/runtime-activation-manager.test.tsx`
: plus compact digest + M0 triage contract updates in
: `apps/pwa/app/shared/log-app-event.test.ts`
: and `apps/pwa/app/shared/m0-triage-capture.test.ts`.
10. Async voice Stage A capability hardening started:
: `VoiceRecorder` now resolves runtime recording capability before attempting capture and emits explicit unsupported/start-failure diagnostics (`messaging.voice_note.recording_unsupported`, `messaging.voice_note.recording_start_failed`) from
: `apps/pwa/app/features/messaging/components/voice-recorder.tsx`.
12. Voice note capture is now wired into canonical composer attachment flow:
: `apps/pwa/app/features/main-shell/main-shell.tsx` now passes `onSendVoiceNote` into `ChatView`, routing recorded files through existing attachment processing and send flow.
11. Voice capability contract coverage added:
: typed capability resolver in
: `apps/pwa/app/features/messaging/services/voice-note-recording-capability.ts`
: with focused regression coverage in
: `apps/pwa/app/features/messaging/services/voice-note-recording-capability.test.ts`.
13. Voice-note Stage A metadata/search-readiness slice landed:
: added typed voice-note metadata parsing + search token contracts in
: `apps/pwa/app/features/messaging/services/voice-note-metadata.ts`
: and message search indexing helpers in
: `apps/pwa/app/features/messaging/services/message-search-index.ts`.
: chat-history search now indexes attachment metadata (including voice-note duration/name tokens) via
: `apps/pwa/app/features/messaging/services/chat-state-store.ts`.
: recorder output now includes duration-aware filenames (`voice-note-<timestamp>-d<seconds>.<ext>`) and completion diagnostics (`messaging.voice_note.recording_complete`) from
: `apps/pwa/app/features/messaging/components/voice-recorder.tsx`.
14. `v1.0.3` release slice completed (2026-03-23):
: finalized voice-note Stage A UX hardening and release packaging on `main`,
: shipped dedicated timeline `VoiceNoteCard` presentation split from generic audio file cards,
: aligned light/dark contrast-safe gradient token usage in message and invite surfaces,
: shipped sidebar action-role clarification (`+` create vs `...` global section controls),
: hardened in-chat search result jump handling against virtualized/history-paged timelines.
15. Remaining before declaring M2 complete:
: capture manual two-device evidence for full M2 acceptance contract (cross-device DM/group/media continuity + startup/account-switch stability + voice-note fallback behavior),
: keep post-release runtime watch active on search-jump navigation behavior in long-history conversations.
16. `v1.0.4` M2 checkpoint started with deterministic search-jump navigation hardening:
: search-jump now carries timestamp context from search results and can resolve via timestamp fallback when canonical message-id matching is unavailable in the current timeline window,
: jump flow now emits reason-coded diagnostics (`messaging.search_jump_requested`, `messaging.search_jump_resolved`, `messaging.search_jump_unresolved`) with attempt counters and resolution mode for triage replay,
: cross-device digest and M0 triage capture now include search-jump diagnostic events for manual verification bundles.
17. Local history reset hardening slice landed (2026-03-27):
: canonical "Reset Local History (Keep Identity)" service now clears local history/sync artifacts and caches without removing identity/session ownership in
: `apps/pwa/app/features/messaging/services/local-history-reset-service.ts`,
: wired to Settings storage maintenance action in
: `apps/pwa/app/settings/page.tsx`.
18. Deleted-account consistency sweep landed on canonical presence owner (2026-03-27):
: `apps/pwa/app/features/network/hooks/use-realtime-presence.ts` now gates deleted peers to offline/null-last-seen even when stale presence records exist.
19. Focused regression coverage added and passing:
: `apps/pwa/app/features/messaging/services/local-history-reset-service.test.ts`
: `apps/pwa/app/features/network/hooks/use-realtime-presence.deleted-profile.test.ts`
: plus `pnpm --dir apps/pwa exec tsc --noEmit --pretty false`.
20. Deleted-account consistency sweep extended to community member surfaces (2026-03-27):
: canonical member visibility helper landed in
: `apps/pwa/app/features/groups/services/community-visible-members.ts`
: and is now used by both group home/member sync and management registry UI in
: `apps/pwa/app/groups/[...id]/group-home-page-client.tsx`
: and `apps/pwa/app/features/groups/components/group-management-dialog.tsx`
: so deleted-account profiles are excluded from member counts/online metrics/list rows.
21. Focused community visibility regression coverage added and passing:
: `apps/pwa/app/features/groups/services/community-visible-members.test.ts`.
22. Auth/presence render-purity hardening landed on canonical owners (2026-03-28):
: `apps/pwa/app/features/auth/components/auth-gateway.tsx` now gates transient auto-unlock retries by deterministic wake-nonce timers (no render-time clock reads),
: `apps/pwa/app/features/network/hooks/use-realtime-presence.ts` now initializes `selfStartedAtMs` via stable state initialization instead of render-time clock memoization.
23. Focused hardening validation added and passing:
: `pnpm --dir apps/pwa exec vitest run app/features/auth/components/auth-gateway.test.tsx app/features/network/hooks/use-realtime-presence.deleted-profile.test.ts`
: `pnpm --dir apps/pwa exec tsc --noEmit --pretty false`.

## M3 - Real-Time Voice Beta + Community Operator Tools

Scope:
1. small-room encrypted real-time voice beta,
2. community operator UX upgrades (moderation/policy/health visibility),
3. anti-abuse shared-intel optional path (signed blocklists/relay risk).

Acceptance:
1. stable beta replay under weak-network simulation,
2. operator workflows complete without ambiguous outcomes,
3. release claims backed by tests + manual matrix evidence.

Current execution status (started 2026-03-23):
1. `v1.0.5` CP1 foundation slice landed with typed real-time voice capability contracts:
: added deterministic capability classifier in
: `apps/pwa/app/features/messaging/services/realtime-voice-capability.ts`,
: including secure-context/media-devices/WebRTC addTrack readiness + Opus capability status.
2. Focused capability coverage added and passing:
: `apps/pwa/app/features/messaging/services/realtime-voice-capability.test.ts`
: `pnpm --dir apps/pwa exec tsc --noEmit --pretty false`.

## M4 - Stabilization, Rollout, and Patch Discipline

Scope:
1. harden high-risk findings from beta usage,
2. keep patch slices narrow and owner-consistent,
3. publish updated rollout playbook before broader community expansion.

Acceptance:
1. strict release preflight for target tag is green on clean `main`,
2. no active blocker in `ISSUES.md`,
3. roadmap completion status documented before next major planning cycle.

Current execution status (completed 2026-03-23):
1. `v1.0.6` CP1 stabilization slice landed for in-chat search jump:
: extracted typed jump-step/dom-resolution contracts in
: `apps/pwa/app/features/messaging/components/message-search-jump.ts`.
2. Timestamp-fallback jump convergence hardening landed in canonical timeline owner:
: `apps/pwa/app/features/messaging/components/message-list.tsx` now requires dom target materialization before marking timestamp fallback as resolved, and emits explicit unresolved diagnostics (`timestamp_fallback_dom_not_resolved`) when retries are exhausted.
3. Focused CP1 automation replay is green:
: `pnpm --dir apps/pwa exec vitest run app/features/messaging/components/message-search-jump.test.ts app/features/messaging/components/chat-view.test.tsx app/shared/log-app-event.test.ts app/shared/m0-triage-capture.test.ts`
: `pnpm --dir apps/pwa exec tsc --noEmit --pretty false`.
4. `v1.0.6` CP2 diagnostics slice started on search-jump triage digest:
: `apps/pwa/app/shared/log-app-event.ts` now exposes `summary.searchJumpNavigation` in `getCrossDeviceSyncDigest`, including risk-level and reasoned unresolved diagnostics counters.
5. Focused CP2 diagnostics coverage is green:
: `pnpm --dir apps/pwa exec vitest run app/shared/log-app-event.test.ts`
: `pnpm --dir apps/pwa exec tsc --noEmit --pretty false`.
6. `v1.0.6` CP3 soak-evidence prep slice landed:
: added `window.obscurM4Stabilization.captureJson(400)` helper for one-copy long-session search-jump stabilization bundles in
: `apps/pwa/app/shared/m4-stabilization-capture.ts`,
: installed at boot in `apps/pwa/app/components/providers.tsx`.
7. Focused CP3 helper regression coverage is green:
: `pnpm --dir apps/pwa exec vitest run app/shared/m4-stabilization-capture.test.ts`
: `pnpm --dir apps/pwa exec tsc --noEmit --pretty false`.
8. CP3 manual soak execution matrix is documented in:
: `docs/24-v1.0.6-cp3-soak-matrix.md`.
9. CP4 release gates and tag flow completed on clean `main`:
: `pnpm version:check`
: `pnpm docs:check`
: `pnpm release:integrity-check`
: `pnpm release:artifact-version-contract-check`
: `pnpm release:ci-signal-check`
: `pnpm release:test-pack -- --skip-preflight`
: `pnpm release:preflight -- --tag v1.0.6`
: release commit/tag shipped as `v1.0.6`.

## M5 - Community Lifecycle Convergence and Governance Reliability

Scope:
1. harden community identity/membership convergence across account switch + restart flows,
2. make membership/sendability outcomes deterministic when room keys and membership ledgers disagree,
3. keep creator/operator governance surfaces stable without introducing new lifecycle owners.

Acceptance:
1. two-device account-switch replay keeps community name, membership list, and sendability converged,
2. no silent fallback to default community metadata when membership evidence exists,
3. group send failures remain reason-coded and recoverable through canonical paths.

Current execution status (started 2026-03-23):
1. Docs-first kickoff started for `v1.0.7` with version-bound checkpoint planning in:
: `docs/25-versioned-phase-plan-v1.0.7-v1.0.9.md`.
2. `M5` CP1 convergence slice landed in canonical membership recovery owner:
: `apps/pwa/app/features/groups/services/community-membership-recovery.ts`.
3. Recovery now merges duplicate persisted group rows instead of taking a newer regressed row verbatim:
: keeps richer display-name/member/admin coverage when replay order is degraded.
4. Joined-ledger merge now enforces local membership coverage and metadata convergence:
: replaces placeholder `Private Group` names with richer joined-ledger display names when available,
: backfills active account pubkey into recovered member coverage when joined evidence exists.
5. Group membership recovery diagnostics now include explicit convergence counters:
: `persistedDuplicateMergeCount`,
: `placeholderDisplayNameRecoveredCount`,
: `localMemberBackfillCount`.
6. Focused CP1 validation replay is green:
: `pnpm --dir apps/pwa exec vitest run app/features/groups/services/community-membership-recovery.test.ts app/features/groups/providers/group-provider.test.tsx app/features/groups/providers/group-provider.cross-device-membership.integration.test.tsx`
: `pnpm --dir apps/pwa exec tsc --noEmit --pretty false`.
7. `M5` CP2 diagnostics slice landed for one-copy convergence triage:
: `getCrossDeviceSyncDigest` now includes `summary.communityLifecycleConvergence` with repair/missing-coverage counters from
: `groups.membership_recovery_hydrate` and sendability interplay evidence.
8. M0 capture sync-restore focus now includes membership recovery/ledger hydration diagnostics:
: `groups.membership_recovery_hydrate`
: `groups.membership_ledger_load`.
9. Focused CP2 diagnostics replay is green:
: `pnpm --dir apps/pwa exec vitest run app/shared/log-app-event.test.ts app/shared/m0-triage-capture.test.ts`
: `pnpm --dir apps/pwa exec tsc --noEmit --pretty false`.
10. `M5` CP3 manual replay matrix is now defined:
: `docs/26-v1.0.7-cp3-community-convergence-matrix.md`.
11. CP3 status:
: operator two-device/account-switch replay evidence is captured and accepted per matrix criteria.
12. CP4 release-gate replay is green in this checkpoint workspace (2026-03-23):
: `pnpm --dir apps/pwa exec vitest run app/features/groups/services/community-membership-recovery.test.ts app/features/groups/providers/group-provider.test.tsx app/features/groups/providers/group-provider.cross-device-membership.integration.test.tsx app/shared/log-app-event.test.ts app/shared/m0-triage-capture.test.ts`
: `pnpm --dir apps/pwa exec tsc --noEmit --pretty false`
: `pnpm version:check`
: `pnpm docs:check`
: `pnpm release:integrity-check`
: `pnpm release:artifact-version-contract-check`
: `pnpm release:ci-signal-check`
: `pnpm release:test-pack -- --skip-preflight`
: `pnpm release:preflight -- --tag v1.0.7 --allow-dirty true`
13. `v1.0.7` release/tagging is complete:
: strict clean-tree `pnpm release:preflight -- --tag v1.0.7` passed before push/tag,
: `main` and tag `v1.0.7` are published on origin.

## M6 - Real-Time Voice Beta Slice (Small-Room, Evidence-Backed)

Scope:
1. advance typed capability contracts into bounded small-room voice session lifecycle,
2. enforce explicit unsupported/degraded-path outcomes under weak relay/network conditions,
3. preserve deterministic teardown/recovery without cross-owner drift.

Acceptance:
1. weak-network manual replay stays interactive and recovers predictably,
2. no optimistic success states without peer/session evidence,
3. voice path does not regress existing DM/group transport stability.

Current execution status:
1. `v1.0.8` lane started with a CP1 lifecycle-contract slice on canonical voice-session owner:
: `apps/pwa/app/features/messaging/services/realtime-voice-session-lifecycle.ts`.
2. New typed contracts now enforce bounded create/join/connect/degrade/recover/leave flows:
: `active` state is gated by explicit peer-session evidence,
: recovery attempts are bounded with deterministic terminal outcome (`recovery_exhausted`),
: unsupported/degraded reasons are explicit and replay-safe.
3. Focused CP1 regression coverage is green:
: `apps/pwa/app/features/messaging/services/realtime-voice-session-lifecycle.test.ts`
: `pnpm --dir apps/pwa exec tsc --noEmit --pretty false`.
4. CP2 diagnostics contracts landed for degraded/unsupported realtime voice paths:
: canonical transition diagnostics helper now emits `messaging.realtime_voice.session_transition` with phase/reason evidence from
: `apps/pwa/app/features/messaging/services/realtime-voice-session-diagnostics.ts`.
5. Cross-device digest and M0 triage now expose realtime-voice risk signals:
: `summary.realtimeVoiceSession` in
: `apps/pwa/app/shared/log-app-event.ts`,
: plus M0 focus capture for `messaging.realtime_voice.session_transition` in
: `apps/pwa/app/shared/m0-triage-capture.ts`.
6. Focused CP2 diagnostics replay is green:
: `apps/pwa/app/features/messaging/services/realtime-voice-session-diagnostics.test.ts`
: `apps/pwa/app/shared/log-app-event.test.ts`
: `apps/pwa/app/shared/m0-triage-capture.test.ts`
: `pnpm --dir apps/pwa exec tsc --noEmit --pretty false`.
7. CP3 evidence-capture prep landed for weak-network/manual replay:
: one-copy helper `window.obscurM6VoiceCapture.captureJson(400)` added in
: `apps/pwa/app/shared/m6-voice-capture.ts`,
: installed at app boot in
: `apps/pwa/app/components/providers.tsx`.
8. Focused CP3 helper validation is green:
: `apps/pwa/app/shared/m6-voice-capture.test.ts`
: `pnpm --dir apps/pwa exec tsc --noEmit --pretty false`.
9. CP3 manual weak-network replay matrix is now defined:
: `docs/27-v1.0.8-cp3-voice-replay-matrix.md`.
10. Deterministic replay bridge is now available for CP3 evidence on builds without exposed voice UI:
: `window.obscurM6VoiceReplay.runWeakNetworkReplay()` in
: `apps/pwa/app/shared/m6-voice-replay-bridge.ts`.
11. CP3 weak-network replay evidence is captured and accepted (2026-03-23):
: `window.obscurM6VoiceReplay.runWeakNetworkReplay()` emitted deterministic transition evidence:
: `idle -> connecting -> active -> degraded -> connecting -> active`,
: and `window.obscurM6VoiceCapture.captureJson(400)` confirmed no `recovery_exhausted` signal in replay window.
12. CP4 status:
: strict clean-tree release preflight passed and release handoff is complete:
: `pnpm release:preflight -- --tag v1.0.8`
: `main` and tag `v1.0.8` are published on origin.

## M7 - Anti-Abuse Intelligence and UX/Performance Reliability Hardening

Scope:
1. extend privacy-preserving anti-abuse controls with explainable operator/user outcomes,
2. harden route/startup/chat responsiveness under sustained history + media load,
3. close high-risk regressions discovered during M5/M6 rollout.

Acceptance:
1. anti-abuse decisions remain reason-coded, reversible, and local-first,
2. route freeze/blank-page class regressions remain non-reproducible in soak replay,
3. release closeout includes diagnostics bundle + manual evidence matrix.

Current execution status:
1. `v1.0.9` lane started with a CP1 anti-abuse hardening slice on canonical incoming-request owner:
: `apps/pwa/app/features/messaging/services/incoming-request-anti-abuse.ts`.
2. Per-peer cooldown enforcement landed after burst-limit quarantine:
: cooldown reason code `peer_cooldown_active` now blocks repeated same-sender retries during the cooldown window after `peer_rate_limited`.
3. Cooldown visibility now flows through diagnostics and inbox UX:
: incoming quarantine diagnostics include cooldown context in
: `apps/pwa/app/features/messaging/controllers/incoming-dm-event-handler.ts`,
: quarantine summary reason support in
: `apps/pwa/app/features/messaging/services/incoming-request-quarantine-summary.ts`,
: and Requests inbox reason chips/badges in
: `apps/pwa/app/features/messaging/components/requests-inbox-panel.tsx`.
4. Focused CP1 validation is green:
: `pnpm --dir apps/pwa exec vitest run app/features/messaging/services/incoming-request-anti-abuse.test.ts app/features/messaging/services/incoming-request-quarantine-summary.test.ts`
: `pnpm --dir apps/pwa exec tsc --noEmit --pretty false`.
5. CP2 diagnostics slice landed for anti-abuse triage:
: cross-device digest now includes `summary.incomingRequestAntiAbuse` plus compact event slices for
: `messaging.request.incoming_quarantined` in
: `apps/pwa/app/shared/log-app-event.ts`.
6. M0 triage capture sync/restore focus now includes incoming request quarantine evidence:
: `apps/pwa/app/shared/m0-triage-capture.ts`.
7. Maintainer replay runbook now includes anti-abuse digest summary checks:
: `docs/08-maintainer-playbook.md`.
8. CP3 prep helper landed for one-copy anti-abuse evidence export:
: `window.obscurM7AntiAbuseCapture.captureJson(400)` in
: `apps/pwa/app/shared/m7-anti-abuse-capture.ts`,
: installed at app boot in `apps/pwa/app/components/providers.tsx`.
9. Focused CP2/CP3-prep validation is green:
: `pnpm --dir apps/pwa exec vitest run app/shared/log-app-event.test.ts app/shared/m0-triage-capture.test.ts`
: `pnpm --dir apps/pwa exec vitest run app/shared/m7-anti-abuse-capture.test.ts`
: `pnpm --dir apps/pwa exec tsc --noEmit --pretty false`.
10. CP3 helper now includes an explicit anti-abuse replay-readiness verdict:
: `antiAbuse.replayReadiness` in
: `apps/pwa/app/shared/m7-anti-abuse-capture.ts`
: reports observed reason-code timeline plus `readyForCp3Evidence` for deterministic manual gate checks.
11. CP1 reliability hardening landed for DM delete-for-everyone on attachment-heavy/voice-note rows:
: delete target derivation in
: `apps/pwa/app/features/main-shell/hooks/use-chat-actions.ts`
: now computes NIP-17 rumor ids even when `dmFormat` is missing and adds attachment-markdown + created-at fallback candidates for hydrated rows.
12. Focused delete-convergence validation is green:
: `pnpm --dir apps/pwa exec vitest run app/features/main-shell/hooks/use-chat-actions.delete-targets.test.ts app/features/messaging/controllers/incoming-dm-event-handler.test.ts`
: `pnpm --dir apps/pwa exec tsc --noEmit --pretty false`.
13. CP4 release-gate replay is green on clean `main` for `v1.0.9` preflight contract:
: `pnpm release:preflight -- --tag v1.0.9`.
14. Deterministic CP3 replay bridge landed for anti-abuse evidence on manual-constrained sessions:
: `window.obscurM7AntiAbuseReplay.runPeerCooldownReplay({ clearAppEvents: true })` in
: `apps/pwa/app/shared/m7-anti-abuse-replay-bridge.ts`,
: installed at app boot in `apps/pwa/app/components/providers.tsx`,
: with replay matrix doc in `docs/28-v1.0.9-cp3-anti-abuse-replay-matrix.md`.
15. Remaining before declaring CP1+CP2 complete:
: capture and attach anti-abuse replay evidence bundle using
: `copy(window.obscurM7AntiAbuseReplay?.runPeerCooldownReplayCaptureJson({ clearAppEvents: true }))`.

## M8 - Community Platform Completion and Lifecycle Resilience

Planned version window:
1. `v1.0.10 -> v1.1.0` (major-phase closeout at `v1.1.0`).

Scope:
1. complete community information architecture (channels/topics, pinned resources, governance/audit visibility),
2. harden membership portability across account-switch/restart/restore without creator/member drift,
3. ensure membership/sendability convergence when room-key, ledger, and hydrated state are temporarily inconsistent.

Acceptance:
1. account-switch/restart replay keeps community identity (name/member coverage/operator role) converged,
2. sendability and membership outcomes remain reason-coded and recoverable via canonical paths,
3. community disband behavior is deterministic when membership reaches zero and remains reversible only through explicit join/invite paths.

## M9 - Secure Voice Communication Rollout

Planned version window:
1. `v1.1.1 -> v1.2.0` (major-phase closeout at `v1.2.0`).

Scope:
1. expand bounded real-time voice from beta slice to stable small-room/operator-ready workflows,
2. keep explicit capability/degraded/unsupported outcomes across desktop/web/mobile surfaces,
3. converge async voice notes, realtime voice state, and deletion/privacy controls into one deterministic transport contract.

Acceptance:
1. weak-network replay remains interactive without optimistic success claims,
2. voice session state transitions are diagnostics-backed and recoverable without cross-owner drift,
3. end-to-end delete behavior converges for text/media/voice artifacts across two-device replay.

## M10 - Anti-Abuse Intelligence and Trust Controls

Planned version window:
1. `v1.2.1 -> v1.3.0` (major-phase closeout at `v1.3.0`).

Scope:
1. extend local-first anti-abuse with optional signed shared-intel and relay risk signals,
2. add attack-mode safety profile controls with explicit user/operator visibility and rollback paths,
3. finish UX/performance hardening for high-load community/chat sessions under degraded relay conditions.

Acceptance:
1. anti-abuse outcomes stay reason-coded, explainable, and reversible by user policy,
2. no plaintext-content scanning or centralized moderation path is introduced,
3. long-session soak replay shows no route-freeze/blank-page regression class in release evidence.

Current execution status (started 2026-03-25):
1. CP1 shared-intel/relay-risk contracts landed on canonical messaging anti-abuse owner path:
: `apps/pwa/app/features/messaging/services/m10-shared-intel-policy.ts`.
2. Contract boundaries now enforce strict no-plaintext-scanning inputs:
: any payload metadata containing plaintext-like keys is treated as an explicit contract violation with reason-coded outcome.
3. Local-first attack-mode safety profile toggles are available with deterministic policy gates:
: `standard|strict` profile evaluation plus explicit reason codes for allow/block decisions.
4. Canonical incoming request anti-abuse owner now consumes CP1 policy outcomes:
: `apps/pwa/app/features/messaging/services/incoming-request-anti-abuse.ts`,
: including reason-coded strict-mode quarantines for relay high-risk and signed peer blocks.
5. Requests Inbox anti-spam summary + badges now include CP1 strict-mode quarantine reason codes:
: `apps/pwa/app/features/messaging/services/incoming-request-quarantine-summary.ts`,
: `apps/pwa/app/features/messaging/components/requests-inbox-panel.tsx`.
6. Focused CP1 validation is green:
: `pnpm --dir apps/pwa exec vitest run app/features/messaging/services/m10-shared-intel-policy.test.ts app/features/messaging/services/incoming-request-anti-abuse.test.ts app/features/messaging/services/incoming-request-quarantine-summary.test.ts`,
: `pnpm --dir apps/pwa exec vitest run app/features/messaging/controllers/incoming-dm-event-handler.test.ts`,
: `pnpm --dir apps/pwa exec tsc --noEmit --pretty false`.
7. CP1 shared-intel state is now profile-scoped and persistent:
: signed signals are normalized + stored at scoped key
: `obscur.messaging.shared_intel_signals.v1::profile`
: and rehydrated by the canonical M10 policy owner.
8. CP1 attack-mode profile now converges on canonical privacy settings owner:
: `attackModeSafetyProfileV121` is persisted through
: `PrivacySettingsService` instead of a separate ad-hoc storage owner.
9. CP1 operator replay bridge is available for manual evidence capture:
: `window.obscurM10TrustControls` (`snapshot`, `captureJson`, strict-mode toggle, signal replace/clear),
: installed at app boot via `app/components/providers.tsx`.
10. CP1 signed-intel ingest/export contract landed with deterministic evidence counters:
: `ingestSignedSharedIntelSignals(...)` returns typed rejection reasons
: (`invalid_shape`, `expired`, `missing_signature_verifier`, `invalid_signature`),
: and bridge JSON import/export is available via
: `window.obscurM10TrustControls.ingestSignedSharedIntelSignalsJson(...)` and
: `window.obscurM10TrustControls.exportSignedSharedIntelSignalsJson()`.
11. CP1 trust controls now have a user/operator settings surface in:
: `apps/pwa/app/features/settings/components/auto-lock-settings-panel.tsx`
: with canonical strict/standard profile toggle + signed-intel JSON import/export editor,
: including deterministic ingest result summaries and explicit signature/replace import options.
12. Focused CP1 trust-controls UI validation is green:
: `pnpm --dir apps/pwa exec vitest run app/features/settings/components/auto-lock-settings-panel.test.tsx`.
13. `v1.2.1` tag is now published and `v1.2.2` (`M10` `CP2`) implementation has started.
14. CP2 trust-controls UX clarity slice landed:
: reversible import/clear controls (`Undo Last Change`) and compact trust snapshot counters in
: `apps/pwa/app/features/settings/components/auto-lock-settings-panel.tsx`.
15. CP2 diagnostics tooling slice landed:
: trust-control actions emit canonical diagnostics events and
: `apps/pwa/app/shared/m10-trust-controls-bridge.ts` capture now includes
: `recentTrustControlEvents` for operator replay evidence packets.
16. Focused CP2 trust-controls validation is green:
: `pnpm --dir apps/pwa exec vitest run app/features/settings/components/auto-lock-settings-panel.test.tsx app/shared/m10-trust-controls-bridge.test.ts app/features/messaging/services/m10-shared-intel-policy.test.ts`,
: `pnpm --dir apps/pwa exec tsc --noEmit --pretty false`.
17. CP2 responsiveness diagnostics slice landed on canonical app-event owner:
: `apps/pwa/app/shared/log-app-event.ts` now exposes `summary.uiResponsiveness`
: for route/page-transition/startup degradation triage without adding new runtime owners.
18. CP2 trust-controls capture now includes responsiveness evidence:
: `recentResponsivenessEvents` in `apps/pwa/app/shared/m10-trust-controls-bridge.ts`
: for one-packet anti-abuse + performance handoff.
19. Focused CP2 responsiveness validation is green:
: `pnpm --dir apps/pwa exec vitest run app/shared/log-app-event.test.ts app/shared/m10-trust-controls-bridge.test.ts`,
: `pnpm --dir apps/pwa exec tsc --noEmit --pretty false`.
20. CP2 deterministic triage helper APIs landed on M10 bridge for operator speed:
: `window.obscurM10TrustControls.runCp2TriageCapture(...)`
: and `window.obscurM10TrustControls.runCp2TriageCaptureJson(...)`
: with explicit `cp2TriageGate` pass/fail checks over digest-backed anti-abuse + responsiveness signals.
21. CP2 responsiveness hardening landed on canonical app-shell owner:
: route-mount performance guard disables transition effects after consecutive slow settles
: in `apps/pwa/app/components/app-shell.tsx` (fail-open, evidence-first behavior).
22. Route-mount diagnostics now track consecutive-slow posture in
: `apps/pwa/app/components/page-transition-recovery.ts`
: via `consecutiveSlowSampleCount` and `ROUTE_MOUNT_SLOW_DISABLE_THRESHOLD`.
23. CP2 responsiveness digest now includes
: `routeMountPerformanceGuardEnabledCount` in `summary.uiResponsiveness`
: for high-load route-freeze triage.
24. CP2 stability-gate probe helpers landed on canonical M10 bridge owner:
: `window.obscurM10TrustControls.runCp2StabilityGateProbe(...)`
: and `window.obscurM10TrustControls.runCp2StabilityGateProbeJson(...)`,
: reusing canonical triage capture and emitting one explicit gate verdict event.
25. Canonical CP2 gate verdict diagnostics event is now compacted in digest events:
: `messaging.m10.cp2_stability_gate` in
: `apps/pwa/app/shared/log-app-event.ts`.
26. Cross-device digest now exposes CP2 gate posture under
: `summary.m10TrustControls` (`cp2StabilityGateCount`, pass/fail counters,
: unexpected-fail counter, latest expected-stable/pass/failed-check sample).
27. CP3 readiness helper APIs landed on canonical M10 bridge owner:
: `window.obscurM10TrustControls.runCp3ReadinessCapture(...)`,
: `window.obscurM10TrustControls.runCp3ReadinessCaptureJson(...)`,
: `window.obscurM10TrustControls.runCp3ReadinessGateProbe(...)`,
: `window.obscurM10TrustControls.runCp3ReadinessGateProbeJson(...)`.
28. Canonical CP3 readiness diagnostics event now emits from the same owner path:
: `messaging.m10.cp3_readiness_gate`.
29. Cross-device digest now includes CP3 readiness posture under `summary.m10TrustControls`:
: `cp3ReadinessGateCount`, pass/fail/unexpected-fail counters,
: latest CP3 expected-stable/pass/failed-check sample.
30. CP3 suite helper APIs landed on canonical M10 bridge owner:
: `window.obscurM10TrustControls.runCp3SuiteCapture(...)`,
: `window.obscurM10TrustControls.runCp3SuiteCaptureJson(...)`,
: `window.obscurM10TrustControls.runCp3SuiteGateProbe(...)`,
: `window.obscurM10TrustControls.runCp3SuiteGateProbeJson(...)`.
31. Canonical CP3 suite diagnostics event now emits from the same owner path:
: `messaging.m10.cp3_suite_gate`.
32. Cross-device digest now includes CP3 suite posture under `summary.m10TrustControls`:
: `cp3SuiteGateCount`, pass/fail/unexpected-fail counters,
: latest CP3 suite expected-stable/pass/failed-check sample.
33. CP4 closeout helper APIs landed on canonical M10 bridge owner:
: `window.obscurM10TrustControls.runCp4CloseoutCapture(...)`,
: `window.obscurM10TrustControls.runCp4CloseoutCaptureJson(...)`,
: `window.obscurM10TrustControls.runCp4CloseoutGateProbe(...)`,
: `window.obscurM10TrustControls.runCp4CloseoutGateProbeJson(...)`.
34. Canonical CP4 closeout diagnostics event now emits from the same owner path:
: `messaging.m10.cp4_closeout_gate`.
35. Cross-device digest now includes CP4 closeout posture under `summary.m10TrustControls`:
: `cp4CloseoutGateCount`, pass/fail/unexpected-fail counters,
: latest CP4 closeout expected-stable/pass/failed-check sample.
36. v1.3 aggregate closeout helper APIs landed on canonical M10 bridge owner:
: `window.obscurM10TrustControls.runV130CloseoutCapture(...)`,
: `window.obscurM10TrustControls.runV130CloseoutCaptureJson(...)`,
: `window.obscurM10TrustControls.runV130CloseoutGateProbe(...)`,
: `window.obscurM10TrustControls.runV130CloseoutGateProbeJson(...)`.
37. Canonical v1.3 aggregate closeout diagnostics event now emits from the same owner path:
: `messaging.m10.v130_closeout_gate`.
38. Cross-device digest now includes v1.3 aggregate closeout posture under `summary.m10TrustControls`:
: `v130CloseoutGateCount`, pass/fail/unexpected-fail counters,
: latest v1.3 closeout expected-stable/pass/failed-check sample.
39. v1.3 evidence helper APIs landed on canonical M10 bridge owner:
: `window.obscurM10TrustControls.runV130EvidenceCapture(...)`,
: `window.obscurM10TrustControls.runV130EvidenceCaptureJson(...)`,
: `window.obscurM10TrustControls.runV130EvidenceGateProbe(...)`,
: `window.obscurM10TrustControls.runV130EvidenceGateProbeJson(...)`.
40. Canonical v1.3 evidence diagnostics event now emits from the same owner path:
: `messaging.m10.v130_evidence_gate`.
41. Cross-device digest now includes v1.3 evidence posture under `summary.m10TrustControls`:
: `v130EvidenceGateCount`, pass/fail/unexpected-fail counters,
: latest v1.3 evidence expected-stable/pass/failed-check sample.
42. `v1.2.4` demo-asset execution matrix is now documented:
: `docs/34-v1.2.4-m10-demo-asset-matrix.md`,
: with required CP3/CP4/v130 pass-lane captures and digest/event bundle output rules.

## Version-Bound Execution

1. Completed one-milestone-per-version sequence:
: `v1.0.4` -> `M2` closeout,
: `v1.0.5` -> `M3`,
: `v1.0.6` -> `M4`.
2. Completed one-milestone-per-version sequence:
: `v1.0.7` -> `M5`,
: `v1.0.8` -> `M6`,
: `v1.0.9` -> `M7` (CP3 evidence attachment pending final closeout).
3. Planned major-phase release sequence:
: `v1.0.10`, `v1.0.11`, `v1.1.0` -> `M8`,
: `v1.1.1`, `v1.1.2`, `v1.2.0` -> `M9`,
: `v1.2.1`, `v1.2.2`, `v1.3.0` -> `M10`.
4. Detailed checkpoints and release gates for the completed sequence are defined in:
: `docs/23-versioned-phase-plan-v1.0.4-v1.0.6.md`.
5. Detailed checkpoints and release gates for the active sequence are defined in:
: `docs/25-versioned-phase-plan-v1.0.7-v1.0.9.md`.
6. Detailed checkpoints and release gates for the planned major-phase sequence are defined in:
: `docs/29-versioned-major-phase-plan-v1.0.10-v1.3.0.md`.
7. Active execution lane for current major phase (`v1.1.2-v1.2.0`) is defined in:
: `docs/29-versioned-major-phase-plan-v1.0.10-v1.3.0.md`.
8. Historical major-phase-start lane (`v1.0.10-v1.1.0`) remains documented in:
: `docs/30-versioned-phase-plan-v1.0.10-v1.1.0.md`.
9. `M8` closeout is complete and released as `v1.1.0` with accepted CP3 replay gate verdict evidence.
10. `M9` (`v1.1.1` CP1) is now started with voice session lifecycle hardening:
: explicit remote-close canonical transition in
: `apps/pwa/app/features/messaging/services/realtime-voice-session-lifecycle.ts`.
11. `M9` (`v1.1.1` CP1) active-session peer-evidence convergence hardening is now landed:
: `markRealtimeVoiceSessionConnected(...)` accepts `active` refresh updates and degrades to
: `peer_evidence_missing` when peer evidence drops, preserving deterministic phase ownership in
: `apps/pwa/app/features/messaging/services/realtime-voice-session-lifecycle.ts`.
12. `M9` (`v1.1.1` CP1) terminal callback race hardening is now landed:
: delayed local/remote close-leave callback ordering now preserves terminal outcome because
: `markRealtimeVoiceSessionClosed(...)` and `markRealtimeVoiceSessionLeft(...)` treat `ended`
: as idempotent in `apps/pwa/app/features/messaging/services/realtime-voice-session-lifecycle.ts`.
13. `M9` (`v1.1.1` CP1) canonical owner convergence slice is now landed:
: added `apps/pwa/app/features/messaging/services/realtime-voice-session-owner.ts` to centralize
: lifecycle + diagnostics transition ownership and reject stale event-time updates, and
: `apps/pwa/app/shared/m6-voice-replay-bridge.ts` now exercises this owner path.
14. `M9` (`v1.1.1` CP1) stale-event handling is now diagnosable in one-copy bundles:
: canonical owner emits `messaging.realtime_voice.session_event_ignored` for dropped stale events,
: and compact digest capture includes this event for replay exports.
15. `M9` (`v1.1.2` CP2) diagnostics/capture extension is now started:
: digest summary now exposes realtime voice stale-ignore counters (`staleEventIgnoredCount`,
: `latestIgnoredReasonCode`) and M6/M0 capture helpers now include
: `messaging.realtime_voice.session_event_ignored` evidence in one-copy bundles.

## Non-Negotiable Validation Contract

Every milestone closeout must include:
1. focused automated tests for touched owners,
2. manual two-device reasoning for identity/messaging/community changes,
3. diagnostics exports for anomalies before any architectural changes,
4. docs updates (`CHANGELOG.md`, `ISSUES.md`, and impacted `/docs` files).
