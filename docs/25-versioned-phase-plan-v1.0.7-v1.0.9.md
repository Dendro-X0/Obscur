# 25 Versioned Phase Plan (v1.0.7-v1.0.9)

_Last reviewed: 2026-03-23 (baseline commit 4c869a7)._

This document locks the next version-bound execution cadence after `v1.0.6`:
1. one milestone per version,
2. explicit checkpoint commits inside each milestone,
3. no release until checkpoint evidence is complete.

## Version-Milestone Mapping

1. `v1.0.7` -> `M5` community lifecycle convergence + governance reliability.
2. `v1.0.8` -> `M6` real-time voice beta slice (small-room path, evidence-backed).
3. `v1.0.9` -> `M7` anti-abuse intelligence + UX/performance reliability hardening.

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

## v1.0.7 - M5 Community Lifecycle Convergence

Goal:
1. prevent community state drift (name/member/sendability) across account switches, restart, and restore replay.

Scope:
1. canonical community metadata convergence under restore + live relay replay,
2. membership/sendability convergence when room-key and ledger evidence diverge,
3. governance reliability guardrails (creator/operator lifecycle without hidden fallback state).

Checkpoints:
1. `CP1`: land deterministic convergence slice for membership + metadata reconciliation.
2. `CP2`: expose reason-coded diagnostics in digest surfaces for convergence outcomes.
3. `CP3`: manual two-device account-switch replay evidence:
: community name continuity,
: member-list continuity,
: sendability continuity after restore/restart.
4. `CP4`: release gate replay:
: `pnpm version:check`
: `pnpm docs:check`
: focused `vitest` suites for touched owners
: `pnpm --dir apps/pwa exec tsc --noEmit --pretty false`
: `pnpm release:test-pack -- --skip-preflight`
: `pnpm release:preflight -- --tag v1.0.7`

Current checkpoint progress (2026-03-23):
1. `CP1` started:
: docs-first kickoff complete with version/milestone lock.
2. `CP1` implementation slice landed on canonical community membership recovery owner:
: `apps/pwa/app/features/groups/services/community-membership-recovery.ts`
: merge logic now preserves richer metadata/member coverage when persisted duplicates or placeholder regressions are replayed.
3. Joined-ledger merge now backfills local member coverage and prevents placeholder display-name drift:
: persisted `Private Group` fallback names are replaced by richer joined-ledger display names when available,
: joined ledger evidence now ensures the active account pubkey is present in recovered member coverage.
4. Recovery diagnostics now expose CP1 convergence evidence:
: `persistedDuplicateMergeCount`,
: `placeholderDisplayNameRecoveredCount`,
: `localMemberBackfillCount`.
5. Focused CP1 validation replay is green:
: `pnpm --dir apps/pwa exec vitest run app/features/groups/services/community-membership-recovery.test.ts app/features/groups/providers/group-provider.test.tsx app/features/groups/providers/group-provider.cross-device-membership.integration.test.tsx`
: `pnpm --dir apps/pwa exec tsc --noEmit --pretty false`.
6. `CP2` diagnostics slice started and landed for convergence triage:
: `apps/pwa/app/shared/log-app-event.ts` now includes `summary.communityLifecycleConvergence` in `getCrossDeviceSyncDigest`.
7. CP2 digest and M0 triage coverage are green:
: `pnpm --dir apps/pwa exec vitest run app/shared/log-app-event.test.ts app/shared/m0-triage-capture.test.ts`
: `pnpm --dir apps/pwa exec tsc --noEmit --pretty false`.
8. `CP3` manual replay matrix is documented:
: `docs/26-v1.0.7-cp3-community-convergence-matrix.md`.
9. CP3 status:
: operator two-device/account-switch replay evidence was captured and accepted against the matrix criteria in
: `docs/26-v1.0.7-cp3-community-convergence-matrix.md`.
10. `CP4` release-gate replay is green in this checkpoint workspace (2026-03-23):
: `pnpm --dir apps/pwa exec vitest run app/features/groups/services/community-membership-recovery.test.ts app/features/groups/providers/group-provider.test.tsx app/features/groups/providers/group-provider.cross-device-membership.integration.test.tsx app/shared/log-app-event.test.ts app/shared/m0-triage-capture.test.ts`
: `pnpm --dir apps/pwa exec tsc --noEmit --pretty false`
: `pnpm version:check`
: `pnpm docs:check`
: `pnpm release:integrity-check`
: `pnpm release:artifact-version-contract-check`
: `pnpm release:ci-signal-check`
: `pnpm release:test-pack -- --skip-preflight`
: `pnpm release:preflight -- --tag v1.0.7 --allow-dirty true`
11. `v1.0.7` release handoff is complete:
: strict clean-tree `pnpm release:preflight -- --tag v1.0.7` passed before push/tag,
: `main` and `v1.0.7` are both published on origin.

