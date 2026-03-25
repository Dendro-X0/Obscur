# 29 Versioned Major-Phase Plan (v1.0.10-v1.3.0)

_Last reviewed: 2026-03-24 (baseline commit 4c869a7)._

This document defines the remaining post-`v1.0.9` release sequence as three major phases:
1. one major phase completed before `v1.1.0`,
2. one major phase completed before `v1.2.0`,
3. one major phase completed before `v1.3.0`.

Tags such as `v1.0.10`, `v1.1.1`, and `v1.2.2` are milestone carriers inside these major phases.

## Entry Gate Before Starting v1.0.10

1. Close pending `M7` CP3 evidence attachment:
: run `copy(window.obscurM7AntiAbuseReplay?.runPeerCooldownReplayCaptureJson({ clearAppEvents: true }))`
: and attach output in roadmap/issue evidence notes.
2. Re-run strict docs/version/release preflight on clean `main`:
: `pnpm version:check`
: `pnpm docs:check`
: `pnpm release:preflight -- --tag v1.0.10`.

## Major-Phase Mapping

1. `Phase A` (`M8`) `v1.0.10 -> v1.1.0`:
: community platform completion + lifecycle resilience.
2. `Phase B` (`M9`) `v1.1.1 -> v1.2.0`:
: secure voice communication rollout.
3. `Phase C` (`M10`) `v1.2.1 -> v1.3.0`:
: anti-abuse intelligence + trust controls.

## Checkpoint Policy (All Versions)

For every version tag in this sequence:
1. `CP1` implementation checkpoint:
: bounded owner-safe feature slice + focused tests.
2. `CP2` diagnostics checkpoint:
: app-event and digest/triage visibility for new decision paths.
3. `CP3` runtime evidence checkpoint:
: manual two-device replay bundle captured and attached.
4. `CP4` release checkpoint:
: strict clean-tree release preflight and tag publish.

## Phase A Detail - M8 (v1.0.10 -> v1.1.0)

Goal:
1. make communities sustainable under account-switch/restart/recover flows while expanding operator/community UX.

### v1.0.10 (M8-CP1)

Scope:
1. canonical community identity convergence (name, member/admin coverage, operator role),
2. deterministic join/sendability reconciliation when room-key and ledger evidence diverge,
3. community info navigation/management contracts without duplicated owners.

Evidence:
1. focused tests for touched group/membership owners,
2. typecheck and diagnostics contract tests.

### v1.0.11 (M8-CP2)

Scope:
1. expand diagnostics and replay helpers for community lifecycle anomalies,
2. add explicit reason-coded outcomes for disband/leave/join repair transitions,
3. update maintainer matrix for two-device account-switch replay.

Evidence:
1. digest summary counters and capture helpers exposed,
2. runbook + matrix docs updated with concrete replay steps.

### v1.1.0 (M8-CP3/CP4 closeout)

Scope:
1. execute full manual matrix and attach evidence bundle,
2. burn down regressions discovered in CP3 replay,
3. publish stable `v1.1.0` milestone.

Mandatory release gates:
1. `pnpm version:check`
2. `pnpm docs:check`
3. focused `vitest` suites for touched owners
4. `pnpm --dir apps/pwa exec tsc --noEmit --pretty false`
5. `pnpm release:test-pack -- --skip-preflight`
6. `pnpm release:preflight -- --tag v1.1.0`

## Phase B Detail - M9 (v1.1.1 -> v1.2.0)

Goal:
1. move secure voice from bounded beta slices to stable operator-ready behavior.

### v1.1.1 (M9-CP1)

Scope:
1. real-time voice lifecycle hardening for small-room join/recover/leave reliability,
2. clear unsupported/degraded outcomes across runtime capability combinations,
3. preserve existing DM/group transport invariants while voice paths are active.

Evidence:
1. focused voice lifecycle tests and typed contract validation,
2. no optimistic-success path without peer/session evidence.

