## [Unreleased]

### Changed

- Added canonical local-history reset flow (keep identity/session) in
  `apps/pwa/app/features/messaging/services/local-history-reset-service.ts` and
  wired Settings storage maintenance action
  "Reset Local History (Keep Identity)" in `apps/pwa/app/settings/page.tsx`.
- Added focused regression coverage for local-history reset scope/preservation
  behavior in
  `apps/pwa/app/features/messaging/services/local-history-reset-service.test.ts`.
- Added deleted-account presence consistency guard in canonical presence owner
  `apps/pwa/app/features/network/hooks/use-realtime-presence.ts` so deleted
  contacts never resolve as online from stale presence records.
- Added focused deleted-account presence coverage in
  `apps/pwa/app/features/network/hooks/use-realtime-presence.deleted-profile.test.ts`.
- Added canonical community member-visibility helper
  `apps/pwa/app/features/groups/services/community-visible-members.ts` and
  wired deleted-account filtering into both:
  - `apps/pwa/app/features/groups/components/group-management-dialog.tsx`
  - `apps/pwa/app/groups/[...id]/group-home-page-client.tsx`
  so member counts/online state/member lists exclude deleted-account profiles
  consistently.
- Added focused deleted-account community visibility coverage in
  `apps/pwa/app/features/groups/services/community-visible-members.test.ts`.
- Hardened auto-unlock transient retry gating in
  `apps/pwa/app/features/auth/components/auth-gateway.tsx` to use
  deterministic timer wake-nonce convergence instead of render-time clock reads.
- Hardened realtime presence self-session start timestamp initialization in
  `apps/pwa/app/features/network/hooks/use-realtime-presence.ts` to avoid
  render-time impure clock memoization.
- Hardened canonical chat-visibility owner in
  `apps/pwa/app/features/messaging/providers/messaging-provider.tsx`:
  - removed hidden/pinned mutable-ref state mutations,
  - converged hide/unhide/unhide-on-select flow to functional state updates,
  - persisted hidden/pinned state via explicit state-owned effects.
- Added focused regression coverage for hidden-chat convergence in
  `apps/pwa/app/features/messaging/providers/messaging-provider.visibility.test.tsx`.
- Released `v1.2.6` (tag pushed on 2026-03-25) and opened
  `v1.2.7` as the active development lane on `main`.
- Fixed `demo:m10:rc:status` to emit strict report mode by default
  (added `demo:m10:rc:status:structure` for structure-only reporting) so
  `m10-status.json` reflects actual strict readiness for release decisions.
- Added deterministic `v1.3.0` closeout readiness automation:
  - `pnpm closeout:v130:check`
  - `pnpm closeout:v130:check:with-preflight`
  wired to `scripts/check-v130-closeout-readiness.mjs`.
- Added deterministic release-candidate refresh automation:
  - `pnpm demo:m10:rc:refresh`
  wired to `scripts/refresh-m10-release-candidate-flow.mjs` to run
  `materialize -> strict check -> status -> next` in one command,
  with optional local closeout validation via `--with-closeout-check`.
- Added deterministic tag workflow status automation:
  - `pnpm release:workflow-status -- --tag <version-tag>`
  wired to `scripts/check-release-workflow-status.mjs` to print
  run-level and job-level status for `Obscur Full Release`.
- Added deterministic `v1.3.0` manual evidence packet bootstrap:
  - `pnpm demo:v130:init`
  wired to `scripts/init-v130-closeout-assets.mjs` to scaffold manual
  verification checklist, GIF shot list, and runtime evidence summary
  templates under `docs/assets/demo/v1.3.0/`.
- Added deterministic manual evidence packet validation:
  - `pnpm demo:v130:check`
  - `pnpm demo:v130:check:strict`
  wired to `scripts/check-v130-manual-evidence-packet.mjs` for structure
  and strict final completeness checks.
- Tightened v1.3 closeout gate sequencing:
  - `closeout:v130:check` now includes v1.3 packet structure validation,
  - added `closeout:v130:check:manual` (strict manual packet required),
  - added `closeout:v130:check:release-ready` (strict manual packet + preflight).
- Improved closeout automation determinism:
  - `closeout:v130:check` now verifies strict readiness directly from materialized
    pass/digest/event artifacts (no forced status-file rewrite),
  - `closeout:v130:check` now enforces a clean working tree by default
    (override only with `--allow-dirty` for local non-release runs),
  - added `closeout:v130:check:refresh-status` for explicit status-file refresh.
- Added deterministic stabilized release-candidate helper APIs on canonical M10 bridge owner
  `apps/pwa/app/shared/m10-trust-controls-bridge.ts`:
  - `window.obscurM10TrustControls.runV130ReleaseCandidateCaptureStabilized(...)`,
  - `window.obscurM10TrustControls.runV130ReleaseCandidateCaptureStabilizedJson(...)`,
  using bounded settle passes (`settlePasses`, default `2`) to reduce first-run replay drift.
- Added deterministic release-candidate next-step helper:
  - `pnpm demo:m10:rc:next`
  - reads `docs/assets/demo/v1.2.5/m10-status.json` and prints exact follow-up commands
    for strict gate completion without replay-loop guesswork.
- Added concrete `v1.3.0` closeout execution matrix:
  - `docs/36-v1.3.0-closeout-matrix.md`
  with entry conditions, runtime evidence steps, validation pack, and release gate checklist.
- Added deterministic v1.3 release-candidate helper APIs on canonical M10 bridge owner
  `apps/pwa/app/shared/m10-trust-controls-bridge.ts`:
  - `window.obscurM10TrustControls.runV130ReleaseCandidateCapture(...)`,
  - `window.obscurM10TrustControls.runV130ReleaseCandidateCaptureJson(...)`,
  - `window.obscurM10TrustControls.runV130ReleaseCandidateGateProbe(...)`,
  - `window.obscurM10TrustControls.runV130ReleaseCandidateGateProbeJson(...)`.
- Added canonical v1.3 release-candidate diagnostics event emission:
  - `messaging.m10.v130_release_candidate_gate`
  with explicit one-shot pass/fail posture across CP2/CP3/CP4/v130 gate evidence.
- Extended release-candidate capture/event asset contracts so the one-shot payload and
  `demo:m10:rc` automation now include explicit `v130ReleaseCandidate` event slices for
  strict closeout verification.
- Added focused regression coverage for release-candidate helper flow in:
  - `apps/pwa/app/shared/m10-trust-controls-bridge.test.ts`.
- Added deterministic `v1.2.5` M10 release-candidate asset automation:
  - `scripts/init-m10-release-candidate-assets.mjs`,
  - `scripts/materialize-m10-release-candidate-assets.mjs`,
  - `scripts/check-m10-release-candidate-assets.mjs`,
  - package scripts:
    - `demo:m10:rc:init`,
    - `demo:m10:rc:materialize`,
    - `demo:m10:rc:check:structure`,
    - `demo:m10:rc:check`,
    - `demo:m10:rc:status`.
- Added `v1.2.5` release-candidate matrix and artifact folder:
  - `docs/35-v1.2.5-m10-release-candidate-matrix.md`,
  - `docs/assets/demo/v1.2.5/README.md`,
  - seeded `docs/assets/demo/v1.2.5/raw/` template captures for one-copy operator handoff.
- Added deterministic CP3 readiness helper APIs on canonical M10 bridge owner
  `apps/pwa/app/shared/m10-trust-controls-bridge.ts`:
  - `window.obscurM10TrustControls.runCp3ReadinessCapture(...)`,
  - `window.obscurM10TrustControls.runCp3ReadinessCaptureJson(...)`,
  - `window.obscurM10TrustControls.runCp3ReadinessGateProbe(...)`,
  - `window.obscurM10TrustControls.runCp3ReadinessGateProbeJson(...)`.
- Added canonical CP3 readiness diagnostics event emission:
  - `messaging.m10.cp3_readiness_gate`
  with explicit pass/fail and failed-check sample posture.
- Extended compact cross-device digest in
  `apps/pwa/app/shared/log-app-event.ts` with:
  - `events["messaging.m10.cp3_readiness_gate"]`,
  - `summary.m10TrustControls.cp3ReadinessGate*` counters and latest sample fields.
- Added focused regression coverage for CP3 readiness helper + digest posture in:
  - `apps/pwa/app/shared/m10-trust-controls-bridge.test.ts`,
  - `apps/pwa/app/shared/log-app-event.test.ts`.
- Added deterministic CP3 suite helper APIs on canonical M10 bridge owner
  `apps/pwa/app/shared/m10-trust-controls-bridge.ts`:
  - `window.obscurM10TrustControls.runCp3SuiteCapture(...)`,
  - `window.obscurM10TrustControls.runCp3SuiteCaptureJson(...)`,
  - `window.obscurM10TrustControls.runCp3SuiteGateProbe(...)`,
  - `window.obscurM10TrustControls.runCp3SuiteGateProbeJson(...)`.
- Added canonical CP3 suite diagnostics event emission:
  - `messaging.m10.cp3_suite_gate`
  with explicit aggregate CP3 pass/fail and failed-check sample posture.
- Extended compact cross-device digest in
  `apps/pwa/app/shared/log-app-event.ts` with:
  - `events["messaging.m10.cp3_suite_gate"]`,
  - `summary.m10TrustControls.cp3SuiteGate*` counters and latest sample fields.
- Added deterministic CP4 closeout helper APIs on canonical M10 bridge owner
  `apps/pwa/app/shared/m10-trust-controls-bridge.ts`:
  - `window.obscurM10TrustControls.runCp4CloseoutCapture(...)`,
  - `window.obscurM10TrustControls.runCp4CloseoutCaptureJson(...)`,
  - `window.obscurM10TrustControls.runCp4CloseoutGateProbe(...)`,
  - `window.obscurM10TrustControls.runCp4CloseoutGateProbeJson(...)`.
- Added canonical CP4 closeout diagnostics event emission:
  - `messaging.m10.cp4_closeout_gate`
  with explicit aggregate closeout pass/fail and failed-check sample posture.
- Extended compact cross-device digest in
  `apps/pwa/app/shared/log-app-event.ts` with:
  - `events["messaging.m10.cp4_closeout_gate"]`,
  - `summary.m10TrustControls.cp4CloseoutGate*` counters and latest sample fields.
- Added deterministic v1.3 aggregate closeout helper APIs on canonical M10 bridge owner
  `apps/pwa/app/shared/m10-trust-controls-bridge.ts`:
  - `window.obscurM10TrustControls.runV130CloseoutCapture(...)`,
  - `window.obscurM10TrustControls.runV130CloseoutCaptureJson(...)`,
  - `window.obscurM10TrustControls.runV130CloseoutGateProbe(...)`,
  - `window.obscurM10TrustControls.runV130CloseoutGateProbeJson(...)`.
- Added canonical v1.3 aggregate closeout diagnostics event emission:
  - `messaging.m10.v130_closeout_gate`
  with explicit aggregate pass/fail and failed-check sample posture over CP4 closeout evidence.
- Extended compact cross-device digest in
  `apps/pwa/app/shared/log-app-event.ts` with:
  - `events["messaging.m10.v130_closeout_gate"]`,
  - `summary.m10TrustControls.v130CloseoutGate*` counters and latest sample fields.
- Added deterministic v1.3 evidence helper APIs on canonical M10 bridge owner
  `apps/pwa/app/shared/m10-trust-controls-bridge.ts`:
  - `window.obscurM10TrustControls.runV130EvidenceCapture(...)`,
  - `window.obscurM10TrustControls.runV130EvidenceCaptureJson(...)`,
  - `window.obscurM10TrustControls.runV130EvidenceGateProbe(...)`,
  - `window.obscurM10TrustControls.runV130EvidenceGateProbeJson(...)`.
- Added canonical v1.3 evidence diagnostics event emission:
  - `messaging.m10.v130_evidence_gate`
  with explicit final evidence pass/fail and failed-check sample posture.
- Extended compact cross-device digest in
  `apps/pwa/app/shared/log-app-event.ts` with:
  - `events["messaging.m10.v130_evidence_gate"]`,
  - `summary.m10TrustControls.v130EvidenceGate*` counters and latest sample fields.
- Added `v1.2.4` M10 demo-asset matrix and fixed bundle output path:
  - `docs/34-v1.2.4-m10-demo-asset-matrix.md`,
  - `docs/assets/demo/v1.2.4/README.md`,
  with copy-ready capture commands for CP3/CP4/v130 pass-lane evidence and digest event slices.
- Added deterministic M10 demo-bundle automation:
  - `scripts/init-m10-demo-assets.mjs`,
  - `scripts/check-m10-demo-assets.mjs`,
  - package scripts: `demo:m10:init`, `demo:m10:check:structure`, `demo:m10:check`, `demo:m10:status`.
- Seeded `docs/assets/demo/v1.2.4/` with template demo assets:
  - CP3/CP4/v130 pass-lane JSON placeholders,
  - digest/event bundle placeholders,
  - storyboard template.
- Added machine-readable demo readiness status output:
  - `docs/assets/demo/v1.2.4/m10-status.json`
  - including `strictReady` and strict-violation details for phased closeout tracking.
- Added deterministic M10 demo materialization automation from canonical raw captures:
  - `scripts/materialize-m10-demo-assets.mjs`,
  - package script: `demo:m10:materialize`,
  - raw capture staging doc: `docs/assets/demo/v1.2.4/raw/README.md`,
  - matrix updated with `capture -> materialize -> strict-check` flow to reduce manual JSON drift.
- Added one-shot M10 demo bundle export helper on canonical trust-controls bridge owner:
  - `window.obscurM10TrustControls.runV124DemoAssetBundleCapture(...)`,
  - `window.obscurM10TrustControls.runV124DemoAssetBundleCaptureJson(...)`,
  - outputs CP3/CP4/v130 gate payloads + digest summary + event slices + strict gate preview in one copy-ready packet.
- Extended demo materializer to accept one-shot bundle input:
  - `pnpm demo:m10:materialize -- --bundle docs/assets/demo/v1.2.4/raw/m10-v124-demo-bundle.json`,
  - split (`--v130-evidence` + `--digest-bundle`) mode remains available as fallback.
- Applied real one-shot M10 demo evidence bundle and materialized strict pass-lane assets in:
  - `docs/assets/demo/v1.2.4/m10-*.json`,
  - with strict verification now green:
    - `pnpm demo:m10:check`,
    - `docs/assets/demo/v1.2.4/m10-status.json` (`strictReady: true`).

## [v1.2.2] - 2026-03-25

### Changed

- Landed `v1.2.1` (`M10` `CP1`) canonical shared-intel/relay-risk policy contracts in
  `apps/pwa/app/features/messaging/services/m10-shared-intel-policy.ts`:
  - typed signed shared-intel schema (`obscur.m10.shared_intel.v1`),
  - signature-verified relay/peer risk evaluation,
  - local-first attack-mode profile toggles (`standard|strict`),
  - strict no-plaintext scanning boundary enforcement at contract inputs.
- Wired CP1 policy decisions into canonical incoming request anti-abuse owner:
  `apps/pwa/app/features/messaging/services/incoming-request-anti-abuse.ts`,
  with explicit reason-coded strict-mode outcomes:
  `attack_mode_strict_relay_high_risk`,
  `attack_mode_peer_shared_intel_blocked`,
  `attack_mode_contract_violation`.
- Extended request-quarantine UX summaries/badges for new CP1 strict-mode reasons in:
  `apps/pwa/app/features/messaging/services/incoming-request-quarantine-summary.ts`
  and `apps/pwa/app/features/messaging/components/requests-inbox-panel.tsx`.
- Added profile-scoped persistence/hydration for signed shared-intel signals in
  `apps/pwa/app/features/messaging/services/m10-shared-intel-policy.ts` to avoid transient in-memory-only policy state.
- Moved attack-mode profile persistence to canonical privacy settings owner via
  `attackModeSafetyProfileV121` in `apps/pwa/app/features/settings/services/privacy-settings-service.ts`.
- Added deterministic CP1 operator replay bridge:
  `window.obscurM10TrustControls` from
  `apps/pwa/app/shared/m10-trust-controls-bridge.ts`,
  installed at boot in `apps/pwa/app/components/providers.tsx`.
- Added typed shared-intel ingest contract in
  `apps/pwa/app/features/messaging/services/m10-shared-intel-policy.ts`:
  - deterministic accept/reject evidence counters,
  - rejection reason codes (`invalid_shape`, `expired`, `missing_signature_verifier`, `invalid_signature`),
  - dedupe/replace behavior by `signalId` with latest `issuedAtUnixMs`.
- Extended trust-controls bridge with JSON ingest/export operator helpers:
  - `window.obscurM10TrustControls.ingestSignedSharedIntelSignalsJson(...)`,
  - `window.obscurM10TrustControls.exportSignedSharedIntelSignalsJson()`.
- Added CP1 security settings UI surface for trust controls in
  `apps/pwa/app/features/settings/components/auto-lock-settings-panel.tsx`:
  - strict/standard attack-mode profile toggle wired to canonical policy owner,
  - signed shared-intel JSON import/export editor with deterministic ingest evidence summary,
  - explicit import options for `requireSignatureVerification` and `replaceExisting`.
- Added focused UI coverage for CP1 settings trust controls in
  `apps/pwa/app/features/settings/components/auto-lock-settings-panel.test.tsx`.
- Pushed release tag `v1.2.1` and opened `v1.2.2` (`M10` `CP2`) implementation lane.
- Started `v1.2.2` (`M10` `CP2`) trust-controls UX clarity slice:
  - added reversible trust-control operations in
    `apps/pwa/app/features/settings/components/auto-lock-settings-panel.tsx`
    (`Undo Last Change` after import/clear),
  - added live trust snapshot counters (signal/active/block/watch) in the same panel,
  - added canonical diagnostics events for profile/import/clear/undo actions:
    `messaging.m10.trust_controls_profile_changed`,
    `messaging.m10.trust_controls_import_result`,
    `messaging.m10.trust_controls_clear_applied`,
    `messaging.m10.trust_controls_undo_applied`.
- Extended M10 trust-controls bridge capture evidence bundle in
  `apps/pwa/app/shared/m10-trust-controls-bridge.ts`
  with `recentTrustControlEvents` for operator replay triage.
- Extended compact cross-device diagnostics in
  `apps/pwa/app/shared/log-app-event.ts` with a new `summary.uiResponsiveness` block:
  - route request/settle counters,
  - hard-fallback and route-mount slow counters,
  - page-transition watchdog/disablement counters,
  - startup profile-boot stall counter,
  - latest route/elapsed/phase evidence fields for freeze triage.
- Extended M10 bridge capture bundle with `recentResponsivenessEvents` to attach
  trust + responsiveness evidence in one operator packet.
- Added deterministic CP2 M10 triage helper APIs in
  `apps/pwa/app/shared/m10-trust-controls-bridge.ts`:
  - `window.obscurM10TrustControls.runCp2TriageCapture(...)`,
  - `window.obscurM10TrustControls.runCp2TriageCaptureJson(...)`,
  - with explicit gate verdict (`cp2TriageGate`) over anti-abuse + responsiveness digest evidence.
- Added deterministic CP2 stability-gate probe APIs in
  `apps/pwa/app/shared/m10-trust-controls-bridge.ts`:
  - `window.obscurM10TrustControls.runCp2StabilityGateProbe(...)`,
  - `window.obscurM10TrustControls.runCp2StabilityGateProbeJson(...)`,
  - reusing canonical triage capture and emitting `messaging.m10.cp2_stability_gate`
    with explicit pass/fail + failed-check sample evidence.
- Added a route-mount performance guard in canonical navigation owner
  `apps/pwa/app/components/app-shell.tsx`:
  - when route-mount settles are consecutively slow, transition effects are disabled fail-open to reduce UI freeze pressure,
  - emits `navigation.route_mount_performance_guard_enabled` plus explicit disablement context.
- Extended route-mount diagnostics state in
  `apps/pwa/app/components/page-transition-recovery.ts`
  with `consecutiveSlowSampleCount` and threshold constant
  `ROUTE_MOUNT_SLOW_DISABLE_THRESHOLD`.
- Extended `summary.uiResponsiveness` with
  `routeMountPerformanceGuardEnabledCount` in
  `apps/pwa/app/shared/log-app-event.ts`.
- Extended compact cross-device digest with `summary.m10TrustControls` and
  `events["messaging.m10.cp2_stability_gate"]` in
  `apps/pwa/app/shared/log-app-event.ts`
  to expose CP2 gate run/pass/fail/unexpected-fail posture.
- Started `v1.2.1` (`M10` `CP1`) with docs-first scope lock and release-sequence synchronization after `v1.2.0` publish.
- Marked `v1.2.0` secure-voice closeout as released (tag + GitHub Release live) and shifted active execution to anti-abuse/trust-controls `M10`.
- Aligned release-tracked version manifests to `1.2.1` to open the new implementation lane.
- Started `v1.1.6` (`M9` `CP4` continuation lane) with deterministic CP4 checkpoint capture helpers in
  `apps/pwa/app/shared/m6-voice-replay-bridge.ts`:
  - `window.obscurM6VoiceReplay.runCp4CheckpointCapture(...)`,
  - `window.obscurM6VoiceReplay.runCp4CheckpointCaptureJson(...)`.
- Added compact CP4 checkpoint gate-probe helpers:
  - `window.obscurM6VoiceReplay.runCp4CheckpointGateProbe(...)`,
  - `window.obscurM6VoiceReplay.runCp4CheckpointGateProbeJson(...)`,
  - for one-call checkpoint pass/fail verdict export without full bundle inspection.
- CP4 checkpoint capture now exports one bundle with:
  - `longSession` replay capture,
  - `gateProbe`,
  - `selfTest`,
  - `digestSummary`,
  - aggregate `cp4CheckpointGate` pass/fail checks for release-readiness triage.
- CP4 checkpoint capture now emits compact checkpoint diagnostics event:
  - `messaging.realtime_voice.cp4_checkpoint_gate`
  - with `expectedPass` and checkpoint gate check-sample context for digest-backed triage.
- Cross-device digest realtime voice summary now surfaces checkpoint gate posture:
  - `checkpointGateCount`,
  - `checkpointGatePassCount`,
  - `checkpointGateFailCount`,
  - `unexpectedCheckpointGateFailCount`,
  - `latestCheckpointGatePass`,
  - `latestCheckpointGateFailedCheckSample`.
- Extended stale replay-bridge upgrade guard to require CP4 checkpoint APIs and kept digest parser contracts aligned with long-session gate summary fields.
- Added focused regression coverage for CP4 checkpoint capture pass/fail lanes in:
  - `apps/pwa/app/shared/m6-voice-replay-bridge.test.ts`.
- Added focused digest/capture coverage for CP4 checkpoint event compaction and summary counters in:
  - `apps/pwa/app/shared/log-app-event.test.ts`,
  - `apps/pwa/app/shared/m6-voice-capture.test.ts`.
- Added deterministic CP4 release-readiness helper set in
  `apps/pwa/app/shared/m6-voice-replay-bridge.ts`:
  - `window.obscurM6VoiceReplay.runCp4ReleaseReadinessCapture(...)`,
  - `window.obscurM6VoiceReplay.runCp4ReleaseReadinessCaptureJson(...)`,
  - `window.obscurM6VoiceReplay.runCp4ReleaseReadinessGateProbe(...)`,
  - `window.obscurM6VoiceReplay.runCp4ReleaseReadinessGateProbeJson(...)`.
- CP4 release-readiness helper now provides one-copy checkpoint + latest event alignment + digest summary gate checks to reduce manual probe drift for limited-account operators.
- Extended stale replay-bridge auto-upgrade guard to require CP4 release-readiness helper APIs.
- Added focused regression coverage for CP4 release-readiness helper pass/fail lanes in:
  - `apps/pwa/app/shared/m6-voice-replay-bridge.test.ts`.
- Added canonical CP4 release-readiness diagnostics event emission from the release-readiness helper lane:
  - `messaging.realtime_voice.cp4_release_readiness_gate`.
- Cross-device digest realtime voice summary now surfaces release-readiness gate posture:
  - `releaseReadinessGateCount`,
  - `releaseReadinessGatePassCount`,
  - `releaseReadinessGateFailCount`,
  - `unexpectedReleaseReadinessGateFailCount`,
  - `latestReleaseReadinessGatePass`,
  - `latestReleaseReadinessGateFailedCheckSample`.
- Extended digest/capture parser contracts to include release-readiness gate fields in:
  - `apps/pwa/app/shared/log-app-event.ts`,
  - `apps/pwa/app/shared/m6-voice-capture.ts`,
  - `apps/pwa/app/shared/m6-voice-replay-bridge.ts`.
- Added deterministic CP4 release-evidence packet helper set in
  `apps/pwa/app/shared/m6-voice-replay-bridge.ts`:
  - `window.obscurM6VoiceReplay.runCp4ReleaseEvidenceCapture(...)`,
  - `window.obscurM6VoiceReplay.runCp4ReleaseEvidenceCaptureJson(...)`,
  - `window.obscurM6VoiceReplay.runCp4ReleaseEvidenceGateProbe(...)`,
  - `window.obscurM6VoiceReplay.runCp4ReleaseEvidenceGateProbeJson(...)`.
- CP4 release-evidence helper now returns one packet with release-readiness bundle + compact CP4 event slices (`long_session_gate`, `cp4_checkpoint_gate`, `cp4_release_readiness_gate`) plus an aggregate evidence gate verdict.
- Extended stale replay-bridge auto-upgrade guard to require CP4 release-evidence helper APIs.
- Added focused regression coverage for CP4 release-evidence packet pass/fail lanes in:
  - `apps/pwa/app/shared/m6-voice-replay-bridge.test.ts`.
- Added canonical CP4 release-evidence diagnostics event emission:
  - `messaging.realtime_voice.cp4_release_evidence_gate`.
- Cross-device digest realtime voice summary now surfaces release-evidence gate posture:
  - `releaseEvidenceGateCount`,
  - `releaseEvidenceGatePassCount`,
  - `releaseEvidenceGateFailCount`,
  - `unexpectedReleaseEvidenceGateFailCount`,
  - `latestReleaseEvidenceGatePass`,
  - `latestReleaseEvidenceGateFailedCheckSample`.
- Extended digest/capture parser contracts with CP4 release-evidence fields in:
  - `apps/pwa/app/shared/log-app-event.ts`,
  - `apps/pwa/app/shared/m6-voice-capture.ts`,
  - `apps/pwa/app/shared/m6-voice-replay-bridge.ts`.
- Extended one-copy `m6-voice-capture` event coverage to include CP4 gate slices:
  - `voice.longSessionGateEvents`,
  - `voice.checkpointGateEvents`,
  - `voice.releaseReadinessGateEvents`,
  - `voice.releaseEvidenceGateEvents`,
  for faster operator handoff without ad-hoc event queries.