## v1.0.8 - M6 Real-Time Voice Beta Slice

Goal:
1. deliver a bounded small-room real-time voice beta path with explicit capability/degraded-state contracts.

Scope:
1. session lifecycle contracts (create/join/leave/recover),
2. capability and network degradation handling with explicit outcomes,
3. voice transport diagnostics for reproducible weak-network triage.

Checkpoints:
1. `CP1`: session-capability and lifecycle contracts with focused tests.
2. `CP2`: diagnostics/digest exposure for degraded and unsupported paths.
3. `CP3`: weak-network manual replay evidence for join/leave/recover flow.
4. `CP4`: full release gates and `v1.0.8` tag.

Current checkpoint progress:
1. `CP1` started on canonical small-room voice lifecycle contracts:
: added typed session lifecycle owner-safe contracts in
: `apps/pwa/app/features/messaging/services/realtime-voice-session-lifecycle.ts`.
2. Lifecycle contracts now enforce deterministic phase transitions for:
: `create/join -> connecting`,
: `connected -> active` only with peer-session evidence,
: degraded transport + bounded recovery attempts,
: explicit leave/closed terminal transitions.
3. Unsupported/degraded outcomes are reason-coded at the contract boundary:
: capability unsupported reason propagation,
: `opus_codec_missing`,
: `network_degraded`,
: `transport_timeout`,
: `peer_evidence_missing`,
: `recovery_exhausted`.
4. Focused `CP1` validation replay is green:
: `pnpm --dir apps/pwa exec vitest run app/features/messaging/services/realtime-voice-session-lifecycle.test.ts`
: `pnpm --dir apps/pwa exec tsc --noEmit --pretty false`.
5. `CP2` diagnostics slice landed for realtime voice degraded/unsupported triage:
: added canonical transition diagnostics emitter in
: `apps/pwa/app/features/messaging/services/realtime-voice-session-diagnostics.ts`,
: emitting `messaging.realtime_voice.session_transition` with reason-coded phase context.
6. Cross-device digest now includes `summary.realtimeVoiceSession`:
: transition/degraded/unsupported/recovery-exhausted counters with risk-level contracts in
: `apps/pwa/app/shared/log-app-event.ts`.
7. M0 capture now includes realtime voice focus events:
: `messaging.realtime_voice.session_transition` in
: `apps/pwa/app/shared/m0-triage-capture.ts`.
8. Focused `CP2` validation replay is green:
: `pnpm --dir apps/pwa exec vitest run app/features/messaging/services/realtime-voice-session-lifecycle.test.ts app/features/messaging/services/realtime-voice-session-diagnostics.test.ts app/shared/log-app-event.test.ts app/shared/m0-triage-capture.test.ts`
: `pnpm --dir apps/pwa exec tsc --noEmit --pretty false`.
9. `CP3` prep helper landed for one-copy weak-network replay bundles:
: `window.obscurM6VoiceCapture.captureJson(400)` in
: `apps/pwa/app/shared/m6-voice-capture.ts`,
: installed at boot in `apps/pwa/app/components/providers.tsx`.
10. Focused CP3 helper validation is green:
: `pnpm --dir apps/pwa exec vitest run app/shared/m6-voice-capture.test.ts`
: `pnpm --dir apps/pwa exec tsc --noEmit --pretty false`.
11. Replay bridge landed for deterministic transition evidence on builds without exposed voice UI:
: `window.obscurM6VoiceReplay.runWeakNetworkReplay()` in
: `apps/pwa/app/shared/m6-voice-replay-bridge.ts`,
: installed at boot in `apps/pwa/app/components/providers.tsx`.
12. `CP3` manual weak-network replay matrix is documented:
: `docs/27-v1.0.8-cp3-voice-replay-matrix.md`.
13. CP3 status:
: operator weak-network replay evidence was captured and accepted (2026-03-23) via:
: `window.obscurM6VoiceReplay.runWeakNetworkReplay()`
: followed by `window.obscurM6VoiceCapture.captureJson(400)`.
: observed transition chain:
: `idle -> connecting -> active -> degraded -> connecting -> active`,
: with no `recovery_exhausted` or unsupported terminal failure in replay window.
14. CP4 status:
: strict clean-tree release preflight passed and release handoff is complete:
: `pnpm release:preflight -- --tag v1.0.8`
: `main` and tag `v1.0.8` are published on origin.