Current checkpoint progress (2026-03-23):
1. `M9` CP1 started with deterministic remote-close handling in canonical voice lifecycle owner:
: `apps/pwa/app/features/messaging/services/realtime-voice-session-lifecycle.ts`.
2. Added explicit session-closure transition:
: `markRealtimeVoiceSessionClosed(state, { nowUnixMs })`
: to end sessions from `connecting|active|degraded|leaving` with reason `session_closed`.
3. The new transition prevents stuck interactive voice state when peer-side close arrives before local leave completion.
4. Added active-session evidence convergence hardening on the same canonical lifecycle owner:
: `markRealtimeVoiceSessionConnected(...)` now accepts `active` updates so peer-evidence refreshes remain deterministic (no `invalid_transition` drift), and active sessions degrade with `peer_evidence_missing` when peer evidence drops.
5. Added terminal race-order hardening for delayed close/leave callbacks:
: `markRealtimeVoiceSessionClosed(...)` and `markRealtimeVoiceSessionLeft(...)` now treat `ended` as idempotent terminal state, preserving first terminal reason under async callback reordering.
6. Added canonical realtime voice session owner path for CP1 lifecycle convergence:
: new owner in `apps/pwa/app/features/messaging/services/realtime-voice-session-owner.ts` centralizes lifecycle + diagnostics emission and ignores stale transition events by event timestamp.
7. Deterministic replay bridge now consumes owner APIs (single canonical transition path):
: `apps/pwa/app/shared/m6-voice-replay-bridge.ts`.
8. Ignored stale-event observability is now explicit for CP1 triage:
: owner emits `messaging.realtime_voice.session_event_ignored` with reason + event/transition timestamps; compact digest captures this event for one-copy export.
9. Focused CP1 lifecycle diagnostics coverage is green:
: `pnpm --dir apps/pwa exec vitest run app/features/messaging/services/realtime-voice-session-lifecycle.test.ts app/features/messaging/services/realtime-voice-session-diagnostics.test.ts`
: `pnpm --dir apps/pwa exec vitest run app/features/messaging/services/realtime-voice-session-owner.test.ts app/shared/m6-voice-replay-bridge.test.ts`
: `pnpm --dir apps/pwa exec vitest run app/features/messaging/services/realtime-voice-session-owner.test.ts app/shared/log-app-event.test.ts`
: `pnpm --dir apps/pwa exec tsc --noEmit --pretty false`.

### v1.1.2 (M9-CP2)

Scope:
1. unify diagnostics for async voice notes + real-time session transitions + delete convergence,
2. improve replay capture helpers for weak-network and account-switch voice sessions,
3. update maintainers' triage and replay matrix documentation.

Evidence:
1. digest summary coverage for voice risk counters,
2. capture helper outputs accepted in manual replay dry-run.