- Added deterministic `v1.2.0` closeout helper set in
  `apps/pwa/app/shared/m6-voice-replay-bridge.ts`:
  - `window.obscurM6VoiceReplay.runV120CloseoutCapture(...)`,
  - `window.obscurM6VoiceReplay.runV120CloseoutCaptureJson(...)`,
  - `window.obscurM6VoiceReplay.runV120CloseoutGateProbe(...)`,
  - `window.obscurM6VoiceReplay.runV120CloseoutGateProbeJson(...)`,
  - closeout output now composes CP3 replay-suite evidence + CP4 release-evidence packet into one aggregate gate for `v1.2.0` checkpoint triage.
- Added canonical closeout diagnostics event emission:
  - `messaging.realtime_voice.v120_closeout_gate`.
- Cross-device digest realtime voice summary now surfaces closeout-gate posture:
  - `closeoutGateCount`,
  - `closeoutGatePassCount`,
  - `closeoutGateFailCount`,
  - `unexpectedCloseoutGateFailCount`,
  - `latestCloseoutGatePass`,
  - `latestCloseoutGateFailedCheckSample`.
- Extended one-copy `m6-voice-capture` CP4 event coverage with:
  - `voice.closeoutGateEvents`.
- Accepted `v1.2.0` CP4 runtime closeout evidence on 2026-03-25 from the canonical closeout helper:
  - `runV120CloseoutCaptureJson({ clearAppEvents: true, captureWindowSize: 400, cycleCount: 6, eventSliceLimit: 3 })`
  - with `closeoutPass`, `cp3SuitePass`, `weakNetworkCp2Pass`, `accountSwitchCp2Pass`, `cp4ReleaseEvidencePass`, `cp4ReleaseReadinessPass`, and `cp4CheckpointPass` all `true`.
- The accepted closeout replay also confirmed delete convergence remained clean across the bundle:
  - weak-network/account-switch/long-session delete remote failure counts were `0`.

## [v1.1.5] - 2026-03-24

### Changed

- Started `v1.1.5` (`M9` `CP4` continuation lane) with release-aligned version manifests and roadmap/status sync for the next secure-voice hardening slices.
- Added deterministic CP4 long-session gate-probe helpers in
  `apps/pwa/app/shared/m6-voice-replay-bridge.ts`:
  - `window.obscurM6VoiceReplay.runCp4LongSessionGateProbe(...)`,
  - `window.obscurM6VoiceReplay.runCp4LongSessionGateProbeJson(...)`,
  - probe output now validates CP4 gate/event/final-phase alignment against expected pass/fail outcomes (including failure-injection expected-fail lanes).
- Extended stale replay-bridge auto-upgrade guard to require CP4 gate-probe APIs, preventing stale runtime objects from hiding newly added CP4 tooling.
- Added focused regression coverage for CP4 gate-probe nominal and expected-failure lanes in:
  - `apps/pwa/app/shared/m6-voice-replay-bridge.test.ts`.
- Extended `m6-voice-capture` realtime voice summary contract to carry CP4 long-session gate fields from digest output (`longSessionGate*`, `latestLongSessionGatePass`, `latestLongSessionGateFailedCheckSample`) so one-copy replay captures retain full CP4 gate posture context.

## [v1.1.4] - 2026-03-24

### Changed

- Started `v1.1.4` (`M9` `CP4` prep) with deterministic long-session voice stability tooling:
  - added long-session replay helpers in
    `apps/pwa/app/shared/m6-voice-replay-bridge.ts`:
    - `window.obscurM6VoiceReplay.runLongSessionReplay(...)`,
    - `window.obscurM6VoiceReplay.runLongSessionReplayCapture(...)`,
    - `window.obscurM6VoiceReplay.runLongSessionReplayCaptureJson(...)`,
    - `window.obscurM6VoiceReplay.runCp4LongSessionSelfTest(...)`,
    - `window.obscurM6VoiceReplay.runCp4LongSessionSelfTestJson(...)`,
  - helper output now includes `cp4ReadinessGate` with explicit checks for:
    - transition volume and repeated degrade/recover convergence,
    - no unexpected terminal end/recovery exhaustion on nominal soak,
    - unified async voice-note and delete-convergence health signals.
  - long-session capture now emits deterministic gate diagnostics events:
    - `messaging.realtime_voice.long_session_gate`
    with CP4 pass/fail and failed-check context for digest-driven triage.
  - cross-device digest `summary.realtimeVoiceSession` now surfaces CP4 gate posture:
    - `longSessionGateCount`,
    - `longSessionGatePassCount`,
    - `longSessionGateFailCount`,
    - `unexpectedLongSessionGateFailCount`,
    - `latestLongSessionGatePass`,
    - `latestLongSessionGateFailedCheckSample`,
    - risk escalates to `watch` on any gate failure and to `high` on unexpected non-injected failures.
  - CP4 self-test output now provides compact nominal-vs-failure verdict:
    - nominal lane must pass CP4 readiness,
    - failure-injection lane must fail with `recovery_exhausted` signal coverage.
  - added focused long-session helper coverage in:
    - `apps/pwa/app/shared/m6-voice-replay-bridge.test.ts`.
  - added dedicated matrix/runbook lane:
    - `docs/33-v1.1.4-cp4-voice-long-session-matrix.md`.

## [v1.1.3] - 2026-03-24

### Changed

- Started post-`v1.1.2` M9 continuation with CP3 replay-suite prep:
  - added deterministic one-copy M6 replay-suite helpers in
    `apps/pwa/app/shared/m6-voice-replay-bridge.ts`:
    - `window.obscurM6VoiceReplay.runCp3ReplaySuiteCapture(...)`,
    - `window.obscurM6VoiceReplay.runCp3ReplaySuiteCaptureJson(...)`,
    - `window.obscurM6VoiceReplay.runCp3ReplaySuiteGateProbe(...)`,
    - `window.obscurM6VoiceReplay.runCp3ReplaySuiteGateProbeJson(...)`,
    - `window.obscurM6VoiceReplay.runCp3SingleDeviceSelfTest(...)`,
    - `window.obscurM6VoiceReplay.runCp3SingleDeviceSelfTestJson(...)`,
    - suite output now includes weak-network and account-switch replay bundles plus
      an overall `suiteGate` verdict for manual CP3 evidence collection.
    - `suiteGate` now also validates unified diagnostics health across both replay paths:
      - async voice-note summary presence/risk/start-failure counters,
      - delete-convergence summary presence/risk/remote-failure counters.
    - risk checks now require summary presence (missing summaries cannot pass as low-risk),
      with focused regression coverage for deterministic failure on capture-unavailable runs.
    - single-device self-test now includes deterministic synthetic probes for:
      - unsupported runtime transition coverage,
      - recovery-exhausted transition/digest coverage,
      reducing dependency on large multi-account test pools.
  - added focused replay-suite coverage in:
    - `apps/pwa/app/shared/m6-voice-replay-bridge.test.ts`
- Started `v1.1.3` (`M9` `CP3`) checkpoint documentation/runbook lane:
  - added dedicated matrix:
    - `docs/32-v1.1.3-cp3-voice-suite-matrix.md`
  - synced active major-phase and maintainer references:
    - `docs/29-versioned-major-phase-plan-v1.0.10-v1.3.0.md`
    - `docs/08-maintainer-playbook.md`
    - `docs/README.md`
  - accepted CP3 operator evidence on limited-account setup using single-device projection:
    - `selfTestPass: true`, `selfTestFailedChecks: []`,
    - `suitePass: true`, `weakPass: true`, `accountPass: true`,
    - `unsupportedProbePass: true`, `recoveryExhaustedProbePass: true`.

## [v1.1.2] - 2026-03-24

### Changed

- Started `v1.1.2` (`M9` `CP2`) diagnostics/capture hardening for realtime voice:
  - extended cross-device digest `summary.realtimeVoiceSession` in
    `apps/pwa/app/shared/log-app-event.ts` with:
    - `staleEventIgnoredCount`,
    - `latestIgnoredReasonCode`,
    - watch-level risk now also reflects stale-event ignore evidence.
  - extended M6 voice capture contracts in
    `apps/pwa/app/shared/m6-voice-capture.ts` with:
    - `voice.summary.staleEventIgnoredCount`,
    - `voice.summary.latestIgnoredReasonCode`,
    - `voice.ignoredEvents` slice for one-copy replay bundles.
  - extended M0 focused triage coverage in
    `apps/pwa/app/shared/m0-triage-capture.ts`:
    - `voice_realtime` now includes
      `messaging.realtime_voice.session_event_ignored`.
  - added deterministic M6 weak-network replay capture helper in
    `apps/pwa/app/shared/m6-voice-replay-bridge.ts`:
    - `window.obscurM6VoiceReplay.runWeakNetworkReplayCapture(...)`,
    - `window.obscurM6VoiceReplay.runWeakNetworkReplayCaptureJson(...)`,
    - replay output now includes CP2 readiness verdict fields and one-copy replay + capture export.
  - added deterministic M6 account-switch replay capture helper in
    `apps/pwa/app/shared/m6-voice-replay-bridge.ts`:
    - `window.obscurM6VoiceReplay.runAccountSwitchReplayCapture(...)`,
    - `window.obscurM6VoiceReplay.runAccountSwitchReplayCaptureJson(...)`,
    - replay output now includes multi-room switch evidence counters and CP2 gate verdict fields.
  - unified async voice-note and delete-convergence diagnostics in canonical owners:
    - cross-device digest now includes `summary.asyncVoiceNote` and `summary.deleteConvergence` in
      `apps/pwa/app/shared/log-app-event.ts`,
    - delete-for-everyone canonical action path now emits reason-coded convergence events in
      `apps/pwa/app/features/main-shell/hooks/use-chat-actions.ts`,
    - M6 capture now exports one-copy voice-note/delete slices:
      - `voice.asyncVoiceNoteSummary`,
      - `voice.deleteConvergenceSummary`,
      - `voice.voiceNoteEvents`,
      - `voice.deleteConvergenceEvents`,
      in `apps/pwa/app/shared/m6-voice-capture.ts`,
    - M0 focused triage voice category now includes voice-note and delete-convergence events in
      `apps/pwa/app/shared/m0-triage-capture.ts`.
  - added focused regression coverage in:
    - `apps/pwa/app/shared/log-app-event.test.ts`
    - `apps/pwa/app/shared/m6-voice-capture.test.ts`
    - `apps/pwa/app/shared/m0-triage-capture.test.ts`
    - `apps/pwa/app/shared/m6-voice-replay-bridge.test.ts`

### Validation

- `pnpm --dir apps/pwa exec vitest run app/shared/log-app-event.test.ts app/shared/m6-voice-capture.test.ts app/shared/m0-triage-capture.test.ts`
- `pnpm --dir apps/pwa exec vitest run app/shared/m6-voice-replay-bridge.test.ts app/shared/m6-voice-capture.test.ts app/shared/log-app-event.test.ts app/shared/m0-triage-capture.test.ts`
- `pnpm --dir apps/pwa exec vitest run app/shared/log-app-event.test.ts app/shared/m6-voice-capture.test.ts app/shared/m0-triage-capture.test.ts app/shared/m6-voice-replay-bridge.test.ts app/features/main-shell/hooks/use-chat-actions.delete-targets.test.ts`
- `pnpm --dir apps/pwa exec tsc --noEmit --pretty false`
- `pnpm docs:check`

## [v1.1.1] - 2026-03-24

### Changed

- Started `v1.1.1` (`M9` `CP1`) secure-voice lifecycle hardening:
  - added deterministic remote-close transition on canonical voice lifecycle owner in:
    - `apps/pwa/app/features/messaging/services/realtime-voice-session-lifecycle.ts`
    - new API:
      `markRealtimeVoiceSessionClosed(state, { nowUnixMs })`
  - session closure now transitions to `phase: "ended"` with reason `session_closed` from
    `connecting|active|degraded|leaving`, preventing stuck interactive state when peer-side close arrives before local leave completion.
  - hardened canonical connect-transition handling for active session refresh paths:
    - `markRealtimeVoiceSessionConnected(...)` now accepts `active` phase updates in
      `apps/pwa/app/features/messaging/services/realtime-voice-session-lifecycle.ts`,
    - active sessions now update participant evidence deterministically instead of surfacing
      `invalid_transition` on subsequent peer-evidence updates,
    - active sessions now degrade with reason `peer_evidence_missing` when peer evidence drops during update.
  - hardened terminal race handling for delayed close/leave callbacks:
    - `markRealtimeVoiceSessionClosed(...)` and `markRealtimeVoiceSessionLeft(...)` now treat `ended` as idempotent terminal state in
      `apps/pwa/app/features/messaging/services/realtime-voice-session-lifecycle.ts`,
    - delayed callback ordering no longer overwrites terminal reason with `invalid_transition`.
  - added canonical realtime voice session owner contract with stale-event guard:
    - new owner module:
      `apps/pwa/app/features/messaging/services/realtime-voice-session-owner.ts`,
    - owner centralizes lifecycle transitions and diagnostics emission behind one typed API,
    - stale transition events (`eventUnixMs < lastTransitionAtUnixMs`) are ignored to preserve newer canonical state.
  - added explicit stale-event observability on canonical owner path:
    - ignored stale transitions now emit
      `messaging.realtime_voice.session_event_ignored`
      with reason/timestamp/phase evidence from
      `apps/pwa/app/features/messaging/services/realtime-voice-session-owner.ts`,
    - cross-device digest compact-event config now captures this event in
      `apps/pwa/app/shared/log-app-event.ts`.
  - migrated M6 replay bridge to consume canonical owner transitions:
    - `apps/pwa/app/shared/m6-voice-replay-bridge.ts`,
    - replay bridge now uses deterministic monotonic event timestamps through owner APIs instead of direct lifecycle calls.
  - added focused regression coverage in:
    - `apps/pwa/app/features/messaging/services/realtime-voice-session-lifecycle.test.ts`
    - `apps/pwa/app/features/messaging/services/realtime-voice-session-owner.test.ts`
    - `apps/pwa/app/shared/m6-voice-replay-bridge.test.ts`
    - `apps/pwa/app/shared/log-app-event.test.ts`
  - synced active major-phase docs/status:
    - `docs/29-versioned-major-phase-plan-v1.0.10-v1.3.0.md`
    - `docs/21-post-v1-value-roadmap.md`
    - `docs/30-versioned-phase-plan-v1.0.10-v1.1.0.md`
    - `ISSUES.md`

### Validation

- `pnpm --dir apps/pwa exec vitest run app/features/messaging/services/realtime-voice-session-lifecycle.test.ts app/features/messaging/services/realtime-voice-session-diagnostics.test.ts`
- `pnpm --dir apps/pwa exec vitest run app/features/messaging/services/realtime-voice-session-owner.test.ts app/shared/m6-voice-replay-bridge.test.ts app/shared/log-app-event.test.ts`
- `pnpm --dir apps/pwa exec tsc --noEmit --pretty false`
- `pnpm version:check`
- `pnpm docs:check`
- `pnpm release:test-pack -- --skip-preflight`
- `pnpm release:preflight -- --tag v1.1.1`

## [v1.1.0] - 2026-03-24

### Changed

- Started `v1.0.11` (`M8` `CP2`) diagnostics extension for community membership/sendability triage:
  - extended cross-device digest `summary.membershipSendability` with reason-partitioned room-key send-block counters in:
    - `apps/pwa/app/shared/log-app-event.ts`
    - `joinedMembershipRoomKeyMismatchCount`
    - `localProfileScopeRoomKeyMissingCount`
    - `noLocalRoomKeysCount`
    - `latestReasonCode`
  - membership sendability risk is now severity-aware:
    - `high` only when joined-membership mismatch is observed (`target_room_key_missing_after_membership_joined`),
    - `watch` for non-joined send-block reasons and visible-group/chat-state parity lag.
  - synchronized M8 capture parser contract for the expanded digest shape in:
    - `apps/pwa/app/shared/m8-community-capture.ts`
  - added account-switch profile-scope convergence summary to the cross-device digest:
    - `summary.accountSwitchScopeConvergence` in
      `apps/pwa/app/shared/log-app-event.ts`
    - counters:
      - `backupRestoreProfileScopeMismatchCount`
      - `runtimeActivationProfileScopeMismatchCount`
      - `autoUnlockScopeDriftDetectedCount`
    - latest reason fields:
      - `latestBackupRestoreReasonCode`
      - `latestRuntimeActivationReasonCode`
      - `latestAutoUnlockReasonCode`
    - severity policy:
      - `high` for runtime/restore profile-scope mismatches
      - `watch` for auto-unlock drift-only evidence
  - extended M8 capture replay-readiness with CP3 gate signal:
    - `community.replayReadiness.readyForCp3Evidence` in
      `apps/pwa/app/shared/m8-community-capture.ts`
  - extended M8 replay bridge with explicit CP3 evidence gate verdict output:
    - `window.obscurM8CommunityReplay.runConvergenceReplayCapture({ clearAppEvents: true })`
    - emits `cp3EvidenceGate.pass` and `cp3EvidenceGate.failedChecks` in one-copy export bundles
    - implementation in:
      `apps/pwa/app/shared/m8-community-replay-bridge.ts`
  - added focused diagnostics regression coverage in:
    - `apps/pwa/app/shared/log-app-event.test.ts`
    - `apps/pwa/app/shared/m8-community-capture.test.ts`
    - `apps/pwa/app/shared/m8-community-replay-bridge.test.ts`
  - updated M8 maintainer replay guidance for CP2 incident interpretation:
    - `docs/08-maintainer-playbook.md`
    - `docs/31-v1.0.10-cp3-community-replay-matrix.md`
  - accepted M8 CP3 operator replay evidence using gate-verdict capture helper:
    - `window.obscurM8CommunityReplay.runConvergenceReplayCapture({ clearAppEvents: true })`
    - observed verdict:
      - `cp3EvidenceGate.pass: true`
      - `cp3EvidenceGate.failedChecks: []`
    - observed deterministic event chain includes:
      - `groups.membership_ledger_load`
      - `groups.membership_recovery_hydrate`
      - `messaging.chat_state_groups_update`
      - `groups.room_key_missing_send_blocked`

### Validation

- `pnpm --dir apps/pwa exec vitest run app/shared/log-app-event.test.ts app/shared/m8-community-capture.test.ts app/shared/m8-community-replay-bridge.test.ts`
- `pnpm --dir apps/pwa exec tsc --noEmit --pretty false`

## [v1.0.10] - 2026-03-24

### Changed

- Started post-`v1.0.9` `v1.0.10` lane (`M8`) with CP1 community lifecycle convergence hardening on canonical group owners:
  - provider-side group add/dedupe now performs deterministic convergence merge instead of first-write-wins:
    - `apps/pwa/app/features/groups/providers/group-provider.tsx`
  - room-key sendability mismatch now emits explicit joined-membership reason code on send block:
    - `target_room_key_missing_after_membership_joined` in
      `apps/pwa/app/features/groups/services/group-service.ts`
  - chat-state cache/pending entries are profile-scoped (`profileId + publicKeyHex`) to prevent cross-scope group hydration bleed:
    - `apps/pwa/app/features/messaging/services/chat-state-store.ts`
- Added focused CP1 regression coverage for convergence + profile-scope isolation:
  - `apps/pwa/app/features/groups/providers/group-provider.test.tsx`
  - `apps/pwa/app/features/groups/providers/group-provider.cross-device-membership.integration.test.tsx`
  - `apps/pwa/app/features/groups/services/group-service.test.ts`
  - `apps/pwa/app/features/messaging/services/chat-state-store.replace-event.test.ts`
- Added M8 deterministic capture + replay helper surfaces for CP2/CP3 evidence:
  - one-copy community capture helper:
    - `window.obscurM8CommunityCapture.captureJson(400)` in
      `apps/pwa/app/shared/m8-community-capture.ts`
  - deterministic replay bridge:
    - `window.obscurM8CommunityReplay.runConvergenceReplay({ clearAppEvents: true })`
    - `window.obscurM8CommunityReplay.runConvergenceReplayCaptureJson({ clearAppEvents: true })`
    - `apps/pwa/app/shared/m8-community-replay-bridge.ts`
  - replay + capture helpers are installed at app boot in:
    - `apps/pwa/app/components/providers.tsx`
  - focused replay bridge coverage:
    - `apps/pwa/app/shared/m8-community-replay-bridge.test.ts`
- Added CP3 deterministic replay matrix and synced maintainer/status docs:
  - `docs/31-v1.0.10-cp3-community-replay-matrix.md`
  - `docs/08-maintainer-playbook.md`
  - `docs/30-versioned-phase-plan-v1.0.10-v1.1.0.md`
  - `docs/README.md`
  - `ISSUES.md`
- Captured operator replay evidence for the deterministic M8 chain:
  - observed:
    - `groups.membership_ledger_load`
    - `groups.membership_recovery_hydrate`
    - `messaging.chat_state_groups_update`
    - `groups.room_key_missing_send_blocked`
  - expected mismatch reason observed:
    - `target_room_key_missing_after_membership_joined`

### Validation

- `pnpm --dir apps/pwa exec vitest run app/shared/m8-community-replay-bridge.test.ts app/shared/m8-community-capture.test.ts app/features/messaging/services/chat-state-store.replace-event.test.ts app/features/groups/services/community-membership-recovery.test.ts app/features/groups/services/group-service.test.ts app/features/groups/providers/group-provider.test.tsx app/features/groups/providers/group-provider.cross-device-membership.integration.test.tsx`
- `pnpm --dir apps/pwa exec tsc --noEmit --pretty false`
- `pnpm version:check`
- `pnpm docs:check`
- `pnpm release:preflight -- --tag v1.0.10 --allow-dirty true`

## [v1.0.9] - 2026-03-24

### Changed

- Started post-`v1.0.8` `v1.0.9` lane (`M7`) with a CP1 anti-abuse hardening slice on canonical incoming-request owner:
  - added deterministic per-peer cooldown enforcement after burst-limit quarantine in:
    - `apps/pwa/app/features/messaging/services/incoming-request-anti-abuse.ts`
  - anti-abuse decisions now include cooldown diagnostics context:
    - `peerCooldownMs`,
    - `cooldownRemainingMs`,
    - reason code `peer_cooldown_active`.
- Extended incoming request quarantine diagnostics and UI visibility for cooldown outcomes:
  - quarantine event context includes cooldown fields in:
    - `apps/pwa/app/features/messaging/controllers/incoming-dm-event-handler.ts`
  - quarantine summary reason map includes cooldown reason in:
    - `apps/pwa/app/features/messaging/services/incoming-request-quarantine-summary.ts`
  - Requests inbox anti-spam badges now surface sender cooldown counts/labels in:
    - `apps/pwa/app/features/messaging/components/requests-inbox-panel.tsx`
- Added focused regression coverage for M7 CP1 cooldown behavior:
  - `apps/pwa/app/features/messaging/services/incoming-request-anti-abuse.test.ts`
  - `apps/pwa/app/features/messaging/services/incoming-request-quarantine-summary.test.ts`
- Started `M7` CP2 diagnostics slice for incoming request anti-abuse triage:
  - extended cross-device digest summary with:
    - `summary.incomingRequestAntiAbuse` in `apps/pwa/app/shared/log-app-event.ts`
  - extended compact digest event slices with:
    - `messaging.request.incoming_quarantined` context in `apps/pwa/app/shared/log-app-event.ts`
  - extended M0 sync/restore focused-event capture with:
    - `messaging.request.incoming_quarantined` in `apps/pwa/app/shared/m0-triage-capture.ts`
  - updated maintainer replay checks with anti-abuse digest probes in:
    - `docs/08-maintainer-playbook.md`
- Added focused diagnostics regression coverage for M7 CP2:
  - `apps/pwa/app/shared/log-app-event.test.ts`
  - `apps/pwa/app/shared/m0-triage-capture.test.ts`
- Started `M7` CP3 prep with one-copy anti-abuse evidence helper:
  - added `window.obscurM7AntiAbuseCapture.captureJson(400)` in:
    - `apps/pwa/app/shared/m7-anti-abuse-capture.ts`
  - helper is installed during app boot in:
    - `apps/pwa/app/components/providers.tsx`
  - maintainer anti-abuse replay runbook now includes helper usage in:
    - `docs/08-maintainer-playbook.md`
- Added focused regression coverage for M7 CP3 prep helper:
  - `apps/pwa/app/shared/m7-anti-abuse-capture.test.ts`
- Upgraded M7 anti-abuse capture helper with deterministic CP3 gate verdict:
  - `window.obscurM7AntiAbuseCapture.captureJson(400)` now includes
    `antiAbuse.replayReadiness` (reason transition timeline + `readyForCp3Evidence`) in:
    - `apps/pwa/app/shared/m7-anti-abuse-capture.ts`
  - updated maintainer replay checks to include readiness probe in:
    - `docs/08-maintainer-playbook.md`
- Added deterministic M7 anti-abuse replay bridge for CP3 evidence capture:
  - `window.obscurM7AntiAbuseReplay.runPeerCooldownReplay({ clearAppEvents: true })` and
    `window.obscurM7AntiAbuseReplay.runPeerCooldownReplayCaptureJson({ clearAppEvents: true })` in:
    - `apps/pwa/app/shared/m7-anti-abuse-replay-bridge.ts`
  - bridge is installed at app boot in:
    - `apps/pwa/app/components/providers.tsx`
  - added focused replay bridge coverage:
    - `apps/pwa/app/shared/m7-anti-abuse-replay-bridge.test.ts`
  - documented replay matrix:
    - `docs/28-v1.0.9-cp3-anti-abuse-replay-matrix.md`
- Hardened DM "Delete for everyone" target derivation for attachment-heavy/voice-note messages:
  - delete command target generation now derives NIP-17 rumor ids even when `dmFormat` is unavailable on hydrated rows in:
    - `apps/pwa/app/features/main-shell/hooks/use-chat-actions.ts`
  - added attachment-markdown and timestamp-fallback derivation for attachment-only rows to preserve cross-device deletion convergence.
- Added focused regression coverage for DM delete target derivation:
  - `apps/pwa/app/features/main-shell/hooks/use-chat-actions.delete-targets.test.ts`
- Fixed DM sidebar restore regression after `Delete Chat`:
  - selecting a DM conversation now auto-removes it from hidden-chat state, so reopening from contacts/deep-link paths restores sidebar visibility in:
    - `apps/pwa/app/features/messaging/providers/messaging-provider.tsx`
  - added focused hidden-state helpers and tests in:
    - `apps/pwa/app/features/messaging/utils/conversation-visibility.ts`
    - `apps/pwa/app/features/messaging/utils/conversation-visibility.test.ts`
- Refined voice-note card copy for cleaner UI:
  - voice-note cards now display `Voice Notes` instead of raw generated filenames in:
    - `apps/pwa/app/features/messaging/components/voice-note-card.tsx`
  - updated focused component coverage in:
    - `apps/pwa/app/features/messaging/components/voice-note-card.test.tsx`
- Synced roadmap/status docs for `v1.0.9` kickoff and `v1.0.8` closeout:
  - `README.md`
  - `docs/21-post-v1-value-roadmap.md`
  - `docs/25-versioned-phase-plan-v1.0.7-v1.0.9.md`
  - `ISSUES.md`

### Validation