## v1.0.9 - M7 Anti-Abuse + UX/Performance Reliability Hardening

Goal:
1. increase user protection and runtime responsiveness without centralized moderation or architectural churn.

Scope:
1. privacy-preserving anti-abuse decision quality and operator/user clarity,
2. route/startup/chat responsiveness hardening under large histories and media-heavy sessions,
3. regression burn-down from `v1.0.7` + `v1.0.8` rollout evidence.

Checkpoints:
1. `CP1`: anti-abuse and responsiveness high-risk fixes with focused tests.
2. `CP2`: diagnostics and triage surfaces for each resolved incident class.
3. `CP3`: long-session/two-device soak evidence bundle.
4. `CP4`: strict clean-tree preflight and `v1.0.9` release tag.

Current checkpoint progress:
1. `CP1` implementation slice started on canonical incoming-request anti-abuse owner:
: `apps/pwa/app/features/messaging/services/incoming-request-anti-abuse.ts`.
2. Per-peer cooldown hardening landed after burst-limit quarantine:
: new reason code `peer_cooldown_active` prevents repeated rapid retries from the same sender after `peer_rate_limited` is reached.
3. Quarantine diagnostics and UI surfaces are updated for cooldown visibility:
: `apps/pwa/app/features/messaging/controllers/incoming-dm-event-handler.ts`,
: `apps/pwa/app/features/messaging/services/incoming-request-quarantine-summary.ts`,
: `apps/pwa/app/features/messaging/components/requests-inbox-panel.tsx`.
4. Focused CP1 validation is green:
: `pnpm --dir apps/pwa exec vitest run app/features/messaging/services/incoming-request-anti-abuse.test.ts app/features/messaging/services/incoming-request-quarantine-summary.test.ts`
: `pnpm --dir apps/pwa exec tsc --noEmit --pretty false`.
5. `CP2` diagnostics slice landed for anti-abuse triage surfaces:
: `getCrossDeviceSyncDigest` now includes `summary.incomingRequestAntiAbuse` and compact event slices for
: `messaging.request.incoming_quarantined` in
: `apps/pwa/app/shared/log-app-event.ts`.
6. M0 triage sync/restore focus now includes incoming request quarantine evidence:
: `apps/pwa/app/shared/m0-triage-capture.ts`.
7. Maintainer replay runbook now includes anti-abuse digest checks:
: `docs/08-maintainer-playbook.md`.
8. `CP3` prep helper landed for one-copy anti-abuse evidence bundles:
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
14. Remaining before declaring CP1+CP2 complete:
: capture two-device anti-abuse replay evidence (rate-limit -> cooldown -> digest summary) and attach diagnostics bundle.

## Working Rules During This Sequence

1. No parallel lifecycle owners for runtime/sync/identity/transport.
2. No release claim without diagnostics + manual replay evidence.
3. Fix by subtraction where overlap paths cause ambiguity.
4. Keep each checkpoint commit reviewable and bounded.