Current checkpoint progress (2026-03-24):
1. `M9` CP2 diagnostics slice started on canonical digest/capture owners:
: cross-device digest `summary.realtimeVoiceSession` now includes
: `staleEventIgnoredCount` and `latestIgnoredReasonCode` from
: `apps/pwa/app/shared/log-app-event.ts`.
2. M6 voice capture contract now includes ignored-event replay evidence:
: `voice.ignoredEvents` plus expanded summary fields in
: `apps/pwa/app/shared/m6-voice-capture.ts`.
3. M0 focused triage capture now includes ignored realtime voice event probes:
: `messaging.realtime_voice.session_event_ignored` in
: `apps/pwa/app/shared/m0-triage-capture.ts`.
4. Deterministic weak-network replay helper now provides one-copy CP2 replay evidence export:
: `window.obscurM6VoiceReplay.runWeakNetworkReplayCapture(...)`
: and `runWeakNetworkReplayCaptureJson(...)` in
: `apps/pwa/app/shared/m6-voice-replay-bridge.ts`,
: including a typed CP2 evidence gate verdict (`cp2EvidenceGate.pass/failedChecks`) for manual replay dry-runs.
5. Deterministic account-switch replay helper now provides one-copy CP2 replay evidence export:
: `window.obscurM6VoiceReplay.runAccountSwitchReplayCapture(...)`
: and `runAccountSwitchReplayCaptureJson(...)` in
: `apps/pwa/app/shared/m6-voice-replay-bridge.ts`,
: including multi-room switch evidence counters (`roomHintCount`, `endedTransitionCount`) and scenario-aware CP2 gate verdict checks.
6. Unified async voice-note + delete-convergence diagnostics now share the canonical CP2 evidence surface:
: cross-device digest now includes `summary.asyncVoiceNote` and `summary.deleteConvergence` in
: `apps/pwa/app/shared/log-app-event.ts`,
: delete-for-everyone canonical owner now emits reason-coded convergence outcomes in
: `apps/pwa/app/features/main-shell/hooks/use-chat-actions.ts`,
: and M6 capture exports one-copy summary + event slices for these domains in
: `apps/pwa/app/shared/m6-voice-capture.ts`.
7. Focused CP2 diagnostics/capture validation is green:
: `pnpm --dir apps/pwa exec vitest run app/shared/log-app-event.test.ts app/shared/m6-voice-capture.test.ts app/shared/m0-triage-capture.test.ts`
: `pnpm --dir apps/pwa exec vitest run app/shared/m6-voice-replay-bridge.test.ts app/shared/m6-voice-capture.test.ts app/shared/log-app-event.test.ts app/shared/m0-triage-capture.test.ts`
: `pnpm --dir apps/pwa exec vitest run app/shared/log-app-event.test.ts app/shared/m6-voice-capture.test.ts app/shared/m0-triage-capture.test.ts app/shared/m6-voice-replay-bridge.test.ts app/features/main-shell/hooks/use-chat-actions.delete-targets.test.ts`
: `pnpm --dir apps/pwa exec tsc --noEmit --pretty false`.
8. Post-`v1.1.2` CP3 replay-suite prep helper is now available for one-copy evidence export:
: `window.obscurM6VoiceReplay.runCp3ReplaySuiteCapture(...)`
: and `runCp3ReplaySuiteCaptureJson(...)` in
: `apps/pwa/app/shared/m6-voice-replay-bridge.ts`,
: combining weak-network + account-switch replay gates into one `suiteGate` verdict.

### v1.1.3 (M9-CP3)

Scope:
1. execute deterministic CP3 replay-suite evidence for weak-network + account-switch voice continuity,
2. validate unified async voice-note and delete-convergence diagnostics in the same replay window,
3. attach one-copy operator evidence bundle and burn down discovered regressions.

Evidence:
1. CP3 suite helper output accepted with pass verdict:
: `window.obscurM6VoiceReplay.runCp3ReplaySuiteCaptureJson(...)`,
2. replay matrix completion notes in:
: `docs/32-v1.1.3-cp3-voice-suite-matrix.md`.

Current checkpoint progress (2026-03-24):
1. `v1.1.3` CP3 started with dedicated replay matrix/runbook:
: `docs/32-v1.1.3-cp3-voice-suite-matrix.md`.
2. CP3 operator evidence accepted using limited-account-safe self-test probe:
: `window.obscurM6VoiceReplay.runCp3SingleDeviceSelfTest(...)` and
: compact verification projection:
: `selfTestPass: true`,
: `selfTestFailedChecks: []`,
: `suitePass: true`,
: `weakPass: true`,
: `accountPass: true`,
: `unsupportedProbePass: true`,
: `recoveryExhaustedProbePass: true`.

### v1.1.4 (M9-CP4 prep)

Scope:
1. add deterministic long-session replay helper for CP4 readiness burn-down,
2. expose typed CP4 readiness gate verdict for sustained degrade/recover sessions,
3. validate deterministic failure-injection behavior (`recovery_exhausted`) without requiring large multi-account pools.

Evidence:
1. long-session helper bundle:
: `window.obscurM6VoiceReplay.runLongSessionReplayCaptureJson(...)`,
2. matrix/runbook notes:
: `docs/33-v1.1.4-cp4-voice-long-session-matrix.md`.