- `pnpm --dir apps/pwa exec vitest run app/features/messaging/services/incoming-request-anti-abuse.test.ts app/features/messaging/services/incoming-request-quarantine-summary.test.ts`
- `pnpm --dir apps/pwa exec vitest run app/shared/log-app-event.test.ts app/shared/m0-triage-capture.test.ts`
- `pnpm --dir apps/pwa exec vitest run app/shared/m7-anti-abuse-capture.test.ts`
- `pnpm --dir apps/pwa exec vitest run app/shared/m7-anti-abuse-replay-bridge.test.ts`
- `pnpm --dir apps/pwa exec vitest run app/features/main-shell/hooks/use-chat-actions.delete-targets.test.ts app/features/messaging/controllers/incoming-dm-event-handler.test.ts`
- `pnpm --dir apps/pwa exec vitest run app/features/messaging/utils/conversation-visibility.test.ts`
- `pnpm --dir apps/pwa exec vitest run app/features/messaging/components/voice-note-card.test.tsx`
- `pnpm --dir apps/pwa exec tsc --noEmit --pretty false`
- `pnpm release:preflight -- --tag v1.0.9`

## [v1.0.8] - 2026-03-23

### Changed

- Started post-`v1.0.7` `v1.0.8` lane (`M6`) with a CP1 small-room voice lifecycle contract slice:
  - added typed bounded session lifecycle contracts in:
    - `apps/pwa/app/features/messaging/services/realtime-voice-session-lifecycle.ts`
  - contract now enforces deterministic create/join/connect/degrade/recover/leave transitions with explicit terminal outcomes.
  - `active` voice-session state now requires explicit peer-session evidence at the contract boundary (no optimistic active transition).
  - unsupported/degraded outcomes are reason-coded and replay-safe:
    - capability unsupported reason propagation,
    - `opus_codec_missing`,
    - `network_degraded`,
    - `transport_timeout`,
    - `peer_evidence_missing`,
    - `recovery_exhausted`.
- Added focused regression coverage for M6 CP1 lifecycle contracts:
  - `apps/pwa/app/features/messaging/services/realtime-voice-session-lifecycle.test.ts`
- Started `M6` CP2 diagnostics slice for realtime-voice degraded/unsupported triage:
  - added canonical transition diagnostics helper in:
    - `apps/pwa/app/features/messaging/services/realtime-voice-session-diagnostics.ts`
  - transition diagnostics emit reason-coded phase evidence under:
    - `messaging.realtime_voice.session_transition`
  - extended cross-device digest summary with:
    - `summary.realtimeVoiceSession` in `apps/pwa/app/shared/log-app-event.ts`
  - extended M0 triage focused-event capture with:
    - `messaging.realtime_voice.session_transition` in `apps/pwa/app/shared/m0-triage-capture.ts`
- Added focused diagnostics regression coverage for M6 CP2:
  - `apps/pwa/app/features/messaging/services/realtime-voice-session-diagnostics.test.ts`
  - `apps/pwa/app/shared/log-app-event.test.ts`
  - `apps/pwa/app/shared/m0-triage-capture.test.ts`
- Updated maintainer replay runbook for M6 CP2 diagnostics capture:
  - `docs/08-maintainer-playbook.md`
- Started `M6` CP3 weak-network replay prep with one-copy diagnostics helper:
  - added `window.obscurM6VoiceCapture.captureJson(400)` in:
    - `apps/pwa/app/shared/m6-voice-capture.ts`
  - helper is installed during app boot in:
    - `apps/pwa/app/components/providers.tsx`
- Added deterministic M6 replay bridge for transition evidence when voice UI path is not yet exposed:
  - `window.obscurM6VoiceReplay.runWeakNetworkReplay()` in:
    - `apps/pwa/app/shared/m6-voice-replay-bridge.ts`
  - bridge is installed during app boot in:
    - `apps/pwa/app/components/providers.tsx`
- Added focused regression coverage for M6 CP3 helper:
  - `apps/pwa/app/shared/m6-voice-capture.test.ts`
  - `apps/pwa/app/shared/m6-voice-replay-bridge.test.ts`
- Added explicit M6 CP3 manual replay matrix:
  - `docs/27-v1.0.8-cp3-voice-replay-matrix.md`
- Captured and accepted M6 CP3 weak-network replay evidence (2026-03-23):
  - replay executed with:
    - `window.obscurM6VoiceReplay.runWeakNetworkReplay()`
  - one-copy bundle captured with:
    - `window.obscurM6VoiceCapture.captureJson(400)`
  - observed deterministic transition chain:
    - `idle -> connecting -> active -> degraded -> connecting -> active`
  - no `recovery_exhausted` terminal signal observed in replay window.
- Synced docs/release status for `v1.0.8` kickoff:
  - `README.md`
  - `docs/25-versioned-phase-plan-v1.0.7-v1.0.9.md`
  - `docs/21-post-v1-value-roadmap.md`
  - `docs/README.md`
  - `ISSUES.md`

### Validation

- `pnpm --dir apps/pwa exec vitest run app/features/messaging/services/realtime-voice-session-lifecycle.test.ts`
- `pnpm --dir apps/pwa exec vitest run app/features/messaging/services/realtime-voice-session-lifecycle.test.ts app/features/messaging/services/realtime-voice-session-diagnostics.test.ts app/shared/log-app-event.test.ts app/shared/m0-triage-capture.test.ts`
- `pnpm --dir apps/pwa exec vitest run app/shared/m6-voice-capture.test.ts`
- `pnpm --dir apps/pwa exec vitest run app/shared/m6-voice-replay-bridge.test.ts`
- `pnpm --dir apps/pwa exec tsc --noEmit --pretty false`
- `pnpm version:sync`

## [v1.0.7] - 2026-03-23

### Changed

- Started post-`v1.0.6` planning lane for `v1.0.7` with a docs-first execution kickoff:
  - added a new version-bound phase plan for `v1.0.7-v1.0.9`:
    - `docs/25-versioned-phase-plan-v1.0.7-v1.0.9.md`
  - synced roadmap and issue status tracking to mark `v1.0.6` (`M4`) closeout and `v1.0.7` (`M5`) kickoff:
    - `docs/21-post-v1-value-roadmap.md`
    - `ISSUES.md`
  - refreshed docs index and root README release/status framing for the new active lane:
    - `docs/README.md`
    - `README.md`
- Started `M5` CP1 implementation slice for community lifecycle convergence in canonical recovery owner:
  - hardened persisted-group dedupe/merge in:
    - `apps/pwa/app/features/groups/services/community-membership-recovery.ts`
  - recovery now keeps richer metadata/member coverage when replay includes newer-but-regressed duplicate group rows.
  - joined-ledger merge now:
    - replaces placeholder `Private Group` display-name drift with richer ledger metadata when available,
    - backfills active-account member coverage when joined ledger evidence exists.
  - emitted recovery diagnostics now include convergence counters:
    - `persistedDuplicateMergeCount`,
    - `placeholderDisplayNameRecoveredCount`,
    - `localMemberBackfillCount`.
- Extended group recovery diagnostics surfacing in runtime event context:
  - `apps/pwa/app/features/groups/providers/group-provider.tsx`.
- Added focused regression coverage for M5 CP1 recovery hardening:
  - `apps/pwa/app/features/groups/services/community-membership-recovery.test.ts`
  - `apps/pwa/app/features/groups/providers/group-provider.test.tsx`
- Started `M5` CP2 diagnostics slice for community lifecycle convergence triage:
  - extended `getCrossDeviceSyncDigest` with:
    - `summary.communityLifecycleConvergence` in `apps/pwa/app/shared/log-app-event.ts`,
  - convergence summary now includes:
    - duplicate-row merge signals,
    - placeholder-name recovery signals,
    - local-member backfill signals,
    - missing-ledger coverage and hidden-by-ledger counters.
- Extended M0 sync-restore focus event coverage:
  - `apps/pwa/app/shared/m0-triage-capture.ts` now includes:
    - `groups.membership_recovery_hydrate`,
    - `groups.membership_ledger_load`.
- Added focused diagnostics regression coverage for M5 CP2:
  - `apps/pwa/app/shared/log-app-event.test.ts`
  - `apps/pwa/app/shared/m0-triage-capture.test.ts`
- Started `M5` CP3 manual evidence lane with a dedicated two-device/account-switch matrix:
  - `docs/26-v1.0.7-cp3-community-convergence-matrix.md`
- Updated maintainer replay runbook for M5 CP3 evidence capture:
  - `docs/08-maintainer-playbook.md`
- Marked M5 CP3 replay evidence as accepted and advanced CP4 release-gate replay for `v1.0.7` in roadmap/status docs:
  - `docs/25-versioned-phase-plan-v1.0.7-v1.0.9.md`
  - `docs/21-post-v1-value-roadmap.md`
  - `ISSUES.md`
- Replayed CP4 release gates in checkpoint workspace:
  - `pnpm version:check`
  - `pnpm docs:check`
  - `pnpm release:integrity-check`
  - `pnpm release:artifact-version-contract-check`
  - `pnpm release:ci-signal-check`
  - `pnpm release:test-pack -- --skip-preflight`
  - `pnpm release:preflight -- --tag v1.0.7 --allow-dirty true`

### Validation

- `pnpm --dir apps/pwa exec vitest run app/features/groups/services/community-membership-recovery.test.ts app/features/groups/providers/group-provider.test.tsx app/features/groups/providers/group-provider.cross-device-membership.integration.test.tsx`
- `pnpm --dir apps/pwa exec vitest run app/shared/log-app-event.test.ts app/shared/m0-triage-capture.test.ts`
- `pnpm --dir apps/pwa exec tsc --noEmit --pretty false`
- `pnpm version:check`
- `pnpm docs:check`
- `pnpm release:integrity-check`
- `pnpm release:artifact-version-contract-check`
- `pnpm release:ci-signal-check`
- `pnpm release:test-pack -- --skip-preflight`
- `pnpm release:preflight -- --tag v1.0.7 --allow-dirty true`

## [v1.0.6] - 2026-03-23

### Changed

- Started post-v1 `M4` stabilization lane (`v1.0.6` milestone) with a narrow high-risk regression slice on in-chat search navigation:
  - extracted typed search-jump decision helpers in:
    - `apps/pwa/app/features/messaging/components/message-search-jump.ts`
  - canonical timeline jump owner now requires dom target materialization before timestamp-fallback jumps are marked resolved:
    - `apps/pwa/app/features/messaging/components/message-list.tsx`
  - unresolved timestamp-fallback paths now emit explicit diagnostics:
    - `messaging.search_jump_unresolved` with `reasonCode: "timestamp_fallback_dom_not_resolved"`.
- Added focused regression coverage for the new jump contracts:
  - `apps/pwa/app/features/messaging/components/message-search-jump.test.ts`.
- Extended cross-device digest triage contracts for M4 diagnostics:
  - `apps/pwa/app/shared/log-app-event.ts` now includes `summary.searchJumpNavigation` in `getCrossDeviceSyncDigest` with risk-level and reason-coded unresolved counters for search-jump replay triage.
- Added M4 soak-evidence capture helper for long-session stabilization replay:
  - introduced `window.obscurM4Stabilization.captureJson(400)` in:
    - `apps/pwa/app/shared/m4-stabilization-capture.ts`
  - helper is installed at app boot in:
    - `apps/pwa/app/components/providers.tsx`
  - helper output includes search-jump summary, recent search-jump event slices, and route/UI responsiveness snapshots for incident bundles.
- Added explicit CP3 manual soak matrix for `v1.0.6`:
  - `docs/24-v1.0.6-cp3-soak-matrix.md`
- Updated docs index for the new CP3 matrix:
  - `docs/README.md`
- Synced roadmap/status/playbook docs with `v1.0.6` CP1/CP2 progress:
  - `docs/21-post-v1-value-roadmap.md`
  - `docs/23-versioned-phase-plan-v1.0.4-v1.0.6.md`
  - `docs/08-maintainer-playbook.md`
  - `ISSUES.md`

### Validation

- `pnpm --dir apps/pwa exec vitest run app/features/messaging/components/message-search-jump.test.ts app/features/messaging/components/chat-view.test.tsx app/shared/log-app-event.test.ts app/shared/m0-triage-capture.test.ts`
- `pnpm --dir apps/pwa exec vitest run app/shared/m4-stabilization-capture.test.ts`
- `pnpm --dir apps/pwa exec tsc --noEmit --pretty false`

## [v1.0.5] - 2026-03-23

### Changed

- Started post-v1 `M3` delivery lane (`v1.0.5` milestone) with a deterministic real-time voice foundation contract:
  - added typed runtime capability classifier in:
    - `apps/pwa/app/features/messaging/services/realtime-voice-capability.ts`
  - capability contract now reports:
    - secure-context readiness,
    - media-device availability,
    - WebRTC peer-connection availability,
    - `addTrack` support,
    - Opus capability status (`available` / `missing` / `unknown`).
- Added focused regression coverage for the new foundation contract:
  - `apps/pwa/app/features/messaging/services/realtime-voice-capability.test.ts`
- Synced post-v1 roadmap/status docs with `v1.0.5` CP1 checkpoint state:
  - `docs/21-post-v1-value-roadmap.md`
  - `docs/23-versioned-phase-plan-v1.0.4-v1.0.6.md`
  - `ISSUES.md`

### Validation

- `pnpm --dir apps/pwa exec vitest run app/features/messaging/services/realtime-voice-capability.test.ts app/features/messaging/services/voice-note-recording-capability.test.ts`
- `pnpm --dir apps/pwa exec tsc --noEmit --pretty false`
- `pnpm version:check`
- `pnpm docs:check`
- `pnpm release:preflight -- --tag v1.0.5`

## [v1.0.4] - 2026-03-23

### Changed

- Advanced post-v1 `M2` closeout with deterministic in-chat search navigation hardening:
  - search jump requests now include timestamp context from search results,
  - timeline jump resolution now supports timestamp-based fallback when direct message-id lookup is unavailable in the currently hydrated/virtualized window,
  - jump path now emits explicit diagnostics for requested/resolved/unresolved outcomes with reason codes and attempt counters:
    - `messaging.search_jump_requested`,
    - `messaging.search_jump_resolved`,
    - `messaging.search_jump_unresolved`.
- Extended observability and triage surfaces for jump failures:
  - added search-jump events to cross-device digest compact event slices in `app/shared/log-app-event.ts`,
  - added search-jump events to M0 triage focus capture in `app/shared/m0-triage-capture.ts`,
  - added dedicated M2 search-jump replay evidence checklist in `docs/08-maintainer-playbook.md`.
- Locked version-bound milestone cadence for next phases (`v1.0.4 -> M2`, `v1.0.5 -> M3`, `v1.0.6 -> M4`) in:
  - `docs/23-versioned-phase-plan-v1.0.4-v1.0.6.md`.

### Validation

- `pnpm --dir apps/pwa exec vitest run app/features/messaging/components/chat-view.test.tsx app/shared/log-app-event.test.ts app/shared/m0-triage-capture.test.ts`
- `pnpm --dir apps/pwa exec tsc --noEmit --pretty false`
- `pnpm version:check`
- `pnpm docs:check`
- `pnpm release:test-pack -- --skip-preflight`
- `pnpm release:preflight -- --tag v1.0.4`

### Operator Note

- Manual CP3 two-device evidence capture was explicitly skipped by operator override for this release pass.

## [v1.0.3] - 2026-03-23

### Changed

- Continued post-v1 `M2` Voice Stage A hardening without introducing new runtime/sync owners:
  - added typed voice-note metadata parsing + search token contracts in:
    - `apps/pwa/app/features/messaging/services/voice-note-metadata.ts`,
    - `apps/pwa/app/features/messaging/services/message-search-index.ts`.
  - chat history search now indexes attachment metadata (including voice-note filename/duration tokens) rather than content-only text:
    - `apps/pwa/app/features/messaging/services/chat-state-store.ts`.
  - chat history search UI now surfaces voice-note-aware result badges with duration metadata and fallback preview text for attachment-only messages:
    - `apps/pwa/app/features/messaging/components/chat-view.tsx`.
  - message timeline audio cards now render voice-note-aware labels and parsed duration chips directly in-bubble (when filename metadata is present):
    - shared attachment presentation metadata: `apps/pwa/app/features/messaging/components/message-attachment-layout.ts`,
    - audio bubble rendering: `apps/pwa/app/features/messaging/components/message-list.tsx`.
  - voice-note playback context polish:
    - `AudioPlayer` now renders a voice-note context row (`Voice Note` + recorded-at label) when parsed metadata is available,
    - timeline and lightbox audio paths now pass typed voice-note metadata into the player from canonical attachment metadata contracts.
  - chat-history search quick filtering:
    - added in-panel quick filters (`All`, `Voice Notes`) to narrow results without leaving chat context,
    - voice filter shows count badge and voice-note-only empty-state copy for faster navigation under larger histories.
  - media gallery voice-note UX polish:
    - added gallery quick filters (`All`, `Images`, `Videos`, `Voice Notes`) with per-filter counts,
    - voice-note audio tiles now show `Voice Note` label + parsed duration (`m:ss`) when metadata is available.
  - fixed attachment-kind inference drift for voice-note recordings:
    - voice-note-prefixed `.webm` filenames are now classified as a dedicated `voice_note` attachment kind (not `video`) in shared attachment inference contracts,
    - markdown attachment extraction now preserves voice-note-prefixed `.webm` entries as `voice_note`.
  - voice-note storage policy hardening:
    - introduced shared attachment storage policy contracts that treat voice notes as temporary audio,
    - outgoing and incoming canonical cache paths now skip Vault/local-media persistence for `voice_note` attachments,
    - encrypted backup attachment parsing now preserves `voice_note` kind across cross-device restore payloads.
  - chat timeline voice-note presentation split:
    - added dedicated minimalist `VoiceNoteCard` component for voice-note attachments in message bubbles,
    - kept uploaded generic audio files on the existing audio-file card, creating a clear visual/behavioral distinction between voice notes and uploaded audio media.
  - theme contrast hardening for light/dark gradient surfaces:
    - added global contrast-safe surface tokens and utility classes in `app/globals.css` (`bg-gradient-surface-contrast`, `text-surface-contrast-primary`, `text-surface-contrast-secondary`, `border-surface-contrast`),
    - updated community invite cards to stop inheriting outgoing-bubble text color (`text-current`) and use explicit contrast-safe text/border styling in both themes,
    - aligned `VoiceNoteCard` with the new global contrast-safe gradient surface tokens.
  - `VoiceRecorder` now emits duration-aware output filenames (`voice-note-<timestamp>-d<seconds>.<ext>`) and a completion diagnostic:
    - `messaging.voice_note.recording_complete`.
  - composer audio preview now labels detected voice notes with parsed duration metadata (`Voice m:ss`) for immediate UX feedback.
- Added focused regression coverage:
  - `apps/pwa/app/features/messaging/services/voice-note-metadata.test.ts`,
  - `apps/pwa/app/features/messaging/services/message-search-index.test.ts`.

### Validation

- `pnpm --dir apps/pwa exec vitest run app/features/messaging/services/voice-note-metadata.test.ts app/features/messaging/services/message-search-index.test.ts`
- `pnpm --dir apps/pwa exec vitest run app/features/messaging/components/chat-view.test.tsx`
- `pnpm --dir apps/pwa exec vitest run app/features/messaging/components/message-attachment-layout.test.ts`
- `pnpm --dir apps/pwa exec vitest run app/features/messaging/services/voice-note-metadata.test.ts`
- `pnpm --dir apps/pwa exec vitest run app/features/messaging/components/chat-view.test.tsx`
- `pnpm --dir apps/pwa exec vitest run app/features/messaging/components/media-gallery.test.tsx`
- `pnpm --dir apps/pwa exec vitest run app/features/messaging/utils/logic.test.ts`
- `pnpm --dir apps/pwa exec tsc --noEmit --pretty false`

## [v1.0.2] - 2026-03-23

### Changed

- Started post-v1 `M2` identity/sync hardening (diagnostics-first, no owner model changes):
  - startup profile-binding bootstrap now emits reason-coded diagnostics when native profile resolution times out or falls back with an error:
    - `runtime.profile_binding_refresh_timeout`,
    - `runtime.profile_binding_refresh_failed`.
  - auto-unlock now emits explicit scope-drift diagnostics when bound-profile startup has to rely on cross-profile fallback remember/token scope:
    - `auth.auto_unlock_scope_drift_detected`.
  - canonical group sendability block path now emits room-key portability mismatch diagnostics:
    - `groups.room_key_missing_send_blocked` includes `reasonCode`, `localRoomKeyCount`, `hasTargetGroupRecord`, `activeProfileId`, and group-key hint sample.
  - canonical backup-restore apply path now emits profile-scope mismatch diagnostics when restore scope diverges from active binding:
    - `account_sync.backup_restore_profile_scope_mismatch` with `reasonCode` (`requested_profile_not_active`, `active_profile_changed_during_restore`, `active_profile_changed_after_apply`) and profile-scope evidence fields.
  - canonical runtime activation owner now emits profile/account scope convergence diagnostics:
    - `runtime.activation.profile_scope_mismatch` with reason codes (`projection_profile_mismatch_bound_profile`, `projection_account_mismatch_identity`, `account_sync_public_key_mismatch_identity`, `runtime_session_public_key_mismatch_identity`) and profile/account suffix context for bound session vs projection/account-sync scope.
  - async voice-note Stage A capability fallback now fails explicitly in unsupported runtimes:
    - `VoiceRecorder` performs typed runtime capability checks before microphone capture,
    - unsupported/start-failure paths emit reason-coded diagnostics (`messaging.voice_note.recording_unsupported`, `messaging.voice_note.recording_start_failed`) instead of silent failure.
  - wired voice-note recording into the canonical composer attachment flow:
    - `main-shell` now passes `onSendVoiceNote` to `ChatView`, routing recorded audio files through existing attachment processing/upload/send paths.
- Added focused regression coverage for this M2-A slice:
  - `app/features/profiles/components/desktop-profile-bootstrap.test.tsx`,
  - `app/features/auth/components/auth-gateway.test.tsx`,
  - `app/features/groups/services/group-service.test.ts`,
  - `app/features/account-sync/services/encrypted-account-backup-service.test.ts`,
  - `app/features/runtime/components/runtime-activation-manager.test.tsx`,
  - `app/features/messaging/services/voice-note-recording-capability.test.ts`,
  - `app/shared/m0-triage-capture.test.ts`,
  - `app/shared/log-app-event.test.ts`.
- Updated post-v1 roadmap/maintainer monitoring docs with new M2 diagnostics probes:
  - `docs/21-post-v1-value-roadmap.md`,
  - `docs/08-maintainer-playbook.md`,
  - `ISSUES.md`.

### Validation

- `pnpm --dir apps/pwa exec vitest run app/features/profiles/components/desktop-profile-bootstrap.test.tsx app/features/auth/components/auth-gateway.test.tsx`
- `pnpm --dir apps/pwa exec tsc --noEmit --pretty false`
- `pnpm docs:check`

## [v1.0.1] - 2026-03-23

### Changed

- Continued post-v1 `M1` delivery with canonical anti-abuse request-ingress hardening:
  - added unknown-sender request burst guard (`per-peer` + `global`) on the canonical incoming DM owner path,
  - added reason-coded quarantine diagnostics (`messaging.request.incoming_quarantined`) and suppression observability,
  - added Requests inbox anti-spam visibility (quarantine summary + per-peer anti-spam signal badges).
- Extended community platform foundation with operator visibility in Group Management:
  - introduced deterministic operator-health summarization for membership/governance signals,
  - added members-tab health cards for active/known/online/offline counts, kick-vote pressure, lifecycle drift, and disband status,
  - added severity-coded operator signal feed (`info` / `warn` / `critical`).
- Completed `M1` closeout automation gate replay and documented remaining manual two-device evidence contract in:
  - `docs/21-post-v1-value-roadmap.md`,
  - `docs/08-maintainer-playbook.md`,
  - `ISSUES.md`.

### Validation

- `pnpm --dir apps/pwa exec vitest run app/features/messaging/services/incoming-request-anti-abuse.test.ts app/features/messaging/services/incoming-request-quarantine-summary.test.ts app/features/messaging/controllers/incoming-dm-event-handler.test.ts app/features/groups/services/community-operator-health.test.ts`
- `pnpm --dir apps/pwa exec tsc --noEmit --pretty false`
- `pnpm docs:check`

## [v1.0.0] - 2026-03-22

### Changed

- Promoted the workspace to the official `v1.0.0` release line with synchronized app/package manifests and release contracts.
- Executed strict release preflight and published the `v1.0.0` tag through the full release workflow.
- Published cross-platform release artifacts for desktop, Android, and web package distribution.
- Added the canonical post-v1 roadmap for long-term value milestones (community expansion, secure voice, anti-abuse, sync resilience, and performance hardening):
  - `docs/21-post-v1-value-roadmap.md`.
- Completed post-v1 `M0` baseline lock:
  - replayed baseline acceptance gates (`version:check`, `docs:check`, `release:test-pack -- --skip-preflight`),
  - added the post-v1 M0 maintainer diagnostics checklist in `docs/08-maintainer-playbook.md`,
  - recorded M0 completion status in `ISSUES.md`.
- Started post-v1 `M1` anti-abuse foundation:
  - added incoming unknown-sender request burst guard (`per-peer` + `global` window) in `incoming-request-anti-abuse`,
  - wired reason-coded quarantine event diagnostics (`messaging.request.incoming_quarantined`) into the canonical incoming DM owner path,
  - added focused regression coverage for guard decisions and inbox-routing behavior,
  - added Requests inbox anti-spam visibility (quarantine summary + per-peer anti-spam signal badges) from canonical app-event diagnostics.
- Extended post-v1 `M1` community platform foundation with operator visibility:
  - added deterministic community operator-health summarization (`community-operator-health`) for active/known membership, online-offline coverage, kick-vote pressure, lifecycle drift, and disband signals,
  - surfaced governance/operator health cards and signal feed in Group Management members tab,
  - added focused helper regression coverage (`community-operator-health.test.ts`).

### Changed (2026-03-22 - v1.0.0 launch staging execution)

- Entered official `v1.0.0` launch staging with deterministic execution docs wired as canonical release path:
  - readiness hardening plan: `docs/19-v1-readiness-stability-plan.md`,
  - launch runbook: `docs/20-v1-official-release-execution.md`.
- Updated top-level status framing to v1 launch readiness and release commands.

### Changed (2026-03-22 - official v1 release execution kickoff)

- Added an explicit official-release runbook for `v1.0.0`:
  - `docs/20-v1-official-release-execution.md`.
- Aligned docs navigation and operator references for v1 launch prep:
  - `docs/README.md`,
  - `docs/07-operations-and-release-flow.md`,
  - `docs/08-maintainer-playbook.md`,
  - `README.md`,
  - `ISSUES.md`.
- This locks the release path to deterministic R0-R4 execution (freeze, automated gates, manual matrix, tag/publish, post-release stabilization window).

### Changed (2026-03-22 - v1 readiness M2 manual soak closure)

- Completed and confirmed the M2 manual two-device soak acceptance bundle:
  - DM continuity,
  - group membership/sendability,
  - media parity,
  - delete-for-everyone no-resurrection.
- Updated readiness tracking to move M2 from pending to complete in active docs.

### Changed (2026-03-22 - chat timeline scroll smoothness hardening)

- Improved chat scrolling responsiveness for large message timelines without introducing new lifecycle/sync owners:
  - stabilized `MessageList` props from `ChatView` with callback memoization to reduce avoidable list rerenders,
  - memoized `MessageList` with an explicit prop comparator,
  - added stable virtualizer item keys (`message.id`) for better prepend/load-more stability,
  - tuned fast-scroll behavior:
    - reduced overscan under fast-scroll mode,
    - suspended dynamic row measurement during fast-scroll bursts to reduce layout thrash,
  - replaced attachment-local-index effect/setState pass with memoized derivation to avoid an extra render cycle per message refresh,
  - disabled expensive bubble transition animations while high-load mode is active.
- Validation:
  - `pnpm -C apps/pwa exec vitest run app/features/messaging/components/chat-view.test.tsx app/features/messaging/components/message-list-scroll.test.ts`
  - `pnpm -C apps/pwa exec tsc --noEmit --pretty false`
  - `pnpm release:test-pack -- --skip-preflight`

### Changed (2026-03-21 - v1 readiness M3 strict preflight replay)

- Advanced pre-v1 hardening into M3 with a clean-tree strict preflight replay:
  - `pnpm release:preflight -- --tag v1.0.0`.
- Result:
  - preflight checks passed for release integrity, artifact contracts, version alignment, docs checks, and CI signal contracts.
- Remaining gate:
  - manual replay matrix evidence for M2 two-device acceptance before v1 tag planning.

### Changed (2026-03-21 - v1 readiness stability kickoff)

- Added the pre-v1 hardening roadmap:
  - `docs/19-v1-readiness-stability-plan.md`.
- Consolidated docs navigation and triage reading order to include the new v1 readiness plan:
  - `docs/README.md`.
- Updated monitoring framing from `v0.9.4` release-candidate language to `v0.9.5 -> v1` readiness:
  - `ISSUES.md`.

### Changed (2026-03-21 - v1 readiness M1 automated reliability replay)

- Started M1 session/route hardening soak with focused automated reliability replay:
  - `auth-gateway`,
  - `auth-screen`,
  - `app-shell`,
  - `mobile-tab-bar`,
  - desktop `title-bar-profile-switcher`.
- Validation:
  - `pnpm -C apps/pwa exec vitest run app/features/auth/components/auth-gateway.test.tsx app/features/auth/components/auth-screen.test.tsx app/components/app-shell.test.tsx app/components/mobile-tab-bar.test.tsx app/components/desktop/title-bar-profile-switcher.test.ts`
  - `5 files / 21 tests passed`.
- Remaining M1 gate:
  - manual desktop/web restart + route-liveness soak under live relay conditions.

### Changed (2026-03-21 - v1 readiness M1 manual soak closure + M2 automated replay)

- M1 manual soak closure recorded:
  - desktop/web restart continuity remained stable,
  - route-transition stress replay remained stable.
- Started M2 cross-device sync/deletion soak with focused automated replay:
  - `log-app-event`,
  - `encrypted-account-backup-service`,
  - `incoming-dm-event-handler`,
  - `use-conversation-messages.integration`,
  - `message-persistence-service`,
  - `message-delete-tombstone-store`,
  - `runtime-messaging-transport-owner-provider`.
- Validation:
  - `pnpm -C apps/pwa exec vitest run app/shared/log-app-event.test.ts app/features/account-sync/services/encrypted-account-backup-service.test.ts app/features/messaging/controllers/incoming-dm-event-handler.test.ts app/features/messaging/hooks/use-conversation-messages.integration.test.ts app/features/messaging/services/message-persistence-service.test.ts app/features/messaging/services/message-delete-tombstone-store.test.ts app/features/messaging/providers/runtime-messaging-transport-owner-provider.test.tsx`
  - `7 files / 111 tests passed`.
- Remaining M2 gate:
  - manual two-device replay for DM continuity, group sendability, media parity, and delete no-resurrection.

### Fixed (2026-03-21 - group delete-for-everyone convergence in community chats)

- Hardened group message deletion propagation to follow the canonical chat-state owner path:
  - incoming group delete events (`kind:5`) now emit `message_deleted` through MessageBus for each target message id,
  - local group delete action path (`useSealedCommunity.deleteMessage`) now also emits MessageBus delete events after relay publish confirmation.
- This aligns community deletion behavior with DM deletion convergence semantics so recipient UIs apply removal reliably from the same event stream.
- Added focused integration regression coverage:
  - `apps/pwa/app/features/groups/hooks/use-sealed-community.integration.test.ts`
    - verifies delete-event bus emission on replay,
    - verifies local group delete publishes kind 5 and emits bus removal.
- Validation:
  - `pnpm -C apps/pwa exec vitest run app/features/groups/hooks/use-sealed-community.integration.test.ts app/features/messaging/hooks/use-conversation-messages.integration.test.ts`
  - `pnpm -C apps/pwa exec tsc --noEmit --pretty false`

### Fixed (2026-03-21 - v0.9.5 M2 deletion convergence hardening)

- Landed dual deletion modes in chat UX with explicit ownership boundaries:
  - `Delete for me` (local visibility removal),
  - `Delete for everyone` (sender-only authority + remote sync intent).
- Hardened cross-device deletion convergence so recipient-side removal can resolve multiple identifiers per message:
  - direct payload id,
  - `e`-tag references,
  - derived fallback rumor/event ids for NIP-17 sparse cases.
- Fixed deletion resurrection drift during projection/hydration replay:
  - added persistent, profile-scoped deletion tombstones and enforced filtering at canonical conversation hydration/merge surfaces.
- Added focused regression coverage for:
  - incoming delete-command id matching,
  - persistent tombstone storage semantics,
  - conversation hydration integration,
  - persistence replay behavior.
- Validation snapshot:
  - targeted messaging regression suites are green (`7 files / 50 tests`),
  - `pnpm -C apps/pwa exec tsc --noEmit --pretty false` is green.

### Changed (2026-03-21 - v0.9.5 M0 execution started)

- Started `M0` execution with a docs-first scope lock to avoid disruptive architectural drift.
- Added the explicit `v0.9.5` release-candidate manual replay checklist to:
  - `docs/08-maintainer-playbook.md`.
- Reinforced first-response triage contract for runtime incidents:
  - `copy(window.obscurM0Triage?.captureJson(300))`.

### Changed (2026-03-21 - v0.9.5 M1 guardrails started)

- Started `M1` execution for session continuity + route-liveness guardrails without adding lifecycle owners.
- Added focused regression coverage for private-key remember-me continuity in key-import + skip-password flow:
  - `apps/pwa/app/features/auth/components/auth-screen.test.tsx`.
- Revalidated focused M1 suites:
  - `auth-gateway`,
  - `auth-screen`,
  - `app-shell`,
  - `mobile-tab-bar`,
  - desktop `title-bar-profile-switcher`.

### Changed (2026-03-21 - v0.9.5 M2 diagnostics-first sync-confidence kickoff)

- Started `M2` execution without adding new sync owners or parallel restore mutation paths.
- Expanded cross-device digest event coverage in `log-app-event` for:
  - DM continuity drift (`messaging.conversation_hydration_diagnostics`, `messaging.conversation_hydration_id_split_detected`, `messaging.legacy_migration_diagnostics`),
  - membership/sendability drift (`groups.room_key_missing_send_blocked`, `messaging.chat_state_groups_update`),
  - existing restore/hydration/account-sync signals.
- Added compact summary risk signals in `window.obscurAppEvents.getCrossDeviceSyncDigest(...)`:
  - `summary.selfAuthoredDmContinuity`,
  - `summary.membershipSendability`,
  - `summary.mediaHydrationParity`.
- Added account-sync media-parity evidence fields at canonical restore boundaries:
  - hydrate/merge/apply diagnostics now include DM/group attachment counts,
  - `account_sync.backup_restore_history_regression` now includes attachment-drop deltas.
- Added focused regression coverage:
  - `apps/pwa/app/shared/log-app-event.test.ts`,
  - `apps/pwa/app/features/account-sync/services/encrypted-account-backup-service.test.ts`.

### Changed (2026-03-21 - v0.9.5 M2 risk-level matrix + M3 vault contrast kickoff)

- Extended M2 digest verification with deterministic media-parity risk-level coverage:
  - `mediaHydrationParity` now has focused `watch` and `none` scenario tests in:
    - `apps/pwa/app/shared/log-app-event.test.ts`.
- Started M3 with a low-risk Vault UI polish slice (class-level only, no lifecycle/owner changes):
  - improved Light-mode readability for Vault filter/pagination controls,
  - improved at-rest visibility of close/action/zoom/reset controls in Vault media detail overlay,
  - preserved existing media interaction behavior (open, zoom, favorite, flush cache).
- Validation:
  - `pnpm -C apps/pwa exec tsc --noEmit --pretty false`,
  - `pnpm -C apps/pwa build`,
  - `pnpm release:test-pack -- --skip-preflight`.

### Changed (2026-03-21 - v0.9.5 M3 shared media-control visibility follow-up)

- Improved shared media viewer control visibility for Light mode without changing runtime ownership:
  - updated Light-theme media control tokens in `apps/pwa/app/globals.css` (`--media-control-*`) for stronger at-rest contrast,
  - added explicit themed control-cluster container styling in chat lightbox:
    - `apps/pwa/app/features/messaging/components/lightbox.tsx`.
- Added an additional high-traffic light-mode contrast fix:
  - `apps/pwa/app/features/messaging/components/new-chat-dialog.tsx` now uses theme-safe card border tokens.
- Kept dark-mode behavior intact via existing dark token overrides.
- Minor Vault UI text cleanup:
  - normalized overlay metadata separator in `apps/pwa/app/features/vault/components/vault-media-grid.tsx`.
- Validation:
  - `pnpm -C apps/pwa exec tsc --noEmit --pretty false`,
  - `pnpm -C apps/pwa build`,
  - `pnpm release:test-pack -- --skip-preflight`.

### Changed (2026-03-21 - v0.9.5 M3 inline media player contrast follow-up)

- Extended M3 light-mode readability polish to inline chat media playback surfaces without changing playback behavior owners:
  - `apps/pwa/app/features/messaging/components/audio-player.tsx` now uses theme-safe light/dark control surfaces with stronger non-hover readability for timeline, volume, and external-open controls.
  - `apps/pwa/app/features/messaging/components/video-player.tsx` now uses theme-safe light/dark control-dock and error-panel contrast for play/seek/volume/fullscreen interactions.
- Minor cleanup:
  - removed unused `Button` imports from `audio-player` and `video-player`.
- Validation:
  - `pnpm -C apps/pwa exec tsc --noEmit --pretty false`,
  - `pnpm -C apps/pwa build`,
  - `pnpm release:test-pack -- --skip-preflight`.

### Changed (2026-03-21 - v0.9.5 M4 stabilization gate replay started)

- Started `M4` release-stabilization execution with automated gate replay (no architecture changes).
- Current automated gate snapshot is green:
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
  - `pnpm release:preflight -- --tag v0.9.5` currently fails fast until the working tree is clean.
- Remaining before tag-preflight:
  - manual M1/M2/M3 replay matrix,
  - clean-tree `pnpm release:preflight -- --tag v0.9.5`.

### Fixed (2026-03-21 - v0.9.5 M4 hook-order crash regression)

- Fixed a runtime crash in `NostrMessengerContent` (`Rendered fewer hooks than expected`) caused by hook declarations placed after conditional early returns:
  - moved chat-list memo hooks in `apps/pwa/app/features/main-shell/main-shell.tsx` above `loading`/`lock-screen` early-return branches to keep hook order stable across identity state transitions.
- Added focused regression coverage:
  - `apps/pwa/app/features/main-shell/main-shell.test.tsx` validates rerender transitions `unlocked -> loading -> unlocked` without hook-order failure.
- Validation:
  - `pnpm -C apps/pwa exec vitest run app/features/main-shell/main-shell.test.tsx`,
  - `pnpm -C apps/pwa exec tsc --noEmit --pretty false`,
  - `pnpm -C apps/pwa build`.

### Changed (2026-03-21 - v0.9.5 keyboard dismissal and preview navigation polish)

- Added deterministic `Escape` dismissal behavior for active overlays/menus before shell-level navigation:
  - chat history-search panel, message menu, reaction picker, media gallery, and lightbox now close via `Escape`,
  - vault item context menu and vault media preview overlay now close via `Escape`.
- Added shell-level `Escape` back-navigation guard in `app-shell`:
  - when no dismissable layer is open and current route is not root, `Escape` navigates back to previous history entry (fallback to `/` when needed),
  - avoids triggering back-navigation from editable text targets and while dismissable layers are active.
- Added keyboard media switching in Vault preview:
  - `ArrowLeft` / `ArrowRight` now switch to previous/next selected media item in the active Vault list.
- Added focused regression coverage:
  - `app/components/app-shell.test.tsx` (`Escape` back behavior + dismissable-layer guard),
  - `app/features/messaging/components/chat-view.test.tsx` (`Escape` closes history search panel).
- Validation:
  - `pnpm -C apps/pwa exec vitest run app/components/app-shell.test.tsx app/features/messaging/components/chat-view.test.tsx`,
  - `pnpm -C apps/pwa exec tsc --noEmit --pretty false`,
  - `pnpm -C apps/pwa build`.

### Changed (2026-03-21 - v0.9.5 immersive media-preview theming polish)

- Refined media preview ambience to align with app theme and improve depth/focus:
  - added theme-aware preview backdrop tokens in `apps/pwa/app/globals.css`:
    - `--media-preview-backdrop`,
    - `--media-preview-depth-layer`,
    - with reusable utility classes `media-preview-backdrop` and `media-preview-depth-layer`.
- Applied immersive light/dark backdrop treatment to chat media lightbox:
  - `apps/pwa/app/features/messaging/components/lightbox.tsx`,
  - light mode now uses a bright gradient ambience; dark mode retains cinematic dark depth.
- Applied the same theme-aware backdrop and stage-surface polish to Vault preview overlay:
  - `apps/pwa/app/features/vault/components/vault-media-grid.tsx`.
- Validation:
  - `pnpm -C apps/pwa exec tsc --noEmit --pretty false`,
  - `pnpm -C apps/pwa build`.

### Changed (2026-03-21 - v0.9.5 roadmap kickoff)

- Added and executed the concrete non-disruptive execution roadmap for `v0.9.5`.
- Documented explicit pre-v1 constraints in the roadmap:
  - no major overhauls,
  - no new lifecycle/sync owners,
  - no parallel mutation pipelines.
- Consolidated the roadmap's operational content into standard docs:
  - `docs/07-operations-and-release-flow.md`,
  - `docs/08-maintainer-playbook.md`,
  - `docs/README.md`.

### Changed (2026-03-21 - v0.9.4 release-candidate prep baseline)

- Bumped release-tracked manifests from `0.9.2` to `0.9.4` and synchronized:
  - root workspace + `version.json`,
  - `apps/pwa`, `apps/desktop` (+ Tauri config), `apps/website`, `apps/relay-gateway`,
  - `packages/dweb-*` and `packages/ui-kit`.
- Updated top-level status docs to remove stale "active unresolved v0.9.2 blocker" framing and align with current monitoring/verification state.
- Verified release readiness gates in this workspace snapshot:
  - `pnpm docs:check`,
  - `pnpm release:integrity-check`,
  - `pnpm release:artifact-version-contract-check`,
  - `pnpm release:ci-signal-check`,
  - `pnpm release:test-pack -- --skip-preflight`,
  - `pnpm -C apps/pwa exec vitest run`,
  - `pnpm -C apps/pwa build`.

### Historical Known Issues (2026-03-20 - v0.9.2 constrained release)

- v0.9.2 was released with unresolved critical regressions due schedule constraints.
- Confirmed unresolved runtime risks:
  - login-state persistence remains unreliable in some restart flows,
  - page-transition freeze/sidebar lock can still occur,
  - infinite loading loops remain reproducible in some startup/profile-disruption paths,
  - cross-device self-authored DM history loss can recur,
  - historical media hydration may diverge between desktop and web.
- Canonical problem record:
  - `ISSUES.md` (active incident truth),
  - `docs/17-v0.9.2-expansion-context.md` (next-iteration handoff baseline).

### Changed (2026-03-21 - v0.9.3 manual acceptance closure snapshot)

- Manual acceptance replay for the v0.9.3 plan was completed on the dev server:
  - M1 restart/login continuity and route-transition stress replay completed,
  - M2 two-device DM/community/media parity replay completed,
  - M4 responsiveness replay completed for route transitions and heavy-thread interaction windows.
- Plan documentation now records manual-gate closure explicitly in `docs/18-v0.9.3-execution-plan.md`.
- `ISSUES.md` was moved from "active unresolved blocker baseline" to a resolved/monitoring snapshot for future iterations.
- Release note caveat:
  - this closure reflects dev-server/manual verification status and does not replace normal release-candidate soak and production telemetry monitoring.

### Changed (2026-03-20 - v0.9.3 M0 baseline triage kickoff)

- Added a one-shot runtime triage capture helper at `window.obscurM0Triage`:
  - `capture(eventWindowSize?)` returns structured startup/relay/sync/media diagnostics.
  - `captureJson(eventWindowSize?)` returns copy-ready JSON for incident handoff.
- Added canonical focused-event grouping for M0 triage:
  - startup,
  - navigation,
  - sync_restore,
  - media_hydration.
- Boot-time install is now wired in `AppProviders` so capture is available immediately after app startup.
- Added focused unit coverage in `app/shared/m0-triage-capture.test.ts`.
- Verification:
  - `pnpm docs:check` passes.
  - `pnpm release:test-pack -- --skip-preflight` passes.

### Changed (2026-03-20 - v0.9.3 M1 session continuity hardening slice)

- Added native-session auto-unlock retry path in `AuthGateway` for startup windows where remember-me is set but passphrase token candidates are absent:
  - new evidence event: `auth.auto_unlock_recovered_native_session`.
- Hardened desktop `Lock` semantics in title-bar profile switcher:
  - lock now preserves remembered auth token when remember-me is enabled for the bound profile,
  - lock still clears auth token when remember-me is disabled.
- Hardened profile-boot stall recovery:
  - startup stall fallback now always provides deterministic `Continue to Login` recovery instead of forcing a keep-waiting path while identity remains loading.
- Added focused regression coverage:
  - `app/features/auth/components/auth-gateway.test.tsx`,
  - `app/components/desktop/title-bar-profile-switcher.test.ts`,
  - `app/features/auth/utils/remember-me-state.ts` (new helper module).
- Verification:
  - `pnpm -C apps/pwa exec tsc --noEmit --pretty false` passes.
  - `pnpm -C apps/pwa exec vitest run app/features/auth/components/auth-gateway.test.tsx app/components/desktop/title-bar-profile-switcher.test.ts app/features/auth/hooks/use-identity.test.ts app/shared/m0-triage-capture.test.ts` passes.
  - `pnpm docs:check` passes.
  - `pnpm release:test-pack -- --skip-preflight` passes.
  - `pnpm -C apps/pwa build` passes.

### Changed (2026-03-20 - v0.9.3 M2 self-authored DM continuity hardening slice)

- Hardened encrypted-backup DM hydration for legacy sparse metadata records:
  - added a canonical DM direction resolver in `encrypted-account-backup-service.ts` for indexed/queue records,
  - outgoing classification now accepts recipient + conversation evidence when `senderPubkey`/`pubkey` and `isOutgoing` are missing,
  - hydrated persisted DM messages now backfill sender pubkey for inferred direction so downstream replay and merge diagnostics do not collapse into incoming-only histories.
- Added focused M2 regression coverage:
  - `encrypted-account-backup-service.test.ts` now includes a deterministic legacy record scenario with missing sender metadata that must restore one outgoing and one incoming message using recipient + conversation inference.
- Verification:
  - `pnpm -C apps/pwa exec vitest run app/features/account-sync/services/encrypted-account-backup-service.test.ts` passes.
  - `pnpm docs:check` passes.
  - `pnpm release:test-pack -- --skip-preflight` passes.

### Changed (2026-03-20 - v0.9.3 M3 delivery-truth hardening slice)

- Hardened queued DM terminal-failure semantics in `outgoing-dm-publisher.ts`:
  - when deterministic evidence-backed publish APIs are unavailable (`unsupported_runtime`), queued send now persists message status as `failed` before returning terminal failure.
- Added focused regression coverage:
  - `outgoing-dm-publisher.test.ts` now asserts unsupported queued publish path writes `failed` status and does not requeue.
- Added focused native-session mismatch diagnostics coverage:
  - `use-identity.test.ts` now verifies native-session account mismatch remains explicit (`native_mismatch`) and keeps identity locked.
- Added explicit mismatch recovery UX in auth login:
  - `AuthScreen` now renders a dedicated `Private Key Mismatch` recovery card when identity diagnostics surface `private_key_mismatch` (or equivalent mismatch message evidence), without conflating it with native secure-storage mismatch recovery.
  - Added focused component regression coverage in `app/features/auth/components/auth-screen.test.tsx` for both mismatch banners.
- Hardened lock-screen private-key unlock recoverability:
  - `unlockWithPrivateKeyHex` mismatch now keeps identity in recoverable `locked` state while preserving `private_key_mismatch` diagnostics, instead of escalating to runtime `error`.
  - Aligned passphrase mismatch handling to preserve locked-state diagnostics ordering on mismatch transitions.
  - Added deterministic `use-identity.test.ts` coverage for raw private-key mismatch and successful raw-key unlock paths.
- Enriched DM send transport diagnostics:
  - `messaging.transport.publish_result` now includes explicit evidence context (`status`, `reasonCode`, `metQuorum`, `quorumRequired`, `targetRelayCount`, `hasOverallError`) to improve degraded-send triage.
- Verification:
  - `pnpm -C apps/pwa exec vitest run app/features/messaging/controllers/outgoing-dm-publisher.test.ts` passes.
  - `pnpm -C apps/pwa exec vitest run app/features/auth/hooks/use-identity.test.ts` passes.
  - `pnpm -C apps/pwa exec vitest run app/features/auth/components/auth-screen.test.tsx` passes.

### Changed (2026-03-20 - v0.9.3 M4 sidebar/chat-list performance polish slice)

- Reduced sidebar/chat-list render pressure without changing product behavior:
  - `Sidebar` now derives hidden/pinned/direct/community buckets and unread totals in one memoized pass using Set-backed lookups instead of repeated filter/reduce + `includes` scans.
  - `main-shell` chat unread badge aggregation now uses memoized hidden-ID filtering and memoized unread reduction.
- Reduced message-list row churn during interaction-heavy chat usage:
  - `MessageList` now passes row-local state flags (`isFlashing`, `isMessageMenuAnchored`, `isReactionPickerAnchored`) into memoized rows instead of global id selectors, avoiding unnecessary re-renders across unrelated visible rows when menus/reaction pickers open.
- Reduced message-list scroll event pressure under fast scrolling:
  - `MessageList` now batches scroll metrics with `requestAnimationFrame` and evaluates scroll-bottom/fast-scroll state at most once per frame.
  - Added typed helper contract in `app/features/messaging/components/message-list-scroll.ts` and focused unit coverage in `message-list-scroll.test.ts`.
- Reduced duplicate payload parsing in message timelines:
  - `MessageList` now caches parsed JSON payloads once per message list update and reuses them for invite-response status and row render metadata, removing redundant parse work on heavy threads.
- Reduced attachment/media derivation overhead in message rows:
  - Added typed helper contracts in `app/features/messaging/components/message-attachment-layout.ts` to classify media buckets and derive attachment display metadata in one pass.
  - `MessageAttachmentLayout` now memoizes those derived buckets/maps, avoiding repeated filter passes and repeated URL host parsing during row re-renders.
  - Added focused coverage in `app/features/messaging/components/message-attachment-layout.test.ts`.
- Reduced message-list full-pass churn in render metadata derivation:
  - Added typed helper contract in `app/features/messaging/components/message-list-render-meta.ts` to build parsed payload cache, invite-response mapping, and per-message render metadata in a single traversal.
  - `MessageList` now uses the unified cache instead of separate full-list loops for payload parse, invite status derivation, and row render metadata.
  - Added focused coverage in `app/features/messaging/components/message-list-render-meta.test.ts`.
- Reduced periodic visible-row rerenders in chat timelines:
  - `MessageList` now computes per-row `timeLabel` before row rendering and memoized rows compare on `timeLabel` instead of raw `nowMs`.
  - This keeps timestamp UX unchanged while avoiding row rerenders on clock ticks when the displayed label remains the same.
- Reduced sidebar conversation-list churn on periodic clock updates:
  - `ConversationRow` is now memoized with field-level equality for rendered props.
  - `Sidebar` now passes precomputed timestamp labels and stable action handlers (`togglePin`, `deleteConversation`) instead of per-row closures.
  - This avoids unnecessary row rerenders when 30-second clock updates do not change displayed labels.
- Added route-stall hard-fallback parity for mobile navigation:
  - `MobileTabBar` now arms the same deterministic hard-navigation fallback contract used by desktop sidebar navigation and clears the fallback once pathname settles.
  - Route-guard diagnostics now include mobile source attribution (`guardSource: "mobile_tab_bar"`).
  - Added focused tests in `app/components/mobile-tab-bar.test.tsx` for hard fallback timeout and settle cancellation.
- Added route-mount settle diagnostics for freeze triage in canonical app-shell navigation:
  - `AppShell` now emits route mount probe events (`navigation.route_mount_probe_start`, `navigation.route_mount_probe_slow`, `navigation.route_mount_probe_settled`) with frame-delay and route-request elapsed metadata.
  - Route diagnostics now include deterministic surface tagging (`routeSurface`: `chats`/`network`/`groups`/...) plus source tags for route-guard events (`fromRouteSurface`, `targetRouteSurface`) to speed freeze triage by page family.
  - Route-guard events emitted from desktop/sidebar navigation now include source attribution (`guardSource: "app_shell"`), matching mobile diagnostics parity.
  - Added lightweight runtime snapshot surface at `window.obscurRouteMountDiagnostics?.getSnapshot?.()` and wired M0 triage capture to include this snapshot and route-mount probe events in navigation-focused diagnostics.
- Regression and safety verification:
  - `pnpm -C apps/pwa exec vitest run app/features/messaging/components/sidebar.test.tsx` passes.
  - `pnpm -C apps/pwa exec vitest run app/features/messaging/components/message-attachment-layout.test.ts` passes.
  - `pnpm -C apps/pwa exec vitest run app/features/messaging/components/message-list-render-meta.test.ts` passes.
  - `pnpm -C apps/pwa exec vitest run app/components/page-transition-recovery.test.ts app/components/app-shell.test.tsx app/shared/m0-triage-capture.test.ts` passes.
  - `pnpm -C apps/pwa exec vitest run app/components/app-shell.test.tsx app/components/mobile-tab-bar.test.tsx` passes.
  - `pnpm -C apps/pwa exec vitest run app/features/messaging/components/message-list-scroll.test.ts app/features/messaging/components/chat-view.test.tsx app/features/messaging/components/sidebar.test.tsx` passes.
  - `pnpm -C apps/pwa exec tsc --noEmit --pretty false` passes.