Current checkpoint progress (2026-03-24):
1. `v1.1.4` CP4-prep deterministic helper landed in canonical replay bridge owner:
: `runLongSessionReplay(...)`,
: `runLongSessionReplayCapture(...)`,
: `runLongSessionReplayCaptureJson(...)` in
: `apps/pwa/app/shared/m6-voice-replay-bridge.ts`.
2. CP4 compact self-test helper landed for limited-account verification:
: `runCp4LongSessionSelfTest(...)` and
: `runCp4LongSessionSelfTestJson(...)`,
: producing one-copy nominal-vs-failure gate verdict with explicit `failedChecks`.
3. CP4 readiness gate now emits explicit pass/fail checks for long-session risk posture:
: `cp4ReadinessGate.pass/failedChecks` with transition-volume, recovery-exhausted, and unified diagnostics checks.
4. Cross-device digest realtime voice summary now includes CP4 long-session gate counters and latest failure sample:
: `longSessionGateCount`, `longSessionGatePassCount`, `longSessionGateFailCount`, `unexpectedLongSessionGateFailCount`,
: `latestLongSessionGatePass`, and `latestLongSessionGateFailedCheckSample` in
: `apps/pwa/app/shared/log-app-event.ts`.
5. Focused long-session helper coverage is green:
: `pnpm --dir apps/pwa exec vitest run app/shared/log-app-event.test.ts app/shared/m6-voice-replay-bridge.test.ts app/shared/m6-voice-capture.test.ts`
: `pnpm --dir apps/pwa exec tsc --noEmit --pretty false`.

### v1.1.5 (M9-CP4 continuation)

Scope:
1. continue CP4 hardening with deterministic operator evidence surfaces for long-session replay convergence,
2. keep all changes on canonical digest/replay owners without adding parallel runtime paths,
3. maintain release-ready manifests/docs while progressing CP4 burn-down toward `v1.2.0`.

Current checkpoint progress (2026-03-24):
1. `v1.1.5` lane is opened on `main` with release-tracked versions aligned to `1.1.5`.
2. roadmap/changelog/issues are synchronized for CP4 continuation tracking.
3. deterministic CP4 gate-probe helper landed in canonical replay bridge owner:
: `runCp4LongSessionGateProbe(...)` and `runCp4LongSessionGateProbeJson(...)` in
: `apps/pwa/app/shared/m6-voice-replay-bridge.ts`.
4. stale bridge upgrade guard now requires CP4 gate-probe APIs so older runtime bridge objects are auto-refreshed before CP4 replay verification.
5. focused CP4 continuation validation is green:
: `pnpm --dir apps/pwa exec vitest run app/shared/m6-voice-replay-bridge.test.ts app/shared/m6-voice-capture.test.ts app/shared/log-app-event.test.ts`
: `pnpm --dir apps/pwa exec tsc --noEmit --pretty false`.
6. one-copy voice capture contract now includes CP4 long-session gate counters/latest gate sample from digest summary in:
: `apps/pwa/app/shared/m6-voice-capture.ts`.

### v1.1.6 (M9-CP4 continuation)

Scope:
1. compress CP4 verification into one deterministic one-copy export for limited-account operators,
2. keep CP4 replay tooling on canonical replay/digest owners,
3. preserve release-ready contracts while reducing manual probe drift.