### Changed (2026-03-20 - CI reliability gate and planning artifact retirement)

- **CI/workflow blocker fixes (release test pack)**:
  - fixed startup watchdog telemetry typing in `app/components/providers.tsx` to avoid `undefined` context payloads during strict typecheck.
  - fixed deferred replay resolver typing in `account-projection-runtime.test.ts` to remove `never` call regression under `tsc --noEmit`.
  - fixed IndexedDB blocked-event typing in `open-identity-db.test.ts` for strict `IDBVersionChangeEvent` contract.
  - hardened chat-state replacement diagnostics in `chat-state-store.ts` for optional group-message maps.
  - made runtime activation relay-runtime gate fail-open when mocked/test snapshots omit `relayRuntime`, removing render-time crashes in `runtime-activation-transport-gate.integration.test.tsx`.
  - aligned `use-conversation-messages.test.ts` with the current `200`-message live-window cap contract.
  - verification: `pnpm release:test-pack -- --skip-preflight` passes.
- **Release publication policy update**:
  - `.github/workflows/release.yml` now auto-publishes on `v*` tag push after artifact verification succeeds.
  - manual `workflow_dispatch` with `publish_release=true` remains as fallback for publish repair/rerun.
- **Planning artifact retirement (completed lane cleanup)**:
  - removed root planning files:
    - `PHASE0_SPECS.md` .. `PHASE4_SPECS.md`
    - `ROADMAP_v0.9.0-beta.md`
    - `ROADMAP_v0.9.2.md`
  - `/docs` + `ISSUES.md` remain the canonical planning/handoff source for this lane.
- **Documentation sync**:
  - updated `README.md`, `docs/README.md`, and `docs/17-v0.9.2-expansion-context.md` to reflect current CI gate status and retired root planning artifacts.

### Changed (2026-03-19 - v0.9.2 context and reliability documentation pass)

- **Version alignment moved to `v0.9.2`**:
  - updated release-tracked manifests to `0.9.2` (root workspace, apps, packages, tauri config, `version.json`).
- **Documentation truth-map correction**:
  - removed stale warm-up-owner guidance from active architecture docs and replaced it with current startup owner chain:
    - `DesktopProfileBootstrap` -> `AuthGateway` -> `ProfileBoundAuthShell` -> `UnlockedAppRuntimeShell` -> `RuntimeActivationManager`.
  - refreshed runtime failure atlas and owner index to match live code paths.
- **Future-iteration handoff context**:
  - added `docs/17-v0.9.2-expansion-context.md` with stable foundations, known fragile areas, required runtime capture, and next-iteration order.
- **Incident status updates**:
  - updated cross-device group visibility incident doc from unresolved to mitigated/monitoring with explicit residual-risk boundaries.

### Changed (2026-03-18 - v0.9.1 release lane)

- **Release pipeline unblocking for desktop/web publication**:
  - Updated `.github/workflows/release.yml` so `verify-artifacts` and manual `publish-release` can proceed when Android lane fails, while still enforcing Android APK/AAB artifacts when Android lane succeeds.
  - Added explicit release evidence fields in workflow summary:
    - `android_job_result`,
    - `android_signing_state`,
    - `ios_lane_state`.
  - Kept tag-triggered build/verify and manual-only publish model unchanged.

- **Desktop storage settings reliability**:
  - Hardened local vault storage-path operations so Settings `Open` first ensures the configured directory exists.
  - Added native desktop fallback command `desktop_open_storage_path` for folder open operations when plugin-shell path open fails.
  - Hardened `Change Folder` UX to validate selected paths immediately and rollback to previous config when path initialization fails.

### Changed (2026-03-18 - v0.9.2 sync lane start)

- **Emergency desktop startup rollback (2026-03-19)**:
  - Removed warm-up ownership from the live provider chain (`AppProviders` no longer mounts `WarmUpGate`).
  - Removed warm-up runtime implementation files from this workspace state pending redesign.
  - Startup/runtime activation now converges through the pre-warm-up owner path (`DesktopProfileBootstrap` -> `AuthGateway` -> `UnlockedAppRuntimeShell`), preventing warm-up overlay/banner ownership from blocking navigation while relay recovery continues.

- **Encrypted backup ordering hardening for cross-device account sync**:
  - Added deterministic monotonic backup event `created_at` generation per account pubkey to prevent equal-second replaceable backup collisions.
  - Added backup payload timestamp tag (`obscur_backup_created_at_ms`) on encrypted account backup events.
  - Updated backup event selection comparator to prefer payload timestamp tag, then `created_at`, then event id for deterministic newest-wins behavior.
  - Added focused regression coverage in `encrypted-account-backup-service.test.ts` for rapid consecutive backup publishes.
  - Hardened backup restore selection to wait for `EOSE` across all open relay candidates in the active pool before settling latest-event choice, reducing stale-first-relay restore picks.
  - Added regression coverage for mixed-speed relay responses to ensure newest backup snapshots still win when older candidates finish first.
  - Added account-sync ordering diagnostics at canonical backup boundaries:
    - `account_sync.backup_publish_ordering` now reports payload/event timestamps, monotonic bump metadata, and relay-scope counts for each encrypted backup publish.
    - `account_sync.backup_restore_selection` now reports pool/direct selection source, EOSE/candidate counts, timeout state, and chosen backup event metadata for restore triage.
  - Added focused diagnostics assertions in `encrypted-account-backup-service.test.ts` for publish-ordering and restore-selection instrumentation.
  - Finalized community membership recovery source precedence contract (`tombstone -> membership ledger -> persisted chat state`) in a dedicated recovery resolver.
  - Updated `GroupProvider` hydration to use the canonical precedence resolver and to backfill joined ledger entries only when ledger coverage is missing, preventing stale persisted groups from re-promoting `left` membership state.
  - Added focused regression coverage for precedence behavior:
    - `community-membership-recovery.test.ts` (contract-level precedence and diagnostics),
    - `group-provider.test.tsx` (persisted group suppressed when ledger status is `left`).
  - Added cross-device membership reconstruction path for backup restores:
    - `community-membership-reconstruction` now derives supplemental joined membership evidence from backup chat-state groups and accepted community invite response payloads in DM history.
    - encrypted backup merge now applies reconstruction as a missing-coverage supplement only and never uses it to override explicit membership ledger status (for example `left` / `expelled`).
  - Hardened cross-device community list restore when membership ledger drifts from chat evidence:
    - membership reconstruction now also derives joined evidence from persisted `groupMessages` timelines (not only `createdGroups` / accepted invite responses), so joined communities can be recovered even when group metadata rows are missing.
    - backup restore merge now promotes stale incoming `left` ledger status to `joined` only when newer joined evidence exists in the same incoming backup payload; local explicit ledger status is still preserved.
    - added focused regression coverage in:
      - `community-membership-reconstruction.test.ts`,
      - `encrypted-account-backup-service.test.ts`.
  - Added focused reconstruction coverage:
    - `community-membership-reconstruction.test.ts` (reconstruction + non-override supplement contract),
    - `encrypted-account-backup-service.test.ts` (missing-ledger reconstruction and local explicit-status preservation),
    - `group-provider.test.tsx` (delayed backup reconstruction path refresh).
  - Added two-account cross-device integration coverage for membership recovery:
    - `group-provider.cross-device-membership.integration.test.tsx` validates sender/receiver convergence for:
      - missing-ledger restore reconstruction from accepted invite-response evidence,
      - delayed restore reconstruction from backup chat-state group evidence after receiver mount.
  - Finalized canonical conversation-target guardrails for C1:
    - `conversation-target` now supports explicit DM fallback policy modes (`connection_match` vs `canonical_id_only`).
    - URL `convId` routing now applies `canonical_id_only` fallback in deep-link handling so non-canonical unresolved tokens cannot silently downgrade into DM selection.
    - Added resolver regression coverage in `conversation-target.test.ts`.
  - Landed C2 unread isolation hardening for mixed DM/community sessions:
    - Added `unread-isolation` helper to derive selected-target unread key set and apply deterministic zeroing on active selection.
    - Updated `messaging-provider` clear-on-select path to anchor selected conversation unread keys explicitly and clear legacy group alias keys (`community:*`, `group:*`, `group@relay-host`).
    - Added focused regression coverage in `unread-isolation.test.ts`.
  - Landed C3 mixed-history navigation/unread regression integration coverage:
    - Added `conversation-unread-convergence.integration.test.ts` to validate canonical ordering across conversation token resolution, selected-target unread isolation, and projection unread merge.
    - Added strict-boundary regression assertions proving non-canonical DM tokens cannot trigger selection/unread mutation under `canonical_id_only`.
    - Added mixed DM/group history assertions proving group-focused sessions retain isolated group unread zeroing while DM projection refreshes cannot reassert stale unread traps.
  - Hardened encrypted-backup restore integrity for new-device canonical-append path:
    - canonical-append restores now also apply merged chat-state domains (`messagesByConversationId`, `createdGroups`, `groupMessages`) with mutation-signal suppression to prevent self-authored DM and group history loss during restore/publish convergence.
    - added regression assertions in `encrypted-account-backup-service.test.ts` proving append-mode restore retains outgoing DM entries and group timeline/state domains.
  - Hardened post-restore message hydration convergence for cross-device sessions:
    - `message-persistence-service` now re-runs legacy chat-state message migration when chat-state replace events fire, so restored backup state is materialized into IndexedDB message history without requiring a restart.
    - legacy migration now normalizes sender attribution and canonical DM conversation ids through persisted-message contracts, preventing self-authored history from being stranded under legacy conversation keys.
    - `use-conversation-messages` now normalizes legacy IndexedDB message rows (`pubkey`-only sender metadata) to explicit `senderPubkey`/`recipientPubkey` evidence, preventing sender render degradation (`???`) in mixed restore/live timelines.
    - added focused regression coverage in:
      - `message-persistence-service.test.ts`,
      - `use-conversation-messages.integration.test.ts`.
  - Hardened web/desktop startup gate for profile binding:
    - `DesktopProfileBootstrap` now enforces a startup deadline for native profile refresh and always continues app initialization when that deadline is exceeded.
    - native profile refresh retries continue in the background after timeout so desktop profile binding can still converge without blocking first paint.
    - added focused regression coverage in `desktop-profile-bootstrap.test.tsx` for non-native web startup and hung native refresh fallback.
  - Hardened startup first-paint ownership to prevent indefinite gray-page hangs:
    - `Preloader` no longer sets `document.body.style.visibility = "hidden"` and now runs as a bounded warm-up hint only.
    - root `layout.tsx` now includes a preloader fail-safe script that force-releases stale `preloading`/hidden body state on bounded startup deadlines.
    - added focused regression coverage in `preloader.test.tsx` for fail-open visibility and bounded preloading release.
  - Landed Phase D2 warm-up owner cutover for startup orchestration:
    - added canonical runtime `warm-up-supervisor` state/task model and diagnostics surface for startup phases (`ready` / `degraded` / `fatal`) with hard/soft gate timeouts.
    - introduced `WarmUpGate` + `WarmUpScreen` as the single startup loading overlay owner across auth/runtime activation boundaries.
    - converted `DesktopProfileBootstrap` to background profile-binding refresh (non-blocking), removing it as a visual startup gate owner.
    - removed duplicate runtime-activation overlay ownership from `UnlockedAppRuntimeShell` so startup gating converges on the warm-up owner path.
    - added focused warm-up supervisor contract tests in `warm-up-supervisor.test.ts`.
  - Landed Phase D3 warm-up rollout gates for cross-runtime validation:
    - added runtime-specific warm-up budget evaluator (`web`, `desktop-native`, `mobile-native`) covering first paint, hard-gate completion target, blocking overlay max, and forced degraded-entry bounds.
    - wired terminal warm-up gate logging (`warmup.rollout_gate_result`) with structured reason codes and budget evidence payloads.
    - added reliability observability counters for warm-up terminal states and rollout gate warn/fail outcomes.
    - added focused rollout gate tests in `warm-up-rollout-gates.test.ts`.
    - added warm-up phase transition probe diagnostics (`warmup.phase_transition`) and exposed warm-up trace history via `window.obscurWarmup.getTrace()` for startup stall triage.
    - adjusted runtime rollout logging to avoid dev-overlay false alarms: only `fatal` warm-up terminals emit `error`; degraded/non-fatal rollout gate outcomes emit `warn`.
    - scoped first-paint rollout-budget enforcement to explicit policy (`production` default), keeping dev startup diagnostics high-signal without non-actionable first-paint gate failures.
  - Landed relay/warm-up Phase 3 reconnect convergence hardening:
    - relay recovery now normalizes `manual` recovery intent to cyclic disconnect reasons (`no_writable_relays` / `write_queue_blocked` / `cooldown_active`) when writable relays are absent, preventing accidental non-cyclic exhaustion during disconnect churn.
    - recovery attempt baseline now resets across recovery reason-family changes so post-disconnect recovery re-enters deterministic reconnect-first sequencing.
    - warm-up activation now enters non-blocking degraded mode immediately on relay-runtime degraded evidence and no longer oscillates degraded back into blocking `starting_transport` while runtime remains `activating_runtime`.
    - warm-up runtime sync now short-circuits no-op snapshot emissions to reduce startup churn.
    - added focused regression coverage in `relay-recovery-policy.test.ts` and `warm-up-supervisor.test.ts`.
  - Landed relay/runtime Phase 4 performance guardrails:
    - added runtime reconnect/sync performance gate evaluation (`pass` / `warn` / `fail`) with explicit target-vs-budget thresholds in `relay-resilience-observability`.
    - performance gate now tracks recovery latency p95, replay success ratio, scoped publish blocked ratio, and relay flap-rate budget pressure with reason-coded outcomes.
    - `relay-runtime-supervisor` now emits structured `relay.runtime_performance_gate` diagnostics on gate transitions.
    - calibration-only low-sample states are emitted as informational diagnostics to avoid startup false-alert churn.
    - added reliability counters `relay_runtime_performance_warn` and `relay_runtime_performance_fail`, surfaced in Settings Reliability.
    - added focused relay-churn performance-gate coverage in `relay-resilience-observability.test.ts`.
  - Hardened desktop native relay connect fallback under non-Tor runtimes:
    - `NativeRelay` now falls back to browser WebSocket when native `connect_relay` fails and Tor is disabled, instead of remaining closed and feeding infinite reconnect loops.
    - added focused regression coverage in `native-relay.test.ts` for native connect timeout -> browser fallback -> open transition.
  - Desktop relay transport ownership hotfix for startup stability:
    - `NativeRelay` now prefers browser WebSocket transport immediately when Tor is disabled (native connect is skipped in that mode), removing repeated 18s native TCP timeout churn from startup/reconnect loops.
    - native relay path remains active only when Tor is enabled.
    - updated `native-relay.test.ts` to lock this runtime contract.
  - Hardened fallback relay recovery convergence when configured relays are down:
    - relay transport activity now surfaces `fallbackWritableRelayCount` evidence from open/write-capable fallback sockets.
    - relay recovery policy now treats fallback writable evidence as degraded usable coverage (not healthy), resets cyclic recovery attempt state, and suppresses `no_writable_relays`/`cooldown_active` watchdog churn while fallback coverage is active.
    - sticky auto-recovery now keeps repairing configured relays during fallback coverage at a slower cadence, preserving automatic reconnect behavior without reconnect storms.
    - runtime activation relay-runtime gate diagnostics now include fallback relay counts for degraded triage.
    - runtime activation no longer re-emits degraded state mutations on every relay failure-message churn while already in `relay_runtime_degraded`, reducing UI rerender pressure under prolonged outage windows.
    - added focused regression coverage in:
      - `relay-recovery-policy.test.ts`,
      - `sticky-relay-recovery.test.ts`.
  - Hardened desktop deep-link navigation listener against route hijack churn:
    - dedupes repeated native deep-link payloads in a short window,
    - removes default forced `router.push("/")` for unknown `obscur://` paths so sidebar navigation is not overridden by noisy/unknown deep-link events.
  - Added deterministic manual account portability fallback for cross-device recovery when relay-backed restore is degraded:
    - added typed portable bundle contract (`obscur.portable_account_bundle.v1`) in account-sync contracts.
    - added `exportPortableAccountBundle` / `importPortableAccountBundle` in encrypted backup service with strict account ownership validation (`bundle.publicKeyHex` must match active identity).
    - manual import path now reuses canonical backup apply + canonical append boundaries instead of adding a parallel state owner.
    - wired Settings `Profile -> Account Sync` controls for portable bundle export/import with locked-identity guards.
    - added focused regression tests for portable bundle roundtrip and mismatch rejection in `encrypted-account-backup-service.test.ts`.

### Added

- **Protocol-Core Runtime Adapter Surface (Flag-Gated)**:
  - Added typed protocol-core adapter coverage for identity/session/envelope/relay-quorum/storage paths in shared runtime code.
  - Added runtime ACL parity checks for protocol commands in web-dev and desktop adapter contracts.
- **Deterministic Discovery/Request Foundations**:
  - Added `IdentityResolver`/contact-card/friend-code foundation services and typed resolver contracts for staged rollout.
  - Added contact request outbox hook + tests with persisted status metadata (`failureReason`, `blockReason`, `publishReport`, `error`).
- **Relay-Core Foundation Contracts and Service**:
  - Added shared `CoreResult`, `RelaySnapshot`, `PublishOutcome`, and relay reason-code contracts under `@dweb/core`.
  - Added `nostr-core-relay` service + tests for typed relay snapshot and publish outcome mapping.
- **v0.9 Recovery Docs**:
  - Added and linked v0.9 recovery/foundation roadmap docs (`docs/35`-`docs/37`) as active execution baseline.
  - Added Wave 0 canonical relay/NIP audit matrix (`docs/38`).
- **R0 Drift-Control Doc**:
  - Added `docs/39-v0.9-r0-architectural-drift-control.md` to define contract/gate correction scope and exit criteria before deeper transport rewrites.
- **v0.9.0 Beta Recovery Handoff Doc**:
  - Added `docs/40-v0.9.0-beta-status-and-recovery-handoff.md` to record the actual unreleased beta state, release blockers, and recommended recovery order.
- **Relay Runtime Resilience Foundation Doc**:
  - Added `docs/41-v0.9-relay-runtime-resilience-foundation.md` to define the desktop-first relay/runtime recovery model, subscription journal, sticky send queue, and recovery-stage ownership needed for stable multi-window communication.

### Changed

- **Phase 4 Beta Release Hardening and Repeatability (2026-03-17)**:
  - Switched release publication policy to manual-only publish from `workflow_dispatch` (`publish_release=true` on tag refs), while keeping push-tag lanes for preflight/build/artifact verification.
  - Added release source-integrity guard (`pnpm release:integrity-check`) to fail on `.gitmodules` or gitlink (`mode 160000`) contamination before release operations.
  - Added artifact-version parity contracts and verification:
    - workflow contract guard (`pnpm release:artifact-version-contract-check`),
    - runtime parity check (`pnpm release:artifact-version-parity`) enforcing desktop installer version markers and Android metadata `versionName` parity.
  - Updated release workflow evidence to report `android_signing_state` (`signed` or `unsigned`) and `ios_lane_state` (`executed` or `skipped_missing_secrets`).
  - Updated release docs/runbooks to reflect two-step release execution (build/verify first, manual publish second).

- **v0.9.0-beta Pre-release Finalization (2026-03-16)**:
  - Extended `.github/workflows/release.yml` artifact matrix to include a required Web/PWA static export lane (`build-web-pwa`) in addition to Desktop and Android lanes (with iOS remaining optional behind signing precheck).
  - Updated release verification to require Web/PWA bundle presence during artifact-matrix checks and CI-signal contract checks (`scripts/check-release-artifact-matrix.mjs`, `scripts/check-release-ci-signals.mjs`).
  - Updated release-facing docs and README to align with the GitHub-Releases-only distribution model and current v0.9.0-beta pre-release checklist.

- **Release CI Reliability Gate Hardening (2026-03-16)**:
  - Added `.github/workflows/reliability-gates.yml` to enforce `pnpm release:test-pack -- --skip-preflight` on PR/main code changes.
  - Updated reliability gate trigger behavior so the `release:test-pack` status check always reports on PR/main while the heavy test-pack step runs only for reliability-scope file changes.
  - Updated `.github/workflows/release.yml` preflight to run `release:test-pack` before build/publish jobs.
  - Extended `scripts/check-release-ci-signals.mjs` to require reliability gate workflow contracts in CI-signal checks.
  - Added CI-safe `--skip-preflight` mode to `scripts/run-release-test-pack.mjs` so PR/main automation can run release-blocking reliability tests while preserving local `release:preflight` branch/clean-tree constraints.
  - Repaired current `release:test-pack` blockers in touched runtime/test/UI contracts so the CI-mode pack is green (`typecheck + focused vitest + artifact matrix assertion`).
- **Discovery Phase 1 - Invite Code Restore + Canonicalization (2026-03-15)**:
  - Rewired Settings profile validation to include `inviteCode` in the canonical profile preflight path so malformed codes are blocked before save/publish.
  - Normalized invite codes to uppercase canonical form on save/publish and in user invite-code bootstrap, preventing mixed-case metadata/tag drift.
  - Improved Identity settings UX for invite codes with explicit suggested-code restore, copy action, and availability caveat text.
  - Added focused invite-code test coverage (`invite-parser`, `use-user-invite-code`, `use-profile`, `use-profile-publisher`) for normalization, persistence isolation, and publish metadata consistency.
- **Discovery Phase 2 - Deep-Link Add-Friend Routing (2026-03-15)**:
  - Added canonical deep-link parsing for contact-card onboarding (`obscur://contact?...`) and URL query-card handoff into deterministic Add Friend search input.
  - Wired the runtime deep-link owner (`useDeepLinks`) to route contact-card deep links directly to `/search?q=obscur-card:...` so identity resolution stays on the canonical discovery path.
  - Guarded routing behind discovery feature flags and promoted `discoveryDeepLinkV1` default baseline to enabled for Phase 2 rollout.
  - Added focused deep-link parser tests and updated privacy settings flag baseline tests.
- **Discovery Phase 3 - Local Friend Suggestions (2026-03-15)**:
  - Added a typed local suggestions service that ranks cached identity candidates by recency and profile completeness while excluding self, accepted peers, blocked peers, and active request peers.
  - Wired Add Friend UI to render local suggestion cards when query is empty and suggestions are enabled, with deterministic `Use` routing into exact-match resolver state.
  - Promoted `discoverySuggestionsV1` rollout baseline to enabled and added focused suggestion service tests plus updated privacy settings baseline tests.
- **Discovery Phase 4 - Rollout Controls + Invite-Lane Gate Enforcement (2026-03-15)**:
  - Enforced `discoveryInviteCodeV1` as a real resolver gate in deterministic and fallback Add Friend flows so legacy invite-code lookup can be safely enabled/disabled per policy.
  - Added discovery rollout controls in Settings for invite-code lookup, deep-link contact import, and local friend suggestions.
  - Added Add Friend diagnostics surface (session lookup/conversion counters, primary match source, active flag chips) with clear action.
  - Added focused resolver coverage for disabled invite-code lane behavior.

- **Relay Runtime Convergence + Stability Planning Update (2026-03-15)**:
  - Recorded latest beta progress in docs: cross-device chat history convergence is recovered in current desktop/web flows, while relay churn remains the primary reliability risk before release.
  - Documented an unresolved account-sync data omission as release-blocking: on web restore, contact/profile metadata converges but private DM history can still miss self-authored outbound messages.
  - Clarified that this self-authored DM history loss is tracked as a state-reconstruction/integrity defect (separate from relay availability churn).
  - Updated `docs/40-v0.9.0-beta-status-and-recovery-handoff.md` with a new status addendum clarifying that release-critical blockers are now centered on relay fault tolerance and evidence-backed runtime readiness.
  - Expanded `docs/41-v0.9-relay-runtime-resilience-foundation.md` with an explicit relay module map (`use-relay-list` -> `relay-provider` -> `enhanced-relay-pool` -> recovery/runtime supervisor -> native adapter) and code-level gap analysis.
  - Documented the v0.9 relay hardening execution plan: runtime transport journal ownership, scoped connection readiness, reason-aware recovery ladder, fallback demotion, stronger relay-list validation, and SLO-based beta gates.
- **Messaging UI Layering + Viewport Guardrails (2026-03-15)**:
  - Raised stacking and viewport-clamped positioning for emoji/reaction/context surfaces to prevent menus from rendering behind bubbles or outside window bounds.
  - Moved composer emoji picker rendering to a body portal with fixed-position clamping so it remains visible above chat content.
  - Elevated sidebar tab and conversation-row overflow menus with explicit high z-index so "More options" actions are not obscured by surrounding layout layers.
- **Relay Runtime Resilience Phase 1 (2026-03-15)**:
  - Added relay transport journal service (`relay-transport-journal`) as canonical runtime evidence surface for desired subscriptions, replay attempt/result diagnostics, and per-source outbound backlog counters.
  - Wired journal updates from `SubscriptionManager` and relay-open replay flows in `enhanced-relay-pool` with reason-coded replay evidence (`manual`, `recycle`, `relay_open`).
  - Wired pending outbound sources from `profile-transport-queue` and `use-contact-request-outbox` into relay transport journal source counters.
  - Extended relay runtime contracts/supervisor projection with Phase 1 fields (`pendingOutboundCount`, pending subscription batch count, replay attempt/result metadata) and replaced placeholder pending outbound projection.
  - Added focused Phase 1 tests for relay transport journal and runtime/sync integration paths.
- **Relay Runtime Resilience Phase 2 (2026-03-15)**:
  - Added scoped relay readiness waiting (`waitForScopedConnection`) in enhanced relay runtime and switched scoped publish recovery waits to scoped relay targets rather than any-relay readiness.
  - Extended relay transport activity evidence with `writeBlockedRelayCount` and `coolingDownRelayCount` so watchdog recovery can classify blocked-vs-cooldown outage modes.
  - Upgraded relay watchdog reason classification to distinguish `no_writable_relays`, `write_queue_blocked`, `cooldown_active`, and `stale_event_flow` while preserving centralized reconnect/resubscribe/recycle ownership in runtime recovery policy.
  - Added fallback demotion policy for auto-added fallback relays: once configured relays remain stably healthy for a bounded window, fallback relays are retired automatically.
  - Updated relay and messaging scoped-send tests for Phase 2 contracts (`relay-recovery-policy`, `enhanced-relay-pool` reliability paths, and outgoing DM scoped readiness usage).
- **Relay Runtime Resilience Phase 3 (2026-03-15)**:
  - Hardened relay-list input trust policy in `use-relay-list`: all relay add/replace/load normalization now uses shared relay URL validation instead of `trim`-only normalization.
  - Enforced explicit allowlist policy for user relay configuration: trusted `wss://` URLs by default, with `ws://localhost` as the only local-dev exception; other insecure/non-relay schemes are rejected.
  - Removed sync unverified NIP-65 cache ingest path and kept signature-verified relay hint ingestion as the only event-driven cache mutation path in `Nip65Service`.
  - Added focused validation and ingestion tests (`validate-relay-url`, `use-relay-list`, and `nip65-service` verified update path coverage).
- **Relay Runtime Resilience Phase 4 (2026-03-15)**:
  - Added `relay-resilience-observability` service to track per-relay flap rate, recovery latency samples/p95, replay result ratios, scoped publish readiness block ratio, and operator interventions.
  - Wired observability to canonical relay/runtime owners:
    - connection status + scoped publish readiness in `enhanced-relay-pool`,
    - runtime phase and replay-result transitions in `relay-runtime-supervisor`,
    - manual relay refresh intervention signal in Settings.
  - Added beta readiness gate evaluation with thresholded checks (observation window, operator interventions, p95 recovery latency, replay success ratio, scoped blocked ratio).
  - Added Settings reliability surface for Phase 4 SLO diagnostics (metrics, sample counts, beta gate state, and not-ready reasons).
  - Added focused test coverage in `relay-resilience-observability.test.ts` and updated `relay-runtime-supervisor.test.ts` for replay observability wiring.
- **Messaging Render-Phase Safety + Account-Sync Noise Guard (2026-03-15)**:
  - Refactored `MessagingProvider` state wrapper paths to keep setter updaters render-pure and move persistence side effects outside render-phase updater execution, reducing cross-component render update risk.
  - Added account-sync mutation publish suppression while backup restore is in flight to reduce restore/mutation feedback churn and log amplification.
  - Added focused account-sync convergence test coverage for restore-in-flight mutation suppression behavior.

- **Path B v1 Account Projection Foundation (2026-03-14)**:
  - Scoped account-sync migration policy state by `{profileId, accountPublicKeyHex}` so shadow/drift/cutover phases no longer bleed across profile/account windows; runtime activation now promotes deterministically `shadow -> drift_gate -> read_cutover` only after projection-ready evidence.
  - Switched encrypted-backup restore for v1 `contacts + DMs + sync-checkpoint` domains to canonical account-event append (with replay-safe idempotency keys) and kept direct restore writes only for non-v1 domains (profile/privacy/relay-list).
  - Tagged incoming canonical ingest by source (`relay_live` vs `relay_sync`) and updated DM sync cold-start behavior to full-history replay (`since=0`, elevated initial limit) instead of the old 24h bootstrap window.
  - Added a canonical account-event ingest bridge and wired dual-write append events for core contact/DM transitions at canonical transport boundaries (request transport lifecycle events, incoming DM routing events, sent-DM confirmations, sync-checkpoint advancement, and contact removal).
  - Added startup-gate coverage test for runtime transport ownership so incoming transport only enables when account projection readiness is explicitly `ready`.
  - Added deterministic reducer replay tests for account projection state (`contacts`, `messages`, `sync checkpoints`) and an explicit dual-write request-transport test for canonical contact-request event append.
  - Added projection-read migration authority + selectors for `contacts + requests` with rollback-on-critical-drift behavior, and wired read-cutover support into `usePeerTrust`/`useRequestsInbox` while keeping dual-write compatibility.
  - Added projection-backed DM conversation list seeding for cutover phases so accepted contacts can recover conversation list metadata (`last message`, `unread`) from canonical projections when local legacy stores are empty on new-device web sessions.
  - Added projection-backed conversation timeline fallback in `useConversationMessages` so active chats can hydrate from canonical account-event projections when IndexedDB is empty on first web/new-device login.
  - Updated canonical DM event ingest/reducer behavior to keep full normalized plaintext in message projections while still clipping conversation-list preview strings to concise UI length.
  - Added legacy-write gating for contacts/request inbox mutations via migration phase (`legacy_writes_disabled`) so canonical event append can remain active while legacy writes are disabled.
  - Added runtime activation drift-gate enforcement for cutover phases, including promotion support from `drift_gate -> read_cutover` when critical drift is clean and structured activation diagnostics with projection/migration phase context.
  - Added focused migration tests (`account-projection-read-authority`, `account-projection-selectors`, `account-sync-migration-policy`) and updated runtime activation manager tests for projection/drift-gate behavior.
  - Hardened account-event contact reducer transitions so `CONTACT_ACCEPTED` cannot be regressed to `pending/declined/canceled` by stale replayed request events; accepted contacts now only regress on explicit `CONTACT_REMOVED` evidence.
  - Added deterministic cross-device replay integration coverage proving accepted contact + DM timeline visibility survive new-device/web bootstrap replay and no longer regress to stranger state from stale request imports.
  - Removed legacy requests-inbox handled-item collapsing so non-pending contact/request states are preserved per peer instead of truncating to a single global handled row (prevents cross-peer state churn and related update-loop risk).
  - Added `useRequestsInbox` integration coverage to ensure multiple accepted peers remain stable under repeated status updates without collapsing state.
  - Added a `useRequestsInbox` render-loop regression test that mirrors accepted statuses from `useEffect` dependency on inbox items, guarding against `Maximum update depth exceeded` recursion on repeated `setStatus` no-op updates.
  - Added runtime activation transport-owner invariant diagnostics after projection readiness (`incoming owner = 1`, `queue processor = 1`) with structured warn/info emission for drift visibility during startup churn.
  - Expanded runtime/messaging ownership tests to cover runtime-phase gating (`activating_runtime` keeps transport disabled), post-ready owner invariant reporting, and rapid register/unregister churn behavior for transport runtime counters.
  - Added deterministic transition tests for projection/runtime gate flapping plus relay-connection churn to ensure transport-owner invariant logging is emitted only on true counter state transitions (deduped across relay-only churn).
  - Added a runtime activation transport-gate integration harness (`runtime-activation-transport-gate.integration.test.tsx`) covering one deterministic flow across: cutover critical-drift degrade -> clean recover -> runtime ready owner invariant convergence -> relay-only churn dedupe.
  - Expanded account-sync drift detection to include message timeline-count deltas as `messages` domain non-critical drift (in addition to contact drift), with focused detector tests for clean/messaging/contact drift classification.
  - Updated `dm-delivery-deterministic.integration.test.ts` to assert canonical durable-evidence behavior (local retry queue state plus accepted retry once durable minimum is met), removing stale assertions tied to legacy `publishResult.status` and pre-gate quorum semantics.
  - Expanded `dm-sync-orchestrator` regression coverage for cold-start pagination edge cases: stable-cursor duplicate windows, max-pass exhaustion safety, and timed-out paginated-pass diagnostics/checkpoint evidence.
  - Fixed pending-request inbox regression where generic replies with outgoing-request evidence could be persisted with `status=undefined`, causing unread badge accumulation that disappeared when opening Requests; these events now remain `pending` with focused incoming-handler coverage.
  - Hardened projection read authority so `legacy_writes_disabled` phase no longer rolls reads back to legacy on critical drift (prevents no-read/no-write black-hole windows during cutover recovery).
  - Normalized `_Last reviewed` stamps in docs `37/39/40/41` to the enforced docs-check contract so release preflight remains deterministic in dirty-worktree dry-runs.

- **Desktop Runtime Timeout + Restore Access Stabilization (2026-03-14)**:
  - Added command-aware native invoke timeout policy for critical startup commands (`desktop_get_profile_isolation_snapshot`) and raised profile runtime command timeout budgets to reduce false bootstrap failures under slow native startup.
  - Removed client-side timeout enforcement for `init_native_session` so local identity import/unlock no longer fails fast when native session hydration is slow.
  - Switched account-restore UI from hard-block overlays to non-blocking runtime banners so locally unlocked/imported identities remain usable while relay restore continues in degraded conditions.
  - Narrowed runtime transport-owner activation to stable runtime phases (`ready`, `degraded`) and relaxed invariant warning severity for expected idle states (`0` owners / `0` queue processors) to reduce startup warning noise.
  - Added sender-side delivery troubleshooting reports for dev mode so non-delivered DM sends now emit structured diagnostics (`recipient`, `reason`, `relay scope`, relay failure summary) and are queryable via `window.obscurDeliveryTroubleshooting`.
  - Extended sender delivery troubleshooting to queued retry processing so `retry_scheduled` and terminal queue failures also emit structured sender-delivery issue reports from the queue owner path.
  - Added a Dev Panel `Sender Delivery Issues` card with live issue list + clear action, making sender->recipient transmit failures visible without digging through raw console spam.
  - Added a shared dev runtime issue reporter (`window.obscurDevRuntimeIssues`) with normalized issue schema, bounded history, and dedupe windows so repeated failures are surfaced without console flood.
  - Wired canonical relay connection/publish failures, messaging sender-delivery failures, and NIP-96 upload terminal failures into the shared runtime issue feed.
  - Added global dev runtime capture for unhandled browser errors and unhandled promise rejections, mounted from app providers and routed into the shared runtime issue feed.
  - Added `logAppEvent` issue escalation bridge so high-signal warn/error app events are automatically surfaced in the runtime issue feed for future feature work, with exclusions to avoid duplicate sender-delivery reports.
  - Added a Dev Panel `Runtime Issue Feed` card for cross-domain troubleshooting (relay/messaging/upload) with live updates and clear action.
  - Added Runtime Issue Feed triage controls (domain/severity/retryability filters) and JSON export in Dev Panel to speed debugging handoffs and issue reporting.
  - Added focused tests for native timeout policy, native session init invocation contract, account-sync UI policy, and transport invariant severity behavior.

- **Messaging Transport Single-Owner Stabilization (2026-03-13)**:
  - Added a runtime singleton messaging transport owner provider mounted once in `UnlockedAppRuntimeShell`; this owner now exclusively controls incoming DM subscriptions, sync orchestration, and automatic offline queue processing per window.
  - Switched non-owner DM controller surfaces (global dialog/search/network/invite cards) to explicit send-only mode (`enableIncomingTransport: false`, `autoSubscribeIncoming: false`, `enableAutoQueueProcessing: false`) and removed route-driven incoming ownership toggling.
  - Hardened `useEnhancedDMController` lifecycle contract with explicit owner/instance diagnostics (`transportOwnerId`, `controllerInstanceId`), deterministic cleanup on disable/unmount, and queue-processor owner registration lifecycle tracking.
  - Added strict durable-send preflight queueing: when writable scoped relays cannot satisfy durable minimum (`2-of-3`, otherwise `1`), send is queued immediately with typed failure reason `insufficient_writable_relays` instead of waiting on timeout-driven failure paths.
  - Added window-scoped transport runtime invariants and DevPanel/runtime snapshot counters for active incoming owners and active queue processors, including warn-level invariant diagnostics when incoming owner count diverges from exactly one.
  - Added focused runtime diagnostics test coverage for owner/queue counter tracking and invariant emission behavior.

- **Desktop Relay Churn Stabilization (2026-03-13)**:
  - Added per-relay connection-generation gating in `enhanced-relay-pool` so stale socket events no longer mutate live relay state or trigger duplicate reconnect loops.
  - Added reconnect in-flight dedupe and minimum reconnect interval suppression to reduce same-URL reconnect fan-out under runtime recovery pressure.
  - Added hard-failure cooldown gating for relay errors matching Tor/Cloudflare challenge signatures so repeated `403` relay failures do not trigger immediate reconnect hammering.
  - Hardened `NativeRelay` close/disconnect lifecycle to avoid duplicate native disconnect calls and emit structured connect-failure error detail for relay-pool classification.
  - Added focused regression coverage for hard-failure classification and native relay structured failure/close behavior.

- **Canonical Relay Reconnect Owner Correction (2026-03-13)**:
  - Removed Rust-side background auto-reconnect scheduling from `apps/desktop/src-tauri/src/relay.rs` so native relay transport no longer competes with JS reconnect orchestration.
  - Kept reconnect lifecycle ownership in `enhanced-relay-pool` as the single per-window owner, reducing relay flap races and transient `Not connected` publish failures during desktop runtime churn.
  - Updated native event adapter lifecycle to detach Tauri listeners on `beforeunload`, reducing stale callback-id warning floods after reload/hot-reload cycles.
  - Added explicit native connect-time budgeting for `connect_relay` (Tor and non-Tor paths) so command completion stays inside frontend invoke timeout windows and avoids stale timed-out connect races.
  - Added native relay ping/pong handling in Rust relay read/write loops so native websocket sessions answer control-frame heartbeats and do not churn from missed pong responses under long-lived connections.
  - Deduplicated native relay `open` emission when `relay-status: connected` and `connect_relay => Already connected` arrive in the same lifecycle window.
  - Hardened relay-pool generation gating to dispose stale native relay handles without disconnecting the active URL-scoped native transport when a replacement socket already owns that URL.

- **Console Flood Guard + Image Fill Warning Reduction (2026-03-12)**:
  - Added rate-limited app-event logging in `logAppEvent` so repeated warn/error/info events collapse into bounded output windows instead of flooding DevTools.
  - Replaced high-frequency native gift-wrap and native crypto fallback `console.error`/`console.warn` paths with classified runtime-log hygiene to prevent repeated decrypt noise from overwhelming diagnostics.
  - Fixed two `next/image` `fill` parent-position warnings by marking image wrappers as `relative` in chat empty-state and onboarding contact resolution avatars.
  - Added focused regression coverage for `logAppEvent` rate-limiting behavior.

- **Recipient Relay Evidence Targeting + Inbound Relay Diagnostics (2026-03-12)**:
  - Added profile-scoped peer relay evidence persistence (`peer-relay-evidence-store`) to record trusted inbound relay URLs observed for each peer from actual received DM/request events.
  - Wired inbound relay URL context through the live subscription and sync receive paths into incoming DM handling, and surfaced relay URL on delivery diagnostics for event routing triage.
  - Outgoing relay targeting now includes recipient inbound relay evidence when NIP-65/discovery recipient scope is empty, reducing asymmetric one-way delivery cases where sender-only relay fallback misses recipient-observed relays.
  - Added focused regression coverage for peer relay evidence persistence/isolation, incoming relay evidence recording, and outbound target resolution using inbound evidence fallback.

- **Native Session Status Wire Compatibility + Rehydrate Fallback (2026-03-12)**:
  - Fixed native session status parsing to accept both camelCase and snake_case payloads (`isActive` / `is_active`) from Tauri command responses.
  - Added session status fallback rehydration through `get_native_npub` when `get_session_status` reports inactive, allowing keychain-backed native sessions to recover before DM receive/send guards fail.
  - Added regression coverage in `session-api.test.ts` for snake_case payload normalization and inactive-status fallback hydration behavior.

- **Desktop DM Modern Path Preference + Receipt ACK Alignment (2026-03-12)**:
  - Desktop runtime now prefers modern gift-wrap (`kind:1059`) for ordinary direct messages even while v0.9 stability-mode flags remain enabled, with legacy `nip04` retained as fallback when modern event build fails.
  - Connection receipt ACK (`t=connection-received`) now follows the same modern-first lifecycle path instead of being hardcoded to legacy `nip04`, reducing pending-state drift when legacy decrypt paths regress.
  - Outgoing relay targeting now includes configured sender relays in addition to currently open relays to improve delivery convergence when recipient relay discovery is temporarily empty.

- **Native Session Congruence Guard + Decrypt Retry Semantics (2026-03-12)**:
  - Added a native-session identity congruence gate for DM send/receive when running with native key sentinel mode so windows fail deterministically on profile/session pubkey mismatch instead of publishing/decrypting with the wrong native identity.
  - Tightened incoming decrypt-failure suppression so only permanently malformed/scope-mismatch events are tombstoned; transient/regression decrypt failures are now retryable on later sync passes.
  - Added regression coverage for transient decrypt retry and permanent malformed-event suppression behavior in the incoming DM handler suite.
- **Context Recovery Note (2026-03-12)**:
  - Recorded the current two-window desktop reproduction where account A resolves account B by `npub`, sends an invitation from Discovery, sees `Invitation delivered`, and retains an outgoing pending request while account B does not receive the invitation/DM from account A.
  - Recorded that account B still receives unrelated inbound traffic (for example advertisement-style request/inbox items), so the failure is not "recipient window cannot receive anything" but a narrower request/message convergence problem across relay scope, inbound routing, or runtime ownership.
  - Recorded code-audit findings that the Discovery exact-match CTA currently sends through `requestTransport.sendRequest(...)` in `apps/pwa/app/search/page.tsx`, while request list/manage surfaces still render through the legacy `inviteManager` bridge configured from `apps/pwa/app/features/main-shell/main-shell.tsx`, confirming overlapping request owners remain live in the branch.
  - Recorded that incoming request routing still depends on the DM subscription path plus tag/decrypt routing in `apps/pwa/app/features/messaging/controllers/incoming-dm-event-handler.ts`, so this failure should be investigated as transport/runtime convergence rather than a simple requests UI rendering bug.
- **Relay Runtime Audit Recovery Note (2026-03-12)**:
  - Recorded the relay-system architecture chain and audit findings in `docs/41-v0.9-relay-runtime-resilience-foundation.md` after tracing relay configuration, socket/publish handling, runtime recovery state, and native desktop relay transport.
  - Recorded that the current relay runtime supervisor still projects state more than it owns it: no subscription journal exists yet and `pendingOutboundCount` remains non-evidence-backed.
  - Recorded a concrete relay health-scoring bug where `successRate` is stored as a percentage but clamped as though it were `0..1`, which can distort relay ordering and failover decisions.
  - Recorded that transient/discovered relay URLs are still accepted too trustingly and that desktop native relay probing/connecting remains broader than the intended privacy-tight trust model.
- **Relay Scoring + Hint Hardening (2026-03-12)**:
  - Fixed relay health-score normalization so percentage-based `successRate` metrics are converted correctly before relay ordering/failover scoring.
  - Added a strict relay-hint trust gate for recipient relay hints from `nprofile`, NIP-65, and legacy kind-3 discovery paths so only validated `wss://` relay URLs are cached or connected as transient relays.
  - Added focused regression tests for relay-score ordering and relay-hint filtering in the PWA relay/messaging stack.
- **Relay Verified Hint Ingestion + Freshness Semantics (2026-03-12)**:
  - Added verification-aware NIP-65 ingestion so incoming kind `10002` relay lists require a valid event shape, normalized pubkey, valid signature, and at least one trusted `wss://` relay before cache mutation.
  - Switched live kind `10002` handling onto the verified ingestion path and preserved prior relay-hint cache state when invalid/unsigned events arrive.
  - Split relay transport freshness into raw inbound message freshness vs inbound event freshness, and tightened stale-subscription recovery to key off useful event progress instead of generic relay chatter.
  - Extended relay recovery/runtime snapshots and runtime sync checks with the new freshness evidence fields.
- **Relay Status UI Accuracy (2026-03-12)**:
  - Tightened the overall relay status banner so it now considers runtime phase, writable/subscribable relay counts, fallback relay usage, and recent inbound event freshness instead of only open socket counts.
  - Added a richer per-relay derived status model for Settings and relay metrics surfaces with clearer badges such as `Connected`, `Connecting`, `Cooling down`, `Fallback active`, and `No recent events`.
  - Replaced overly optimistic per-relay success display with sample-aware confidence messaging so low-sample relays no longer present as confidently `100% stable`.
  - Fixed split-brain relay UI sources so the dashboard and sidebar relay indicator now read the live provider/runtime state instead of standalone or singleton-only relay monitor state.
  - Updated the dashboard wording from `Last 10 polls` to `Last samples` to match the actual metric source.
- **Desktop Request/Invite Receive Recovery (2026-03-12)**:
  - Fixed requests inbox hydration so live incoming request state is merged with persisted state instead of being overwritten during startup hydration for the same profile window.
  - Broadened connection lifecycle publish targeting so invitations/connection requests publish to recipient-facing relays plus sender open/write relays when recipient scope is known, reducing the chance of live desktop-window misses caused by overly narrow relay scope.
  - Added focused regression coverage for requests inbox hydration merge safety and broader lifecycle relay targeting.
- **Desktop Relay Reconnect Storm Guard (2026-03-12)**:
  - Hardened browser-WebSocket relay fallback so handshake failures become a single terminal relay failure state instead of feeding duplicate error/close reconnect churn.
  - Updated the enhanced relay pool to evict dead socket handles immediately on terminal failure/close before scheduling reconnect, allowing replacement sockets to start cleanly.
  - Added focused regression coverage for browser-fallback terminal-state handling in the desktop relay transport path.
- **Desktop Relay Native-First Startup (2026-03-12)**:
  - Changed desktop relay startup to prefer the native relay transport path even when Tor is disabled, with browser WebSocket fallback only if native relay initialization actually fails.
  - This reduces dependence on webview/browser TLS and handshake behavior during desktop relay startup and avoids repeating browser-fallback certificate and handshake failures when the native path is available.
- **Relay Settings Manual Refresh (2026-03-12)**:
  - Added a manual `Refresh Status` action in relay settings that reconnects relays, replays subscriptions, triggers manual relay recovery, and refreshes writable relay status without requiring a page reload.
- **Messaging Receive Owner Deduplication (2026-03-12)**:
  - Added `autoSubscribeIncoming` control to the enhanced DM controller so non-canonical send-only surfaces no longer auto-subscribe to live incoming DM streams.
  - Moved desktop notifications onto the canonical `messageBus` instead of creating an additional background DM controller/subscription owner.
  - Reduced duplicate incoming-event logging by suppressing repeated `incoming_event_seen` logs for the same event id within one runtime instance.
- **Connection Lifecycle Modernization (2026-03-12)**:
  - Stopped forcing legacy `kind: 4` formatting for connection lifecycle messages (`connection-request`, `connection-accept`, `connection-decline`, `connection-cancel`, and receipt variants).
  - Connection lifecycle sends now stay on the modern encrypted path even while broader stability-mode legacy fallbacks remain in place for ordinary DMs.
  - This directly targets desktop/web decrypt mismatches where current live request events were arriving with correct recipient tags but failing to decrypt as legacy NIP-04 payloads.

- **Messaging Protocol Wiring (PWA Shared Paths)**:
  - Outgoing DM publish now prefers protocol-core quorum publish when enabled, with deterministic fallback to legacy relay publish.
  - Offline/queued DM retry path now uses the same protocol-aware publisher flow.
  - Relay-core typed publish outcomes now back DM send/queued retry fallback paths.
  - Incoming DM handling now verifies `v090_x3dr` envelope metadata through protocol adapter (flag-gated) and rejects invalid envelopes with typed outcomes.
- **Queue Retry Determinism (Wave 2)**:
  - Offline queue send contract now returns structured outcomes (`accepted | retry_scheduled | terminal_failed`) instead of booleans.
  - Queued DM retries now persist `retryCount`, `nextRetryAt`, and reason metadata, and stop at terminal budget instead of rapid reattempt loops.
  - Added a minimum forward retry-delay floor for queued DM retries so jitter cannot schedule immediate reattempts.
  - Queue processor now removes terminal-failed entries and tracks scheduled retries explicitly.
- **Profile Publish Reliability Path**:
  - Profile network publish now routes through relay-core typed outcomes (`ok|partial|queued|failed|unsupported`) with bounded timeout handling.
  - Added degraded classification for `no writable relays` cases.
- **Request/Transport Outcome Normalization**:
  - `SendResult` now carries deterministic delivery state (`sent_quorum|sent_partial|queued_retrying|failed`) for request outbox mapping.
  - Request outbox retry scheduling now honors queued retry hints and typed failure metadata.
- **Upload Outcome Classification**:
  - Added internal upload failure normalization to shared reason-code domain (`provider_unavailable|upload_timeout|upload_provider_failed`) with retryable classification for telemetry/UI consistency.
  - Added NIP-96 provider URL migration (`nostr.build` legacy endpoint auto-rewritten to `/api/v2/nip96/upload`) and refreshed default provider set.
  - Added native upload transport fallback: when Tor proxy path fails with network errors, desktop native uploader retries via direct client path before failing terminally.
- **Cross-Runtime Profile Media Portability**:
  - Added a shared public URL normalizer so local upload paths and absolute CDN URLs resolve through the same contract across web-dev and desktop UI.
  - Normalized avatar/profile media at upload return boundaries, local profile persistence, relay metadata resolution, and preview/profile presentation hooks.
  - Moved remaining profile-facing UI surfaces onto `useResolvedProfileMetadata` where they were still reading raw metadata directly.
  - Extended `release:test-pack` with public URL and resolved-profile metadata regression coverage.
- **Restart Recovery Proof Tightening**:
  - Fixed remaining profile-scoped discovery/request evidence caches to resolve storage keys at access time instead of module load, preventing cross-profile leakage after profile switches.
  - Added restart-style regression coverage for local profile persistence and profile-scoped request/discovery evidence stores.
  - Extended `release:test-pack` with the new scoped persistence and local profile restart checks.
- **DM Persistence Isolation Repair**:
  - Fixed `MessageQueue` reads so shared IndexedDB message and retry-queue stores are filtered by owning identity instead of leaking entries across identities/profiles.
  - Preserved recovery compatibility for older owner-less records by inferring message ownership from persisted DM participants and queued-entry ownership from the signed-event sender.
  - Added IndexedDB-backed message/retry isolation regressions and included them in `release:test-pack`.
- **Relay Publish Chaos Proof**:
  - Added relay-core chaos coverage for zero-writable windows, relay flap recovery, intermittent timeout, intermittent `503`, quorum-met degraded publish, and hard relay rejection.
  - Locked timeout-only zero-success publish windows to typed `queued`/`relay_degraded` instead of terminal failure, while preserving terminal failure for non-retryable relay-policy rejection.
  - Added the relay publish chaos suite to `release:test-pack`.
- **Runtime Boundary Parity Hardening**:
  - Added timeout-aware shared native command invocation and moved native session/crypto calls onto that adapter path.
  - Added explicit session fallback regression coverage so unsupported/failed native session checks settle to deterministic inactive state.
  - Centralized notification permission/show behavior behind one runtime-safe service used by desktop/web callers instead of split native-vs-browser branches.
  - Added runtime notification regression coverage and crypto runtime-selection coverage to keep native/web service choice deterministic.
- **Native Event + Vault Boundary Extraction**:
  - Added a shared native event listener adapter and moved deep-link/Tor event subscriptions off direct feature-level Tauri event imports.
  - Added a native local-media adapter so vault cache path/join/fs/open/picker operations no longer own their own scattered Tauri imports.
  - Reused centralized standalone-shell detection for deep-link compatibility logic instead of inline display-mode checks.
  - Extended `release:test-pack` with native event and native local-media adapter regression coverage.
- **Native Host Integration Boundary Extraction**:
  - Added a shared native host adapter for external-open, native file-picking/file-read, and background-service registration flows.
  - Moved upload file selection, media external-open, and background keepalive registration off direct feature-level plugin imports.
  - Kept background-plugin loading lazy behind the adapter so non-native web/test builds do not couple to that plugin at import time.
  - Extended `release:test-pack` with native host adapter and background-service regression coverage.