Current checkpoint progress (2026-03-24):
1. deterministic CP4 checkpoint helper landed in canonical replay bridge owner:
: `runCp4CheckpointCapture(...)` and `runCp4CheckpointCaptureJson(...)` in
: `apps/pwa/app/shared/m6-voice-replay-bridge.ts`.
2. checkpoint bundle now includes:
: `longSession`, `gateProbe`, `selfTest`, `digestSummary`, and aggregate `cp4CheckpointGate`.
3. compact CP4 checkpoint gate-probe helper landed for one-call release verdicts:
: `runCp4CheckpointGateProbe(...)` and `runCp4CheckpointGateProbeJson(...)`.
4. stale bridge upgrade guard now requires CP4 checkpoint helper APIs (including checkpoint gate-probe methods) to prevent stale runtime bridge surfaces.
5. CP4 checkpoint diagnostics now converge on canonical digest/capture owners:
: `runCp4CheckpointCapture(...)` emits `messaging.realtime_voice.cp4_checkpoint_gate` and
: cross-device digest `summary.realtimeVoiceSession` now includes `checkpointGate*` counters plus latest checkpoint gate sample fields.
6. deterministic CP4 release-readiness helper lane landed to reduce manual probe drift:
: `runCp4ReleaseReadinessCapture(...)`, `runCp4ReleaseReadinessCaptureJson(...)`,
: `runCp4ReleaseReadinessGateProbe(...)`, and `runCp4ReleaseReadinessGateProbeJson(...)` in
: `apps/pwa/app/shared/m6-voice-replay-bridge.ts`.
7. stale replay-bridge upgrade guard now requires CP4 release-readiness helper APIs so stale runtime bridge objects cannot shadow new CP4 surfaces.
8. release-readiness helper now emits canonical `messaging.realtime_voice.cp4_release_readiness_gate` diagnostics and digest `summary.realtimeVoiceSession.releaseReadinessGate*` fields from the same canonical owner path.
9. deterministic CP4 release-evidence packet helper landed for one-copy operator exports with compact CP4 event slices + aggregate evidence gate:
: `runCp4ReleaseEvidenceCapture(...)`, `runCp4ReleaseEvidenceCaptureJson(...)`,
: `runCp4ReleaseEvidenceGateProbe(...)`, and `runCp4ReleaseEvidenceGateProbeJson(...)`.
10. release-evidence helper now emits canonical `messaging.realtime_voice.cp4_release_evidence_gate` diagnostics and digest `summary.realtimeVoiceSession.releaseEvidenceGate*` fields from canonical owners.
11. stale replay-bridge upgrade guard now requires CP4 release-evidence helper APIs so stale runtime bridge objects cannot hide newly added CP4 operator tooling.
12. one-copy `m6-voice-capture` contract now includes CP4 gate event slices (`longSessionGateEvents`, `checkpointGateEvents`, `releaseReadinessGateEvents`, `releaseEvidenceGateEvents`) for compact operator handoff payloads.
13. deterministic `v1.2.0` closeout helper lane landed in canonical replay bridge owner:
: `runV120CloseoutCapture(...)`, `runV120CloseoutCaptureJson(...)`,
: `runV120CloseoutGateProbe(...)`, and `runV120CloseoutGateProbeJson(...)`,
: composing CP3 suite evidence and CP4 release-evidence packet into one aggregate closeout gate.
14. canonical closeout diagnostics event now emits from the same owner path:
: `messaging.realtime_voice.v120_closeout_gate`.
15. realtime voice digest summary and one-copy capture now expose closeout gate posture:
: digest `summary.realtimeVoiceSession.closeoutGate*` counters + latest sample fields,
: capture slice `voice.closeoutGateEvents`.
16. stale replay-bridge upgrade guard now requires `runV120Closeout*` APIs so stale runtime bridge objects cannot hide closeout tooling during CP4/v1.2.0 verification.
17. focused CP4 continuation validation is green:
: `pnpm --dir apps/pwa exec vitest run app/shared/m6-voice-replay-bridge.test.ts app/shared/m6-voice-capture.test.ts app/shared/log-app-event.test.ts`
: `pnpm --dir apps/pwa exec tsc --noEmit --pretty false`
: `pnpm docs:check`
: `pnpm version:check`.

### v1.2.0 (M9-CP4 closeout)

Scope:
1. complete two-device weak-network replay evidence for voice + deletion convergence,
2. close critical regressions from long-session voice usage,
3. publish stable `v1.2.0` milestone.

Current checkpoint progress (2026-03-25):
1. CP4 runtime closeout evidence is accepted from the canonical one-copy closeout helper:
: `window.obscurM6VoiceReplay.runV120CloseoutCaptureJson({ clearAppEvents: true, captureWindowSize: 400, cycleCount: 6, eventSliceLimit: 3 })`.
2. Accepted operator evidence confirms aggregate closeout pass on the canonical owner path:
: `closeoutPass === true`,
: `cp3SuitePass === true`,
: `weakNetworkCp2Pass === true`,
: `accountSwitchCp2Pass === true`,
: `cp4ReleaseEvidencePass === true`,
: `cp4ReleaseReadinessPass === true`,
: `cp4CheckpointPass === true`.
3. Delete convergence remained clean in the accepted closeout bundle:
: weak-network/account-switch/long-session delete remote failure counts were `0`.
4. The accepted closeout replay also emitted canonical diagnostics events in order:
: `messaging.realtime_voice.long_session_gate`,
: `messaging.realtime_voice.cp4_checkpoint_gate`,
: `messaging.realtime_voice.cp4_release_readiness_gate`,
: `messaging.realtime_voice.cp4_release_evidence_gate`,
: `messaging.realtime_voice.v120_closeout_gate`.
5. A separate relay runtime performance gate informational warning was observed with insufficient sample counts, but it did not invalidate the secure-voice closeout gate because the canonical `v120_closeout_gate` remained green on the same replay window.
6. `v1.2.0` release closeout is complete:
: `release:test-pack` and strict `release:preflight` both passed on clean `main`,
: tag `v1.2.0` is published,
: GitHub Release `v1.2.0` is live.