- **Relay Native Bridge Extraction**:
  - Added a dedicated relay native adapter for Tor status, relay command/probe calls, and relay event subscriptions.
  - Refactored `NativeRelay` to depend on that adapter instead of importing raw Tauri core/event APIs directly.
  - Extended `release:test-pack` with relay-native adapter and `NativeRelay` regression coverage.
- **X3DH Envelope Metadata Injection (Gated)**:
  - Outgoing message orchestration now adds envelope version/session/counter tags for `v090_x3dr` policy paths.
  - Handshake/ratchet/session lookup failures are bounded and fall back to legacy publish path.
- **Request UX and Error Hygiene**:
  - Request outbox transitions now distinguish retryable vs non-retryable failures and prevent blind retries for blocked/non-recoverable records.
  - Search outbox UI now surfaces partial/quorum/failure states with relay success ratios, reason badges, and bounded transition toasts.
- **R1 Request Delivery Hardening (Kickoff)**:
  - Incoming tagged connection requests/accepts now bypass `contacts-only` stranger filtering so request traffic is not silently dropped.
  - Outgoing pending-request guard now treats missing timestamps as stale and shortens stale lock window to 3 minutes to avoid long local lockouts.
  - Contact request outbox now enforces a max retry budget with terminal `max_retries_exceeded` classification.
  - Incoming connection requests now trigger a control-plane receipt ACK (`t=connection-received`) so sender pending state has a recipient-evidence refresh path.
  - Incoming receipt control events now refresh existing outgoing pending state without creating chat messages.
  - Contact request outbox now reconciles terminal-failed records back into inbox request state by releasing stale outgoing pending guard entries.
- **R1 Reliability Hard Gate Continuation**:
  - Added shared request transport convergence contracts (`RequestFlowEvidence`, `RequestConvergenceState`) with profile-scoped evidence persistence.
  - Unified request send/accept transitions for Search, Network Profile, Chat creation, and dashboard accept actions through `request-transport-service`.
  - Unified invite-redemption auto-request send path onto `request-transport-service` typed outcomes, removing raw-success assumptions in that entry point.
  - Added a runtime bridge from the legacy invite manager send path into shared request transport, so direct/deep-link invite sends no longer create local pending records before transport evidence exists.
  - Added a runtime bridge from the legacy invite manager inbox/accept/decline/cancel path into shared request inbox + trust state, so legacy invite surfaces no longer depend on a separate pending-request truth source when the app shell is active.
  - Centralized runtime host/bridge policy in `runtime-capabilities` and reused it for Tauri invoke checks plus upload-provider bootstrap/fallback decisions, reducing web-vs-desktop drift from duplicated environment detection.
  - Added deterministic two-user request flow integration test (`10/10` consecutive runs) with restart checkpoint and wire-evidence assertions.
  - Added relay-chaos outbox reliability test coverage for forward-only `nextRetryAt`, bounded retry budget, terminal failure convergence, and stale pending lock release.
  - Added invite-redemption regression coverage to ensure partial delivery persists dedupe state while queued delivery remains retryable on the next redemption attempt.
  - Added legacy invite-manager regression coverage to ensure partial transport acceptance stores outgoing pending exactly once and relayless failures do not leave stale local pending entries.
  - Added shared invite-manager regression coverage for inbox-backed request listing plus bridged accept/cancel actions.
  - Added runtime capability regression coverage for local-dev/hosted-preview host classification used by upload/runtime policy.
  - Added shared relay/NIP probe module + CLI (`pnpm probe:relay-nip`) and Dev Panel snapshot card for socket/publish/subscribe/NIP-11/NIP-96 diagnostics.
  - Extended `release:test-pack` to include request transport deterministic/chaos suites and relay/NIP probe contract tests.
  - Tightened request acceptance convergence so queued/failed accept publishes no longer mutate receiver state to `accepted` before transport evidence exists.
  - Expanded the deterministic two-user request suite to cover request publish, receiver pending evidence, receipt ACK, accept evidence, and three restart checkpoints within the required `10/10` run.
  - Removed evidence-free DM success fallbacks so `sendToOpen`-only runtimes no longer report `sent_quorum`/`accepted`; unsupported transport now settles to deterministic failure instead of optimistic delivery.
  - Tightened queued DM retry classification so unsupported transport becomes terminal failure while retryable relay churn still schedules bounded retries.
  - Queued DM retry now settles on partial relay evidence instead of looping for more retries after at least one relay accepted the message.
  - Extended DM controller/publisher regression coverage for unsupported publish transport and non-optimistic failure behavior.
  - Added deterministic two-user DM delivery integration coverage (`10/10`) for queued first-send recovery, sender/receiver restart checkpoints, partial relay quorum, and decrypt/receive convergence.
  - Normalized profile publish reporting with typed delivery status (`sent_quorum`, `sent_partial`, `queued`, `failed`) and removed the legacy `sendToOpen` success fallback from profile network publish.
  - Added hook-level profile publish regression coverage for partial success, queued no-writable-relay state, and unsupported transport failure.
  - **Fixed Invitation Resend Logic**: Removed hard blocks on repeated invitations in `EnhancedDMController`, enabling users to re-send requests after a decline.
  - **Fixed Request Evidence Poisoning**: Added explicit evidence reset when re-initiating a connection request, preventing stale receipt acknowledgments from blocking new invitations.
  - **Fixed Network Profile Primary Action**: Corrected guards on the profile "Connect" button to allow re-sending invitations when in terminal failed or rejected states.
- **Release Tooling Determinism**:

  - Fixed `scripts/run-release-test-pack.mjs` preflight argument forwarding (`--tag`, `--allow-dirty`) to keep dry-run behavior deterministic.
- **R0 Gate Hardening**:
  - Expanded `release:test-pack` to include messaging controller determinism tests:
    - `dm-subscription-manager`,
    - `incoming-dm-event-handler`,
    - `enhanced-dm-controller`,
    - relay `subscription-manager`.
- **Docs-to-Reality Synchronization**:
  - Updated the v0.9 Wave 0 audit matrix to reclassify contact-request delivery as `flaky` under relay churn/state drift scenarios.
  - Updated release/testing docs to require R0 drift-control gate alignment before release reliability claims.
- **Delivery Diagnostics and Sync Guarding**:
  - Added per-window delivery diagnostics for subscription, sync, publish, and inbound-event tracing in dev builds.
  - Tightened DM sync so checkpoints no longer advance on incomplete or timed-out sync runs.
- **Relay Recovery Stickiness and Invitation Queueing**:
  - Added event-driven relay recovery nudges on `online`, focus, visibility return, and zero-writable-relay states so reconnect/resubscribe/recycle recovery no longer depends only on a watchdog or page refresh.
  - Tightened desktop relay fallback transport so browser-fallback sockets are not treated as native relay sessions during async shutdown races.
  - Unified invitation compose/send UI across discovery and contact profile surfaces behind one shared composer contract and shared delivery copy.
  - Removed hard invitation send blocking when relays are temporarily unwritable; the UI now supports queue-and-retry behavior instead of forcing a manual refresh/retry loop.
- **Recipient Relay Scope Tightening**:
  - Recipient relay discovery now returns and caches resolved relay URLs for send-time use.
  - Outgoing request/DM transport now carries explicit relay scope inputs more consistently instead of relying only on already-open sender relays.
- **Branch Status Clarification**:
  - Reclassified the current `v0.9.0 beta` line as a recovery branch with unresolved communication/runtime blockers rather than a releasable beta candidate.

## [v0.8.9] - Unreleased

### Added

- **Release Determinism Tooling**:
  - Added `pnpm release:ci-signal-check` to enforce required release workflow signal contracts.
  - Added `pnpm release:verify-tag` to validate post-tag artifact matrix and changelog/version/tag consistency.
  - Added `pnpm release:test-pack` as deterministic targeted release gate.
- **v0.8.9 Docs**:
  - Added `docs/32-v0.8.9-stability-and-release-integrity-roadmap.md`.
  - Added `docs/33-v0.8.9-known-failures-registry.md`.

### Changed

- **Release Preflight Hardening**:
  - `release:preflight` now enforces clean working tree, remote tag non-existence, local tag-to-HEAD consistency, and CI signal contract checks.
- **Runtime Boundary Hygiene**:
  - Replaced remaining settings/runtime direct native invoke paths with adapter calls in key PWA shared flows.
  - Reduced unsupported native command noise in web harness via bounded runtime classification logs.
- **Reliability Contracts (v0.8.9)**:
  - Added relay circuit-state classification (`healthy | degraded | cooling_down`) and cooling counters.
  - Added sync checkpoint repair contract before backfill decisions.
  - Expanded storage recovery report diagnostics (`status`, `durationMs`, `recoveredEntries`) and storage retry counters.
- **Web Policy Messaging**:
  - Updated blocked runtime screen copy for v0.8.9 policy and explicit override key hint.

## [v0.8.8] - 2026-03-06

### Added

- **Runtime Capability + Adapter Contracts**:
  - Added `RuntimeCapabilities` contract and centralized runtime detection utilities.
  - Added typed adapter result contract (`AdapterResult<T>`) and native command adapter helper.
- **Multi-Profile Foundation**:
  - Added local profile registry (`create/rename/switch/remove`) with single active-profile model.
  - Added profile switcher UI in Settings > Identity.
  - Added profile-scoped storage key helpers and profile-scoped identity keying.
- **One-Time Profile Migration**:
  - Added startup migration bootstrap to snapshot and migrate legacy single-profile data into `default` profile namespace.
  - Added migration report + marker for idempotent reruns.
- **v0.8.8 Roadmap Doc**:
  - Added `docs/31-v0.8.8-runtime-decoupling-and-multi-profile-roadmap.md`.

### Changed

- **Runtime Decoupling (Native/Web)**:
  - Replaced direct runtime probes across core paths with centralized capability checks.
  - Hardened web behavior so unsupported native operations degrade deterministically without throw/spam.
- **Web Runtime Policy**:
  - Web runtime now defaults to dev/localhost-only usage.
  - Production web runtime is blocked by default and can be explicitly enabled via env policy.
- **Storage/Identity Isolation**:
  - Scoped identity persistence, privacy settings, profile draft state, NIP-96 config, and local media index/config by active `profileId`.
- **Desktop Shell Adaptation**:
  - Removed false-positive desktop shell rendering and window-control invocation on web runtime when native bridge is unavailable.

## [v0.8.7] - 2026-03-06

### Changed

- **Reliability Core (v0.8.7)**:
  - Added `reliabilityCoreV087` feature flag (default enabled) for staged rollback-safe reliability behavior.
  - Added adaptive relay selection scoring (success rate, latency, churn, connection status) for publish ordering.
  - Added quorum-aware relay publish result metadata (`metQuorum`, `quorumRequired`, `failures`) with partial-failure accounting.
  - Added jittered reconnect scheduling and duplicate reconnect suppression with bounded logs.
  - Added sync checkpoint/gap detection helpers and targeted backfill request shaping.
  - Added local-only reliability counters (relay publish/reconnect, sync backfill, storage health/recovery).
  - Added startup/on-demand storage health checks and non-destructive local media index repair path.
  - Added release preflight artifact-matrix workflow assertion (`pnpm release:artifact-matrix-check`).
- **UI/UX Polish and High Contrast**:
  - Improved contrast for "purple buttons" in Light theme by enforcing bold white text globally for better readability.
  - Fixed "invisible" font issue in theme and accessibility selectors where unselected options had poor contrast; unselected buttons now use a clean neutral outline style.
  - Updated Theme Selection UI: Active state now uses a vibrant purple gradient with primary shadows, while inactive states use neutral gray/zinc for clear visual hierarchy.
- **Premium Design Enhancements**:
  - Implemented soft shadows, scale effects, and glassmorphism across settings cards and toggle buttons to create a more high-end feel.
  - Unified the layout and styling of accessibility sections (Reduced Motion, Contrast Assist) with consistent padding and backgrounds.
  - Improved "Reset" action visibility with interactive purple hover effects and better positioning.
- **Network Navigation Improvements**:
  - Added real-time connection and group count badges to the Network sidebar tabs ("All People", "Groups").
  - Refined active tab styling in the Network dashboard with enhanced shadows and smooth scale transitions.

## [v0.8.6] - 2026-03-06

### Added

- **Settings UX Completion (General + Account + Network + Moderation + Updates)**:
  - Completed setup/configuration-focused settings pass with unified action-status feedback patterns.
- **v0.8.6 Maintainer Notes + QA Matrix**:
  - Added dedicated runbook-style settings reliability matrix and troubleshooting guide for release validation.

### Changed

- **Profile Setup Flow**:
  - Improved profile preflight validation and explicit publish phase visibility (including waiting/publishing/failure context).
- **Appearance and Accessibility**:
  - Added/standardized quick controls and persisted accessibility preferences (text scale, reduced motion, contrast assist).
- **Notifications**:
  - Standardized granular channel toggles and permission diagnostics with in-app test action path.
- **Identity and Security Surfaces**:
  - Added identity overview/storage mode badges, challenge-gated private key reveal with auto-hide, integrity diagnostics, posture/capability summary, and session controls.
  - Updated diagnostics UX to follow progressive disclosure (advanced diagnostics collapsed by default).
- **Relay + Storage Polish**:
  - Added relay quick health strip, local relay presets, relay failure hints, storage effective mode, index-based storage metrics, provider validation feedback, and section-local reset actions.
- **Moderation and Privacy**:
  - Upgraded blocklist UX with add/search/bulk actions and deterministic status feedback.
  - Clarified privacy policy controls with explicit DM policy and modern DM posture summary.
- **Updates Page**:
  - Improved release-status UX and fixed dev-build update messaging to avoid false “new version available” states.
  - Converted release notes link into button-style action for visual consistency.

### Fixed

- **Storage Folder Open Runtime Failure**:
  - Prevented unhandled promise rejection/red-overlay class failures when shell scope blocks opening local storage paths.
  - Added graceful fallback behavior and bounded degraded logging.

### [Unreleased - v0.8.5]

### Added

- **Identity Integrity Migration (v0.8.5)**:
  - Added one-time local-state migration with backup snapshot and idempotent dedupe for request/trust/block/conversation references.
- **Abuse Observability Counters**:
  - Added shared counters for suppressed request/join attempts, quarantined malformed events, and deduped state entries.
- **Soft Sybil Risk Signals (No Hard Ban)**:
  - Added runtime risk-scoring hints for request suppression bursts, malformed-event quarantine bursts, and rapid multi-identity activation on one device.
  - Added dev diagnostics surface for risk level/score and per-signal counters.
- **Canonical DM Conversation ID Helper**:
  - Added shared DM conversation-id normalization helper and migrated key DM invite/chat entry points to use it.

### Changed

- **Connection Request Anti-Abuse**:
  - Extended request suppression with typed block reasons and cooldown enforcement in addition to pending/blocked/trusted/self checks.
- **Community Join Request State Machine (Soft Enforcement)**:
  - Promoted join-request guard to explicit runtime state: `none | pending | accepted | denied | expired | cooldown`.
  - Added denied-state handling for relay/policy rejections with deterministic UX messaging and bounded retry behavior.
  - Added scoped cooldown fallback on failed join publish attempts and deterministic suppression reasons.
- **Auth Diagnostics and Mismatch Handling**:
  - Added identity diagnostics snapshot surface for dev/maintainer tooling.
  - Native key mismatch now enters explicit actionable error state (never partial unlock).

### Fixed

- **Ghost Entity Risk from Non-Canonical IDs**:
  - Reduced duplicate/phantom DM entry creation paths by converging to normalized IDs in high-traffic flows.
  - Removed remaining runtime fallback ID construction paths that could generate non-canonical conversation IDs.
  - Extended one-time integrity migration to remap IndexedDB message `conversationId` references to canonical IDs.
- **Malformed Event Containment**:
  - Hardened malformed DM/group event quarantine accounting so invalid identities/events are tracked without creating UI entities.

## [v0.8.4] - 2026-03-05

### Added

- **Canonical Public Key Normalization Utility**:
  - Added `normalizePublicKeyHex(...)` and list normalization helpers to enforce one canonical user-id format across messaging/network/auth flows.

### Changed

- **Invite/Request Identity Stability**:
  - Normalized request-inbox peer identifiers during hydration and runtime updates to prevent duplicate phantom request entries caused by mixed key formats.
  - Normalized blocklist and peer-trust key handling to ensure the same user cannot appear as multiple identities in local trust state.
- **Connection Request Guardrails**:
  - Hardened outgoing `sendConnectionRequest(...)` with deterministic pre-send checks:
    - reject invalid keys,
    - reject self-request,
    - reject blocked/accepted peers,
    - reject duplicate pending incoming/outgoing request states.
- **Community Join Request Guardrails**:
  - Added scoped pending join-request lock keyed by `(myPubkey, relay, groupId)` to block repeat join spam while pending.
  - Added automatic pending-state cleanup when membership is confirmed plus TTL-based stale-state cleanup.
- **Identity Invariants in Auth Flows**:
  - Added strict private-key hex validation and key-pair assertions during import/unlock/passphrase reset flows.
  - Added stored identity normalization on initialization and native-key/public-key match normalization before auto-unlock.

### Fixed

- **Phantom User/Request Duplication Vector**:
  - Fixed multiple local duplication paths where non-canonical peer key representations created parallel request/trust/block entries for the same user.
- **Identity Drift During Unlock/Import**:
  - Prevented unlock/import with mismatched private/public key state, reducing ghost-account behavior caused by inconsistent local identity records.

## [v0.8.3] - 2026-03-05

### Added

- **Release Preflight Guardrail**:
  - Added `pnpm release:preflight` (`scripts/release-preflight.mjs`) to verify branch context, remote tag non-existence, release path sanity, and version/docs checks before tagging.
- **v0.8.3 UX Feature Flag**:
  - Added `chatUxV083` privacy setting (default `false`) and Settings toggle to gate the v0.8.3 media/chat UX path.
- **Shared Media Interaction Utilities**:
  - Added `media-viewer-interactions.ts` with typed helpers for index navigation, zoom clamping/state, pinch math, and swipe direction detection.
  - Added unit coverage for interaction utilities and `chatUxV083` default/persistence behavior.

### Changed

- **Release Workflow Determinism**:
  - Hardened `.github/workflows/release.yml` as the single release publisher with required artifact verification before publish.
  - Added workflow-dispatch dry-run mode (`publish_release=false` default) to build/verify artifacts without publishing a GitHub release.
  - Updated required artifact matrix logic:
    - Windows installer (`.exe` or `.msi`)
    - macOS installer (`.dmg`)
    - Linux installer (`.AppImage` or `.deb`)
    - Android APK (`.apk`)
    - Android AAB (`.aab`, signed or unsigned)
- **Media/Chat UX (Flagged Path)**:
  - Added v0.8.3 media container path behind `chatUxV083` with improved carousel controls (buttons, keyboard arrows, swipe gesture).
  - Refactored lightbox to support `X` close, `+/-` zoom, reset, zoom percentage, wheel/pinch zoom, drag pan, and keyboard shortcuts with previous/next controls.
  - Preserved v0.8.2 fallback UI when the flag is disabled.
- **Design Tokenization for Media Controls**:
  - Added shared media viewer control/nav CSS variables and utility classes in `globals.css` with light/dark compatibility.

### Fixed

- **Lightbox Touch Typing Stability**:
  - Fixed touch-list normalization typing in lightbox interaction handling for React touch events.
- **Message Action Glyph Rendering**:
  - Replaced corrupted inline glyphs in message action buttons with explicit icon components for stable cross-platform rendering.

## [v0.8.2] - 2026-03-04

### Added

- **Relay Status Indicator**: Added a real-time connectivity widget to the sidebar to monitor active Nostr relay connections.
- **Unified Relay Normalization**: Introduced `@dweb/nostr/relay-utils` to ensure consistent relay URL treatment across all features (Communities, Invites, Profiles).
- **Web Worker Optimization**: Re-enabled and hardened the Crypto Web Worker for the PWA, offloading heavy cryptographic operations from the main thread for 60fps UI performance.
- **Real Connection-Request Propagation**: Connection requests are now actually published to the recipient's discovery relays, enabling robust peer-to-peer discovery.

### Changed

- **Stacking Logic (Focus Mode)**: Removed restrictive `z-index` contexts from the application shell layout, enabling image preview overlays to cleanly float above sidebars and top navigation UI for a true fullscreen focus mode.
- **Lightbox Ergonomics**: Added dedicated vertical padding to the chat image preview header so it clears the desktop window wrapper controls gracefully.
- **Contact Stability**: Refactored the messaging sidebar and conversation hooks to reliably hydrate from `connectionStore` (IndexedDB), fixing "missing contacts" on app restart.
- **Infrastructure Resilience**: Hardened the relay pool with circuit-breaker support for standalone (non-hook) publishing.

### Fixed

- **Center-Lock Image Glitch**: Fixed a race condition where boundaries collapsed to `0px` before the image fully rendered, effectively locking the viewer rigidly in the center of zoomed images.
- **Panning Constraint Escapes**: Fixed the drag bounding box limits in the Vault and Chat image previews by capturing actual DOM dimensions (`offsetWidth`/`offsetHeight`), safely preventing users from moving views completely outside image bounds when zoomed.
- **Silent Data Loss in Communities**: Fixed a bug where inconsistent relay URL trailing slashes led to multiple internal IDs for the same community, causing messages to "disappear" into the wrong bucket.
## [v0.8.1] - 2026-03-04

### Added

- **Runtime Log Classification Contract**:
  - Added shared runtime log policy utility with `expected | degraded | actionable` classes.
  - Standardized rate-limited runtime logging via `logRuntimeEvent(...)` for startup-noise paths.
- **Decrypt Failure Classification**:
  - Added explicit decrypt failure classifier to separate foreign/malformed noise from actionable regressions.
  - Added unit coverage for decrypt classification behavior.
- **Relay Runtime Status Model**:
  - Added normalized relay status model: `healthy | degraded | unavailable`.
  - Added unit coverage for relay runtime status derivation.

### Changed

- **Startup and Runtime Signal Hygiene**:
  - Downgraded expected migration-audit and decryption-miss startup noise to bounded lower-severity logs.
  - Hardened DM subscription lifecycle idempotency to suppress duplicate subscribe/close churn.
- **Media Error UX Contract**:
  - Introduced shared media error metadata (`recoverable`, `reasonCode`, `canRetry`, `canOpenExternal`).
  - Unified audio/video/image failure handling with retry + open-external actions.
- **Relay UX**:
  - Relay badge and settings now use normalized degraded-state messaging with actionable guidance.
- **Release Operations**:
  - Added required artifact matrix verification in release workflow before publishing GitHub release assets.
- **Perf Tooling Docs**:
  - Expanded synthetic-load runbook with standardized 10k seed + burst maintainer scenario and safety guardrails.
- **Media Timeline UX**:
  - Switched multi-image/video message rendering to an ordered visual-media carousel.
  - Added left/right navigation controls, keyboard arrow navigation on desktop, and swipe navigation on touch devices.
- **App Shell Footer Labeling**:
  - Replaced stale hardcoded version text in chat shell footers with a release label (`Obscur Preview`) to avoid version drift in UI chrome.

### Fixed

- **Attachment Cache Path Resilience**:
  - Cache permission/path failures now trigger one actionable warning per session and gracefully fall back to remote playback.
- **Message List Hotspot**:
  - Reduced repeated local index parsing in attachment rendering by snapshotting local media index per render cycle.
- **Image Lightbox Controls**:
  - Replaced text close action with an `X` icon.
  - Added wheel zoom (desktop), pinch zoom (mobile), and explicit `+` / `-` zoom controls.

## [v0.8.0] - 2026-03-04

### Added

- **Release Version Integrity Gate**:
  - Added `pnpm version:check` (`scripts/check-version-alignment.mjs`) to enforce release-tracked manifest alignment with root `package.json`.
  - Added `.github/workflows/version-check.yml` to run version-alignment checks in CI on relevant manifest/script changes.
  - Added release preflight checks in `.github/workflows/release.yml` to run `version:check` and `docs:check` before desktop/mobile build jobs.

### Changed

- **Version Sync Coverage**:
  - Hardened `scripts/sync-versions.mjs` with explicit coverage for `apps/pwa`, `apps/desktop`, desktop `tauri.conf.json`, `apps/website`, `apps/relay-gateway`, `packages/*`, and `version.json`.
  - Kept `apps/coordination/package.json` intentionally unversioned for this release cycle.

- **Release Runbook**:
  - Updated docs to require `pnpm version:sync` and `pnpm version:check` as pre-tag checklist steps.
  - Updated root `README.md` and docs index/runbooks with explicit `v0.8.0` release-preparation commands and references.

## [v0.7.13-alpha] - 2026-03-03

### Added

- **Phase 1 Chat Performance Mode (Feature-Flagged)**:
  - Added `chatPerformanceV2` to privacy settings with safe default `false`.
  - Added a Storage settings toggle: **Chat Performance Mode (Phase 1)** for controlled rollout.
- **Batching Test Coverage**:
  - Added persistence batching tests for dedupe, legacy parity, and grouped deletes.
  - Added reducer tests for buffered conversation events and soft live-window behavior.
  - Added group merge tests for dedupe/order/cap behavior.

### Changed

- **Message Persistence Throughput**:
  - Refactored message persistence to queue bus events and flush in batches (32ms cadence, immediate flush at 50 ops) when `chatPerformanceV2` is enabled.
  - Added dedupe-by-message-id per flush and lifecycle-triggered flushes on page hide/unload.
  - Grouped delete operations into a single IndexedDB bulk transaction.
- **Conversation UI Update Path**:
  - Refactored conversation message updates to apply buffered message-bus events once per animation frame in performance mode.
  - Added soft live window policy for active flow (target 120 newest messages), while preserving expanded history after explicit `loadEarlier`.
  - Tuned low-end pagination profile in perf mode (`INITIAL_BATCH_SIZE=60`, `LOAD_EARLIER_BATCH_SIZE=60`).
- **Message List Runtime Adaptation**:
  - Introduced high-load mode heuristics (message count, incoming backlog, fast scrolling).
  - Added adaptive virtualizer overscan (4 under load, 8 normal).
  - Disabled expensive gestures during high-load periods (pull-to-refresh drag and swipe-to-reply drag), while preserving non-drag reply paths.
  - Reduced render-path overhead by precomputing/memoizing per-message render metadata (JSON parse + attachment URL/content derivation).
- **Group Chat Current-Range Stabilization**:
  - Buffered incoming sealed community messages and applied batched state updates with dedupe by event id.
  - Optimized descending merge path with fast-path handling for common single-event inserts to avoid unnecessary full re-sorts.

### Fixed

- **Scroll/Render Jank Under Burst Traffic**:
  - Reduced UI churn from per-event updates in both DM and group flows by switching to batched reducers and batched persistence writes in perf mode.
- **Performance Observability Gaps**:
  - Extended performance monitor counters/metrics with:
    - message bus events per second
    - average batch size
    - average batch flush latency
    - merged/dropped event counts
    - UI update latency p95

## [v0.7.12-alpha] - 2026-03-01

### Fixed

- **NIP-04 Protocol Fix**: Resolved "Failed to decrypt message" errors by removing incorrect SHA256 hashing of the shared secret X-coordinate, ensuring full NIP-04 compliance and interoperability with other Nostr clients.
- **UI Interaction Stability**:
  - Replaced fragile Tailwind-only animations with robust `modal-transition` CSS to fix the "invisible mask" issue in the "Add Connection" and "Send Request" dialogs.
  - Fixed action button clipping in the Network Dashboard by increasing vertical padding in the action header.
  - Refined "Create New Group" UI by removing unnecessary shadows from footer buttons.
- **Messaging Responsiveness**: Optimized NIP-20 `OK` acknowledgment timeout (10s -> 4s) to improve UI snappy-ness after broadcasting events.
- **Multimedia Improvements**:
  - Enhanced `extractAttachmentsFromContent` to support native audio file detection and categorization.
  - Hardened NIP-96 upload service by downgrading intermediate provider failures to `warn` (avoiding blocking Next.js dev overlays) and optimizing retry logic.
  - **Build & Types Standardization**: Fixed a critical TypeScript build error in the PWA by standardizing terminology from `Contact` to `Connection` and `ContactGroup` to `ConnectionGroup` across the network components, aligning them with the core invite system types.
- **Store Refactoring**: Renamed internal `contactStore` references to `connectionStore` for architectural consistency.

### [Unreleased]

### Added

- **Multimedia Support (WP-6)**: Implemented full video and audio upload support in chat via NIP-96.
  - Client-side compression for videos using `@ffmpeg/ffmpeg` (WASM) to transcode to 720p/128k before upload.
  - Automatic logic for generating lightweight thumbnails for video previews directly in the browser.
  - Smart NIP-96 provider routing: images are routed to `nostr.build`, while larger video/audio files are routed to `void.cat` and `sovbit`.
  - Added custom, aesthetically pleasing `VideoPlayer` and `AudioPlayer` components for inline media playback within the chat UI.
  - Complete internationalization (i18n) for media statuses in Chinese, Spanish, and English.
  - Added an explicit **best-effort storage model** for OSS/no-cloud operation, including in-app guidance that uploads depend on public NIP-96 providers and external-link fallback for critical media.

### Changed

- **Media Upload Reliability Policy**:
  - Introduced shared upload limits tuned for public providers: image 8MB, audio 20MB, video 35MB.
  - Added final pre-upload validation in `Nip96UploadService` so all upload entrypoints (chat + group/avatar flows) enforce the same constraints.
  - Added policy-based image preprocessing before upload, plus stricter UX messaging for timeout/size failures.
  - Updated composer UI copy to explain why media delivery is best-effort without dedicated cloud infrastructure.

### Fixed

- **Tor Network Integration (WP-5)**: Fixed "os error 3" and "os error 193" when activating Tor by correcting Sidecar paths for Tauri v2.
  - Wrote a Node.js pre-script (`scripts/setup-tor.mjs`) to auto-download and extract the correct Tor Expert Bundle binary for the host OS/architecture.
  - Re-configured `tauri.conf.json` and capabilities to use the flattened `tor` executable path.
- **Media CORS Issues**: Removed overly restrictive COOP/COEP headers from `next.config.ts`, unlocking CORS capabilities for playing media from third-party storage providers inside the `VideoPlayer`.
- **UI/UX Enhancements**:
  - Implemented a unified animated `AuthScreen` with FlashMessages, replacing native toasts.
  - Reordered the Profile Settings page to center the user avatar above the username.
  - **Avatar Redirection**: Clicking own avatar in message history maps to Settings -> Profile, while other avatars map to their respective Connection Profiles.
  - **Message List Performance**: Migrated to IndexedDB, added message virtualization, anchored scrolling, and debounced filters for smoother chat interactions.

## [v0.7.11-alpha] - 2026-02-27

### Phase 4: Native Mobile Implementation Complete (WP-3 to WP-6)

- **WP-3: Background Sync**: Implemented background synchronization engines for Android (`WorkManager`) and iOS (`BGAppRefreshTask`) calling into `libobscur` to securely fetch and decrypt messages while the app is suspended.
- **WP-4: Secure Key Storage**: Integrated OS-level hardware-backed keystores (`AndroidKeyStore` and iOS `SecureEnclave`) for robust private key management. Added biometric authentication requirements.
- **WP-5: Mobile UX Adaptation**:
  - Overhauled layout with safe area insets (`env(safe-area-inset-bottom)`) and expanded `10rem` padding to prevent bottom navigation bar overlap.
  - Implemented a unified `MobileTabBar` to replace the desktop sidebar on small screens.
  - Added swipe-to-reply gestures and native keyboard adjustments.
  - Refined Settings and Network pages for a strict master-detail mobile flow, dropping redundant headers.
- **WP-6: CI/Release Pipeline**:
  - Configured GitHub Actions workflows (`build-android.yml`, `build-ios.yml`) for automated building and signing of Android (APK/AAB) and iOS (IPA) artifacts.
  - Added automated workspace version synchronization script (`sync-versions.mjs`).
  - Added a comprehensive `MOBILE_RELEASE_GUIDE.md`.

## [v0.7.10-alpha] - 2026-02-26

### Phase 4: Native Mobile Implementation (WP-1 & WP-2)

- **WP-1: Tauri V2 Mobile Scaffold**:
  - Initialized Android project scaffold in `apps/desktop/src-tauri/gen/android/`.
  - Configured `tauri.conf.json` with universal identifier `app.obscur.desktop` and correct mobile SDK target versions (Android 7.0+, iOS 16+).
  - Added target-specific Rust dependencies in `Cargo.toml` for Android and iOS platforms.
  - Successfully configured the build environment for cross-platform Rust targets (`aarch64-linux-android`, `aarch66-apple-ios`, etc.).
- **WP-2: Privacy-Preserving Push Notifications**:
  - Created detailed technical specification: `docs/PHASE_4_NATIVE_MOBILE_SPEC.md`.
  - Implemented `decrypt_push_payload` in `libobscur` (Rust) to handle local decryption of E2EE push notifications.
  - Enabled `tauri-plugin-notification` permissions in `desktop.json` and `mobile.json` capabilities.

### Changed

- **Messaging Controller Decomposition (WP-2)**: Continued extracting logic out of `EnhancedDMController` into focused service modules to improve testability and reduce controller size.
  - Extracted/extended outgoing send pipeline helpers (optimistic insert, publish, fallback, queueing).
  - Extracted relay `OK` handling into a dedicated handler.
  - Extracted recipient relay-hint application (nprofile + NIP-65 write relays).
- **Light Theme Polish**: Enhanced light theme color scheme for settings and chat area to improve contrast and "premium" feel.

### Added

- **Messaging controller service modules** (Phase 1 / WP-2):
  - `apps/pwa/app/features/messaging/controllers/outgoing-dm-publisher.ts`
  - `apps/pwa/app/features/messaging/controllers/outgoing-dm-send-preparer.ts`
  - `apps/pwa/app/features/messaging/controllers/relay-ok-message-handler.ts`
  - `apps/pwa/app/features/messaging/controllers/recipient-relay-hints.ts`
- **WP-2 progress note**: `docs/WP-2_DM_CONTROLLER_DECOMPOSITION_PROGRESS.md`

## [v0.7.9-alpha] - 2026-02-23

### Major Refactor: Transition to "Connections"

- **Terminology Standardization**: Systematically renamed all "Contact" related terminology to "Connection" across the invite system, services, and UI components to better reflect the underlying cryptographic relationships.
- **Unified Invite Manager**: Completed the final implementation of the `InviteManager` as the central orchestrator for QR codes, shared links, and connection requests.
- **Enhanced Deep Link Handling**: Updated `DeepLinkHandler` and `URLSchemeHandler` to support `obscur://connection/` schemes and `connection` URL search parameters.
- **UI/UX Synchronization**: Refactored major components including `ConnectionRequestInbox`, `ConnectionList`, `ConnectionImportExport`, and `OutgoingConnectionRequests` to use the new connection-based APIs and terminology.

### Added

- **Messaging UI Avatars**: Implemented bottom-aligned, orientation-aware avatars in `MessageList`. Incoming avatars appear on the left, outgoing on the right.
- **Unified Invitation Cards**: Refactored `CommunityInviteCard` into a premium "rich card" layout that adapts its footer actions based on invite status and ownership.
- **Response Banner Styling**: Standardized `CommunityInviteResponseCard` with elegant status banners and icons (PartyPopper/Ban).

### Changed

- **Privacy Settings**: Renamed `allowContactRequests` to `allowConnectionRequests` in the profile privacy configuration for consistent terminology.
- **Search & Performance**: Updated `ConnectionSearchIndex` and internal caching mechanisms with improved terminology and optimized word indexing.
- **Accessibility & UX**: Standardized ARIA labels, keyboard hints, and error messages in `accessibility-ux.ts` to use "connection" terminology.

### Fixed

- **Store TypeError**: Resolved `TypeError: connectionStore.getContactByPublicKey is not a function` by implementing the missing method in `connection-store.ts` and updating the interface.
- **Render Safety**: Added robust null-checks for `.slice()` and string indexing in `UserAvatar`, `ChatHeader`, and `SenderName` to prevent crashes during profile resolution.
- **Template Literal Parsing**: Fixed multiple instances of broken or escaped template literals in `accessibility-ux.ts` that were causing rendering and linting issues.
- **Deep Link Routing**: Resolved an issue where contact-based deep links were not correctly resolved after the terminology shift.

## [v0.7.8-alpha] - 2026-02-21

### Major Overhaul: Sealed Communities Protocol

- **Egalitarian Privacy First**: Deprecated legacy NIP-29 administrative roles. Implemented the "Sealed Communities" (Kind 10105) protocol where all keyholders participate as equal members, ensuring maximum decentralization and privacy.
- **Invite & Key Distribution**: Implemented deterministic NIP-17 Gift-Wrapped DMs for secure, peer-to-peer distribution of Community Room Keys. Support for QR code scanning and `obscur://` deep link invite redemption.
- **Consensus Moderation**: Introduced "Vote to Kick" sealed events. Content moderation and member expulsion now rely on a strictly enforced >50% client-side consensus threshold, eliminating single points of administrative failure.
- **Secure Key Rotation**: Automated cryptographic Room Key rotation upon member expulsion to maintain community integrity.
- **Registry Independence**: Communities can now operate without centralized relay tracking, relying entirely on obscured identifiers and shared secrets.

### Added

- **Unified Auth Flow**: Completely redesigned the authentication and onboarding experience. Integrated account creation and login into a single, high-fidelity `AuthScreen` with smooth `framer-motion` animations.
- **"Remember Me" Persistence**: Implemented opt-in session persistence. Users can now choose to save their encrypted session, allowing for seamless auto-unlock on app restart.
- **Instant Discovery**: Account creation now automatically generates and publishes a unique invitation code in the background, making new users immediately discoverable.
- **Sidebar Categorization**: Introduced a unified Segmented Control to toggle between "Chat" (Direct Messages) and "Community" (Groups), replacing static buttons.
- **Chat Management**: Users can now pin, unpin, and soft-delete (hide) conversations directly from the sidebar via a new three-dot context menu. Pinned chats remain reliably at the top.
- **Request Inbox Management**: Added a "Clear All" button to instantly wipe the connection requests inbox history.
- **Community Invitation UI**: Introduced `CommunityInviteResponseCard` to display invitation acceptance/rejection status as an elegant notification pill instead of raw JSON.
- **Group Member Presence**: Implemented dynamic member discovery tracking. The app now persists members discovered through live chat history to the local database.

### Changed

- **Technical Protocols**: Standardized all internal persistence schemas and React hooks around the simplified egalitarian protocol, greatly reducing state fragmentation.
- **UI Architecture**: Extracted Radix-based components (Checkbox, Avatars) and completely redesigned interactive lists to eliminate nested `<button>` hydration errors and improve keyboard accessibility.
- **Streamlined Onboarding**: Removed the multi-step `OnboardingWizard` in favor of the new unified `AuthScreen`.
- **Global Esthetics (Midnight Slate)**: Shifted the primary color system from generic grays to a premium "Midnight Slate / Indigo" palette using OKLCH color spaces. Enhanced dark mode depth and light mode clarity across the entire PWA.

### Fixed

- **Strict Relay Clock Skew**: Fixed an "event too much in the future" error that occurred when publishing events to strict relays. A conservative negative offset has been applied to the timestamp generation logic natively.
- **Community Creation Resilience**: Fixed a critical issue where group creation failed on strict relays (like `groups.fiatjaf.com`) with a `group doesn't exist` error.
- **Test Suite Stability**: Resolved all failures in the `apps/pwa/app/features/invites/utils/__tests__` test suite (13 files, 154 tests now passing).
- **Localization Resilience**: Fixed missing and misconfigured English translation keys (e.g., `messaging.pin_chat`, `messaging.direct_messages`) that were causing raw function/key names to render in the UI.
- **Dependency Resolution**: Fixed a `Module not found` error for `@radix-ui/react-checkbox`.
- **Hydration & Semantics**: Fixed multiple DOM nesting errors where interactive elements were improperly wrapped inside buttons in the Sidebar and Search views.
- **Community Invite Crash**: Fixed a critical `TypeError: adminPubkeys is not iterable` that occurred when accepting group invitations.
- **Group Member Sync**: Resolved the "1 Member" bug by properly seeding both the inviter and invitee on group creation and syncing live-discovered members to persistence.
- **Persistence Resilience**: Hardened `toPersistedGroupConversation` to gracefully handle missing group metadata and prevent runtime crashes.
- **Message Parsing**: Improved JSON detection in `MessageList` to correctly route specialized community events to their respective UI cards.

## [v0.7.6-alpha] - 2026-02-13

### Added

- **Invite Code Search**: Integrated secure invite code resolution directly into the "New Chat" dialog. Users can now enter an `OBSCUR-...` code to instantly find and connect with peers, streamlining the "Add Contact" workflow.
- **Custom Scrollbars**: Implemented universal, seamless scrollbars that remain hidden by default and appear on hover, providing a more immersive and cleaner interface.

### Changed

- **Messaging Stability**: Optimized dependency tracking in `EnhancedDMController`, preventing unnecessary relay re-connections and ensuring consistent message delivery during network fluctuations.
- **Performance**: Prioritized critical LCP (Largest Contentful Paint) images in the authentication gateway, significantly improving the initial load experience and Core Web Vitals score.
- **Test Infrastructure**: Refactored `enhanced-dm-controller.test.ts` to use top-level imports and standard Vitest `vi.mocked()` patterns, replacing legacy `require()` calls to improve type safety and maintainability.

### Fixed

- **Chat Layout**: Resolved an issue in the web version where the input composer would disappear below the fold. The input box is now strictly pinned to the bottom of the viewport.
- **History Persistence**: Fixed a critical bug where chat history and contacts were not loading on startup/refresh.
- **UI Interactions**: Added click-outside listeners to predictably close message context menus and reaction pickers.
- **First Message Visibility**: Corrected race condition in message ingestion that prevented initial connection request messages from displaying in real-time.
- **Localization Polish**: Fixed broken translation keys (including `common.searching` and stranger warning titles) and localized hardcoded UI elements.
- **React Hooks**: Resolved internal dependency warnings in the messaging components, ensuring stable and predictable state updates.

## [v0.7.5-alpha] - 2026-02-10

### Changed

- **Profile Flow Optimization**: Reverted mandatory profile publishing enforcement to resolve infinite redirect loops on unstable connections. Users can now choose to skip the username step during onboarding if desired.
- **Onboarding UX**: Restored the "Skip" button in the onboarding wizard, allowing for a more flexible user journey when setting up a new identity.
- **Code Stability**: Refactored `AuthGateway` and hook dependencies to fix React strict mode violations and improve application stability during the authentication phase.

## [v0.7.4] - 2026-02-09

### Added

- **Mobile Native Crypto**: Implemented hardware-backed security on Android and iOS using native platform storage, replacing WASM fallbacks.
- **Deep Linking**: Added system-level support for `obscur://` and `nostr://` protocols for seamless invite redemption and peer-to-peer discovery.
- **Improved Background Handling**: Optimized relay connection persistence and notification handling for mobile environments.
- **Native Media Uploads**: Switched to native OS file pickers for smoother integration with system galleries and improved upload reliability on mobile.

### Changed

- **Group Chat Polish**: Refined member management UI, optimized touch targets, and enabled native avatar uploads for group metadata.
- **Security Persistence**: Optimized session hydration logic for mobile environments.

## [v0.7.2] - 2026-02-09

### Added

- **Dual-Path Upload Architecture**: Re-enabled direct browser uploads for the PWA while maintaining the high-performance Rust-native path for Desktop/Mobile.
- **Client-Side NIP-98 Signing**: Implemented secure, client-side NIP-98 authentication for browser uploads using the internal `@dweb/nostr` library.
- **Relay Stability**: Added a defined debounce (2s) to the initial message sync to prevent redundant network requests when multiple relays connect simultaneously on startup.

### Fixed

- **PWA Uploads**: Resolved the "NIP-96 upload requires desktop app" error by intelligently routing uploads based on the runtime environment.
- **Initial Sync Spam**: Fixed a race condition where the app would trigger a full message sync for _each_ relay that connected, instead of waiting for the connection pool to stabilize.
- **Relay Connection Hang**: Fixed a critical race condition where the desktop app would get stuck in a "connecting" state because the backend reported a relay as "already connected" without triggering the necessary frontend events.
- **Desktop Message Encryption**: Implemented native NIP-04 encryption/decryption in the Rust backend to fix message sending failures on Desktop, covering for the lack of raw key access in the frontend.

## [v0.7.1-alpha] - 2026-02-09

### Added

- **In-Memory Native Session**: Implemented a more robust session management pattern that keeps active keys in memory on the Rust backend, reducing reliance on the OS keychain for every operation.
- **Auto-Hydration**: The desktop backend now automatically loads keys from the OS keychain into the in-memory session on startup, ensuring a seamless experience after app restarts.

### Fixed

- **NIP-96 Response Parsing**: Added support for servers (like `nostr.build`) that wrap upload results in a `data` array.
- **Tauri Permissions**: Fixed a "Command not found" error by explicitly allowing `init_native_session` and `clear_native_session` in the app's capability configuration.
- **Session Sync**: Resolved "Missing native key" errors by making the frontend the source of truth for session initialization.

## [v0.7.0-alpha] - 2026-02-08

### Added

- **Native NIP-98 Signing**: Moved NIP-98 authentication event generation and SHA-256 payload hashing entirely into the Rust backend. This ensures a perfect match between uploaded bytes and the authentication tag, eliminating 401 Unauthorized errors.
- **Native Network Cutover**: Fully audited the Desktop networking stack to ensure 100% of relay and HTTP traffic is routed through the native Rust runtime (ignoring WebView browser fallbacks).

### Fixed

- **Upload Reliability**: Resolved persistent 401 errors during NIP-96 file uploads by delegating signing to the native layer, which bypasses WebView CORS and IPC overhead.
- **Relay Connectivity**: Patched adhoc WebSocket leaks in the invite flow to use the native transport.

### Changed

- **Stabilization Guardrails**: Hardcoded a stable set of default relays and storage providers for v0.7. Custom relay and provider editing has been disabled in the UI to ensure a reliable "golden path" for the release.

## [v0.6.6-alpha] - 2026-02-08

### Added

- **Native Networking Runtime**: Centralized native HTTP + WebSocket networking behind a single Rust runtime to ensure consistent proxy/Tor routing and improve diagnostics.
- **Relay Probe Diagnostics**: Added `probe_relay` to quickly distinguish DNS/TCP/WebSocket upgrade failures and surface actionable errors (including HTTP gateway responses).
- **Relay Resilience**: Native relay transport now tracks desired relays and automatically reconnects with exponential backoff after disconnects.
- **Fallback Relays (Desktop)**: When all configured relays fail to connect, the app adds a small transient fallback set to avoid hard offline state.

### Fixed

- **Tor UX**: Removed reliance on WebView proxy configuration at window creation time, enabling live Tor switching without requiring an app restart.
- **Upload Debugging**: Improved native upload diagnostics and strict-provider behavior (no redirects), with multipart field-name compatibility retry.

## [v0.6.5-alpha] - 2026-02-08

### Fixed

- **Android Build**: Isolated native keychain to desktop platforms only (Windows, macOS, Linux) using conditional compilation. Android builds now succeed without OpenSSL dependencies.
- **Mobile Crypto Fallback**: Android automatically uses WASM-based crypto with encrypted IndexedDB storage, maintaining security without native keychain.

## [v0.6.4-alpha] - 2026-02-08

### Fixed

- **Android Compilation**: Migrated `tokio-tungstenite` from `native-tls` to `rustls` to resolve OpenSSL dependency issues during Android cross-compilation.

### Added

- **Native Key Management**: Secure storage for Nostr private keys (nsec) using the operating system's native keychain (Windows Credential Manager, macOS Keychain) via `keyring`.
- **Native Signing**: Optimized cryptographic signing of Nostr events in Rust for improved performance and security.
- **Auto-Unlock**: Automatic detection and authentication using native keys on startup, providing a seamless login experience.
- **Improved Security Boundaries**: The private key is now isolated at the native layer, never touching the frontend/WebView memory once stored.

### Fixed

- **Relay Stability**: Fixed "Future is not Send" errors and deadlock issues in the native relay transport by ensuring MutexGuards are not held across await points.
- **Desktop Permissions**: Refactored capability management to use explicit permission identifiers, ensuring native features work correctly in production bundles.
- **Dependency Optimization**: Updated `nostr` and `tokio` dependencies for better cross-platform compatibility and performance.

## [v0.5.0-alpha] - 2026-02-06

### Added

- **Tor Network Integration**: Full Tor support for desktop, routing all application traffic through a bundled Tor sidecar for enhanced privacy and censorship resistance.
- **Native Mobile Support (Android)**: Initial alpha release for Android.
- **Mobile UI Polishing**: Implemented safe area insets for notches and dynamic islands, ensuring content isn't obscured.
- **Deep Linking**: Support for `obscur://` and `nostr:` links to open invites, profiles, and conversations directly in the app.
- **Native File Uploads**: Integrated NIP-96 file upload support using native file pickers and camera.
- **Native Notifications**: Implemented foreground polling and native system notifications for new messages.
- **Status Bar Sync**: The system status bar now automatically syncs with the app's theme (light/dark mode).
- **Core Feature Parity**: Validated WASM crypto fallback and essential features on mobile environment.
- **CI/CD**: Automated Android APK building via GitHub Actions (`mobile-release.yml`).

## [v0.4.0] - 2026-02-03

### Added

- **Mobile Experience Polish**: Added Swipe-to-Reply gestures, larger touch targets for better accessibility, and fixed virtual keyboard occlusion with `100dvh`.
- **Core Refinements**: Theme synchronization fix (FOUC), message deduplication, and v0.4.0 versioning.
- **Auto-Storage Configuration**: Automatically enables NIP-96 storage with `nostr.build` as default when hosted on Vercel to resolve "Local upload" errors out-of-the-box.
- **Improved Settings UI**: Recommended storage providers are now always visible with clear descriptions and one-tap selection.
- **Group Management Extensions**: Admins can now add members via public key, remove members from the settings sheet, and see role-based badges (Owner/Mod).
- **Group Chat Avatar Upload**: Support for uploading a group avatar during the creation process.
- **Group Metadata Editing**: Admins can now edit group name, description, and picture from the group settings sheet.
- **Group Invite ID**: Added "Copy Invite ID" functionality to easily share group joining information.
- **Native Avatar Upload**: Support for NIP-96 file uploads. Users can now upload profile pictures directly to Nostr storage providers or local storage.
- **NIP-05 Verification**: Built-in verification flow for NIP-05 identifiers (e.g., alice@domain.com). Displays verification status in settings.
- **DM Privacy Controls**: New granular privacy settings in "Privacy & Trust" tab. Users can now choose to Receive DMs from "Everyone" or "Contacts Only".
- **Enhanced DM Filtering**: Client-side filtering of direct messages from strangers when "Contacts Only" is enabled.

### Fixed

- **Theme Sync**: Resolved the "white flash" (FOUC) on initial load by implementing a blocking theme script in the root layout.
- **Message Deduplication**: Fixed a bug where duplicate group messages were rendered by implementing event ID filtering.
- **Profile Save Timeout**: Fixed an issue where saving the profile on Desktop would hang indefinitely.

### Changed

- **Profile Management**: Refactored profile settings with immediate local previews and NIP-05 integration.
- **Auto-Lock**: Changed default auto-lock timeout from `15m` to `Never` (0) for new accounts to improve initial user experience.

## [v0.3.7] - 2026-02-02

### Added

- **Message Reactions**: Support for NIP-25 reactions. Hover over a message to react with emojis. UI updates optimistically.
- **Multiple File Uploads**: Users can now select and upload multiple images/videos at once in the composer.
- **Automated Connection Requests**: Messaging an unaccepted peer now automatically triggers a formal connection request, improving the first-contact experience.
- **Request Notifications**: Visual feedback (Toasts and Sidebar Badges) for connection request status.

### Fixed

- **Desktop Uploads**: Fixed a 500 error in the desktop app by replacing `uuid` with `crypto.randomUUID()` to resolve bundling issues.
- **Inbox Deduplication**: Fixed a bug where the unread request count would increment infinitely by implementing event ID deduplication.
- **Sidebar Badges**: Fixed incorrect unread counts in the Sidebar "Requests" tab.

### Changed

- **Type Safety**: Refactored `ReactionsByEmoji` and `RequestsInboxItem` for better type safety and cleaner code.

## [v0.3.6] - 2026-02-01

### Fixed

- **SemVer Compliance**: Fixed build issue where version `0.3.5.1` was rejected by Tauri/Cargo. Bumping to `0.3.6` resolves this.

## [v0.3.5.1] - 2026-02-01

### Fixed

- **Build Error**: Fixed a TypeScript error in `lock-screen.tsx` where `onForget` was not destructured.
- **Identity Reset**: Added a "Forgot passphrase? Reset account" button to the Lock Screen and Locked Identity View. This allows users to manually clear their local data and start over.

## [v0.3.5] - 2026-02-01

### Added

- **Desktop/PWA Parity**: ensured feature parity between the Desktop app and PWA.

### Fixed

- **Profile Save Timeout**: Fixed an issue where saving the profile on Desktop would hang indefinitely due to a deadlock in the Crypto Worker.
- **Crypto Worker**: Forced the Crypto Service to use the main thread when running in Tauri context to avoid worker loading issues.
- **Connection Reliability**: Increased timeouts for Relay connection (5s -> 15s) and Publishing (5s -> 10s) to handle slower network conditions.
- **UI Popup Fixes**:
  - Removed the non-functional "Virtual Keyboard" help button from the Settings header.
  - Fixed the "Delete Account" dialog positioning by using React Portals to ensure it is always centered.

### Changed

- **Versioning**: Synchronized version across PWA, Desktop, and Tauri configuration.