Mandatory release gates:
1. `pnpm version:check`
2. `pnpm docs:check`
3. focused `vitest` suites for touched owners
4. `pnpm --dir apps/pwa exec tsc --noEmit --pretty false`
5. `pnpm release:test-pack -- --skip-preflight`
6. `pnpm release:preflight -- --tag v1.2.0`

## Phase C Detail - M10 (v1.2.1 -> v1.3.0)

Goal:
1. complete privacy-preserving anti-abuse intelligence and performance reliability closeout for `v1.3.0`.

### v1.2.1 (M10-CP1)

Scope:
1. optional signed shared-intel path and relay risk scoring contracts,
2. attack-mode safety profile toggles with explicit local-first reason codes,
3. strict no-central-moderation/no-plaintext-scanning enforcement at contract boundaries.

Evidence:
1. anti-abuse decision tests with deterministic reason-code snapshots,
2. policy toggles verified without owner overlap.

Current checkpoint progress (2026-03-25):
1. `v1.2.1` is now started with docs-first scope lock for `M10` CP1.
2. Roadmap/status/changelog synchronization now reflects:
: `v1.2.0` published and `M10` as the active lane.
3. Release-tracked version manifests are aligned to `1.2.1` for the new execution lane.
4. Canonical CP1 shared-intel + relay-risk contract owner is now landed:
: `apps/pwa/app/features/messaging/services/m10-shared-intel-policy.ts`.
5. New CP1 contract surfaces are now explicit and typed:
: signed shared-intel signal schema (`obscur.m10.shared_intel.v1`),
: signature-verified relay/peer risk evaluation,
: local-first attack-mode safety profile toggles (`standard|strict`),
: strict no-plaintext-boundary enforcement via contract metadata checks.
6. Canonical incoming request anti-abuse owner now consumes CP1 policy decisions:
: `apps/pwa/app/features/messaging/services/incoming-request-anti-abuse.ts`,
: with explicit reason-coded outcomes:
: `attack_mode_strict_relay_high_risk`,
: `attack_mode_peer_shared_intel_blocked`,
: `attack_mode_contract_violation`.
7. Incoming quarantine diagnostics and Requests Inbox anti-spam summaries now include the new CP1 reason-code family:
: `apps/pwa/app/features/messaging/controllers/incoming-dm-event-handler.ts`,
: `apps/pwa/app/features/messaging/services/incoming-request-quarantine-summary.ts`,
: `apps/pwa/app/features/messaging/components/requests-inbox-panel.tsx`.
8. Focused CP1 validation is green:
: `pnpm --dir apps/pwa exec vitest run app/features/messaging/services/m10-shared-intel-policy.test.ts app/features/messaging/services/incoming-request-anti-abuse.test.ts app/features/messaging/services/incoming-request-quarantine-summary.test.ts`,
: `pnpm --dir apps/pwa exec vitest run app/features/messaging/controllers/incoming-dm-event-handler.test.ts`,
: `pnpm --dir apps/pwa exec tsc --noEmit --pretty false`.
9. CP1 shared-intel signals are now profile-scoped and persistent (no singleton-only memory path):
: policy state hydrates from scoped storage key `obscur.messaging.shared_intel_signals.v1::profile`,
: with typed normalization on read/write in `m10-shared-intel-policy`.
10. CP1 attack-mode profile now converges on canonical privacy settings owner:
: `attackModeSafetyProfileV121` in
: `apps/pwa/app/features/settings/services/privacy-settings-service.ts`
: is used by policy getters/setters (instead of a standalone ad-hoc key).
11. CP1 operator replay tooling is now available for deterministic manual verification:
: `window.obscurM10TrustControls` from
: `apps/pwa/app/shared/m10-trust-controls-bridge.ts`
: (snapshot, strict-mode toggle, signed-intel replace/clear, capture JSON),
: installed at boot in `apps/pwa/app/components/providers.tsx`.
12. CP1 shared-intel ingest/export contract is now explicit for manual/operator lanes:
: `ingestSignedSharedIntelSignals(...)` in
: `apps/pwa/app/features/messaging/services/m10-shared-intel-policy.ts`
: returns typed accept/reject evidence (`invalid_shape|expired|missing_signature_verifier|invalid_signature`)
: and supports deterministic dedupe by `signalId` + latest `issuedAtUnixMs`.
13. Operator bridge now supports JSON import/export for one-copy replay prep:
: `window.obscurM10TrustControls.ingestSignedSharedIntelSignalsJson(...)`,
: `window.obscurM10TrustControls.exportSignedSharedIntelSignalsJson()`.
14. CP1 trust controls are now exposed in security settings UI:
: `apps/pwa/app/features/settings/components/auto-lock-settings-panel.tsx`
: with canonical strict/standard profile toggle and signed-intel JSON import/export editor.
15. Focused CP1 trust-controls UI regression coverage is green:
: `pnpm --dir apps/pwa exec vitest run app/features/settings/components/auto-lock-settings-panel.test.tsx`.

### v1.2.2 (M10-CP2)

Scope:
1. anti-abuse/operator UX clarity improvements with reversible controls,
2. route/startup/chat responsiveness hardening for high-load sessions,
3. replay and digest tooling for long-session anti-abuse/performance triage.

Current checkpoint progress (2026-03-25):
1. `v1.2.1` release tag is published and CP2 execution is active.
2. CP2 trust-controls UX clarity slice landed in canonical settings composition path:
: `apps/pwa/app/features/settings/components/auto-lock-settings-panel.tsx`.
3. Reversible controls are now explicit for operator safety:
: `Undo Last Change` restores previous shared-intel state after import/clear.
4. CP2 panel diagnostics clarity improved with compact live trust snapshot counters:
: `signalCount`, `activeCount`, `blockDispositionCount`, `watchDispositionCount`.
5. Trust-control action diagnostics are now explicit and reason-coded:
: `messaging.m10.trust_controls_profile_changed`,
: `messaging.m10.trust_controls_import_result`,
: `messaging.m10.trust_controls_clear_applied`,
: `messaging.m10.trust_controls_undo_applied`.
6. CP2 replay/evidence tooling now captures trust-control actions directly:
: `apps/pwa/app/shared/m10-trust-controls-bridge.ts` capture includes
: `recentTrustControlEvents`.
7. Focused CP2 slice validation is green:
: `pnpm --dir apps/pwa exec vitest run app/features/settings/components/auto-lock-settings-panel.test.tsx app/shared/m10-trust-controls-bridge.test.ts app/features/messaging/services/m10-shared-intel-policy.test.ts`,
: `pnpm --dir apps/pwa exec tsc --noEmit --pretty false`.

Evidence:
1. diagnostics bundle includes anti-abuse + responsiveness signals,
2. runbook guidance updated for incident-class triage order.

### v1.3.0 (M10-CP3/CP4 closeout)

Scope:
1. final two-device/long-session evidence matrix execution,
2. release-blocker burn-down and strict stability verification,
3. publish stable `v1.3.0` milestone.

Mandatory release gates:
1. `pnpm version:check`
2. `pnpm docs:check`
3. focused `vitest` suites for touched owners
4. `pnpm --dir apps/pwa exec tsc --noEmit --pretty false`
5. `pnpm release:test-pack -- --skip-preflight`
6. `pnpm release:preflight -- --tag v1.3.0`

## Non-Negotiable Rules During This Sequence

1. no new parallel owners for runtime/sync/identity/transport/community lifecycle,
2. no release claim without CP3 runtime evidence attachment,
3. no optimistic success state without explicit evidence-backed transition,
4. docs (`CHANGELOG.md`, `ISSUES.md`, and impacted `/docs`) must be updated at each milestone closeout.
