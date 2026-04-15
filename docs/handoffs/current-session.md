# Current Session Handoff

- Last Updated (UTC): 2026-04-15T05:40:18Z
- Session Status: in-progress
- Active Owner: DM delete/restore release-blocker investigation

## Active Objective

Close the privacy-critical fresh-device DM delete/restore regression before the next release tag by proving the canonical backup/restore, tombstone, and read-owner paths do not resurrect deleted history on login or new-device restore.

## Current Snapshot

- What is true now:
  - Streaming update policy owner is now explicit in `apps/pwa/app/features/updates/services/streaming-update-policy.ts` with deterministic channel/rollout/kill-switch/min-safe decisions.
  - Desktop updater UI now enforces policy eligibility before install and classifies install failures into safe rollback outcomes that preserve current version.
  - Release gates now include streaming update contract checks (`pnpm release:streaming-update-contract:check`) and workflow publication of `streaming-update-policy.json` alongside release artifacts.
  - Offline deterministic shell owner evidence now includes focused SW registrar boundary tests (`pwa-service-worker-registrar.test.tsx`) and passes in focused and release-test-pack gate runs.
  - `Reset Local History` now records a scoped cutoff so old relay-backed DM history and stale sync checkpoints do not come straight back after reset.
  - Runtime DM transport used to stay disabled during `bootstrapping`, even for the correct unlocked account, which could stall realtime incoming DMs and delete commands behind account restore.
  - DM transport now stays enabled during `bootstrapping` when projection ownership matches the active identity.
  - Outgoing DM rows now persist canonical event IDs (`rumor.id` for NIP-17) so delete-for-everyone can target recipient-visible IDs directly instead of relying on wrapper-only IDs.
  - `signEvent` now preserves caller-provided `created_at`, removing timestamp drift that previously broke deterministic rumor-id derivation for delete convergence.
  - Incoming transport now has a safety-sync watchdog (15s interval + tab-visibility resume trigger) so silent subscription stalls cannot leave DM/delete state stale indefinitely without refresh.
  - DM online indicators now resolve through a canonical owner path in `main-shell`: relay presence first, then bounded recent inbound peer-activity evidence to prevent active-chat false `OFFLINE`.
  - Encrypted account backup restore/hydration now quarantines delete-command DM rows and their targeted historical rows before chat-state restore/import, and chat preview rows no longer keep command payload snippets as `lastMessage`.
  - Late backup-restore refresh now covers both surfaces that were staying blank on fresh devices: `MessagingProvider` rehydrates scoped DM/contact state when `CHAT_STATE_REPLACED_EVENT` lands, and `useConversationMessages` rehydrates already-open conversations on that same replace event so restored history appears without a reload.
  - Phase M1 now has a canonical offline UI asset inventory (`docs/roadmap/v1.3.8-offline-ui-asset-inventory.md`) and an executable guard (`pnpm offline:asset-policy:check`) wired into `pwa-ci-scan` and `release:test-pack`.
  - Vault media now retains source conversation ownership and exposes source-specific origin copy for DM vs community media without inventing a detached media route or second routing owner.
- What changed in this thread:
  - Investigated the user-reported DM delete/restore regression before the next tag and identified two likely owner-path risks in the current worktree: stale account-sync mutation replay publishing old local state on mount before startup restore, and restore/materialization drift leaving restored DM history richer in legacy chat-state than in projection/indexed reads.
  - Revalidated the current in-progress repair path with focused tests and typecheck: `use-account-sync`, encrypted backup restore, projection read authority, incoming-DM tombstone suppression, conversation hydration, account-event bootstrap/reducer, and message-persistence suites are green in `apps/pwa`.
  - Browser production replay now verifies the recovered Vault owner path end to end with seeded live data: imported a local identity through the real auth flow, rendered image/video/audio/file rows in `/vault`, confirmed direct-message/community source badges, completed `Remove from Vault -> Removed filter -> Restore to Vault`, and saved downloaded image/video/audio/file artifacts under `.artifacts/runtime-replay/downloads/`.
  - Browser production replay now verifies two live messaging upload guardrails in the real composer on a seeded unlocked DM thread: selecting two videos surfaces the single-video-per-message error copy, and selecting a 385MB file surfaces the 384MB total-batch guard copy before send.
  - Published v1.3.8 release to origin:
    - release commit `92c4b29d` (`release: v1.3.8`) pushed to `main`,
    - tag `v1.3.8` created locally and pushed to `origin`.
  - Version contract is now aligned at `1.3.8` across release-tracked manifests (`pnpm version:sync`, `pnpm version:check`).
  - Committed and pushed release-prep scope to `main` (`339b9da9`) without deleting the v1.3.8 roadmap file.
  - Initialized a dedicated v1.3.8 replay packet:
    - `docs/assets/demo/v1.3.8/README.md`
    - `docs/assets/demo/v1.3.8/manual-verification-checklist.md`
    - `docs/assets/demo/v1.3.8/runtime-evidence-summary.json`
    - raw/gifs placeholder READMEs.
  - Started M2 replay capture execution:
    - built desktop artifacts via `pnpm -C apps/desktop build` (Windows NSIS output produced),
    - captured initial PWA offline replay artifacts via Playwright automation (`pwa-online.png`, `pwa-offline.png`, replay JSON/startup log).
  - Resolved the PWA replay blocker: stale generated SW artifacts were causing install/control failures (`swControlled=false`) due old build-id precache URLs.
  - Landed a repository-owned service worker owner path (`apps/pwa/public/sw.js`) and tightened offline asset policy checks to require SW navigation/cache contracts.
  - Reran production-mode offline replay; PWA now passes control/offline/reconnect checks (`swControlled=true`, `offlineBootOk=true`, `offlineNavOk=true`).
  - Added streaming update policy contract module + tests (`streaming-update-policy.ts`, `streaming-update-policy.test.ts`) and integrated policy enforcement into `DesktopUpdater` (rollout, kill switch, min-safe, failure classification).
  - Added release update-contract checks and generation tooling:
    - `scripts/check-streaming-update-contract.mjs`
    - `scripts/build-streaming-update-manifest.mjs`
    - workflow wiring in `.github/workflows/release.yml` to generate/upload/publish `streaming-update-policy.json` with artifacts.
  - Hardened `scripts/run-release-test-pack.mjs` Windows command execution path so `tsc`/`vitest` are resolved reliably in workspace runs.
  - Added focused offline app-shell owner boundary coverage in `app/components/pwa-service-worker-registrar.test.tsx`.
  - Added v1.3.8 streaming contract doc and linked it from roadmap/doc indexes.
  - Updated v1.3.8 roadmap checklist with completed M1 items, focused M2 tests, and M3 gate pass state.
  - Added the reset cutoff store and bootstrap filtering for restored DM history/checkpoints.
  - Relaxed the runtime messaging transport gate so incoming transport remains active during restore/bootstrap for the bound account.
  - Added focused test coverage for the transport-owner bootstrap contract.
  - Added explicit delete-permission guidance to batch delete mode so users see the exact distinction between `Delete for me` and `Delete for everyone` at action time.
  - Added focused ChatView test coverage that locks the new delete-permission copy contract.
  - Expanded runtime transport owner activation phases to include `activating_runtime`, aligning incoming transport with unlocked restore flow and preventing bootstrap-era realtime DM/delete stalls.
  - Updated runtime transport owner tests to lock the new `activating_runtime` owner contract.
  - Unified DM conversation alias handling in `use-conversation-messages` so hydrate/load-earlier/realtime bus updates converge across legacy peer-id and canonical `my:peer` conversation ids.
  - Added integration coverage for alias realtime receive/delete convergence and alias-hydration convergence from IndexedDB.
  - Added canonical event-id output to `buildDmEvent` and threaded it into outgoing message preparation/publish fallback so local rows carry stable delete targets.
  - Prioritized canonical event IDs in delete command targeting (`use-chat-actions`) before wrapper/local row IDs.
  - Added focused tests for DM canonical ID derivation and outgoing send-preparer canonical ID persistence.
  - Added crypto unit coverage asserting `createNostrEvent` receives `createdAtUnixSeconds` from unsigned events.
  - Added transport safety-sync gating in `useEnhancedDMController` to trigger catch-up sync while visible/connected and on visibility resume.
  - Added focused unit coverage for safety-sync eligibility contracts in `enhanced-dm-controller.test.ts`.
  - Added `isRecentPresenceEvidenceActive` service and integrated it in `main-shell` so chat header/sidebar online state uses relay presence OR recent inbound peer activity evidence.
  - Added focused unit coverage for the new presence evidence resolver and revalidated sidebar/chat-header/main-shell surface tests.
  - Added delete-command quarantine at encrypted backup parse/merge/hydrate/build boundaries so command payload rows and targeted historical rows cannot be restored into chat-state domains.
  - Added focused backup-service regression tests for merge and indexed-hydration delete-command suppression.
  - Made initial conversation hydration adaptive in `use-conversation-messages`: when the newest page has too few displayable rows (for example after command/delete cleanup), hydration auto-scans earlier windows toward the canonical latest visible window target (200 messages) instead of stopping after the first visible message.
  - Added integration coverage for sparse latest-window hydration and latest-200 cap contract (`hydrates up to the latest visible 200-message window when newest page is mostly hidden command rows`).
  - Fixed sparse-window scan anchor selection to use the earliest valid row timestamp instead of the last raw row, so malformed/zero-timestamp command rows cannot prematurely halt hydration and leave `Load More` as the only visible control.
  - Added integration coverage for malformed timestamp rows in sparse history windows (`continues sparse-window hydration when malformed rows have zero timestamps`).
  - Identified another blank-window contributor: `voice-call-signal` payload rows were retained by hydration but intentionally rendered hidden in `MessageRow`, allowing a full latest window of non-visible rows with only `Load More` shown.
  - Updated `use-conversation-messages` displayability filtering to suppress `voice-call-signal` payload rows before they reach UI state.
  - Added a message-list virtualizer self-recovery path (`messaging.message_list_virtualizer_recovery_attempt`) so if messages exist but virtual rows are empty, the list re-measures/repositions automatically instead of requiring manual user action.
  - Added integration coverage for hidden-signal-only latest windows (`filters hidden voice-call-signal payload rows from hydration so timeline is not blank`).
  - Fixed intermittent sidebar/menu navigation drops by making nav clicks explicitly call `router.push` on primary clicks in `app-shell` and `mobile-tab-bar`, while preserving the existing hard-fallback route watchdog.
  - Removed dependence on `event.defaultPrevented` short-circuiting in nav handlers, which could silently discard user navigation intent under layered gesture/capture handlers.
  - Added/updated focused nav tests to assert router-driven navigation request dispatch.
  - Added `scripts/check-offline-ui-asset-policy.mjs` to enforce local-first shell asset contracts (no remote shell URLs, manifest local-icon contract, `/sw.js` registration owner check).
  - Added `pnpm offline:asset-policy:check` and wired it into `scripts/pwa-ci-scan.mjs` and `scripts/run-release-test-pack.mjs`.
  - Added a v1.3.8 Phase M1 inventory doc and updated roadmap/docs index references; marked two M1 checklist items complete in `docs/roadmap/v1.3.8-hybrid-offline-streaming-update-plan.md`.
  - Added a canonical voice-call connect-timeout policy (`apps/pwa/app/features/messaging/services/realtime-voice-timeout-policy.ts`) and integrated bounded timeout extensions into `apps/pwa/app/features/main-shell/main-shell.tsx` for `connecting` sessions with transport-progress evidence, with explicit diagnostics (`messaging.realtime_voice.connect_timeout_extended`) and bounded end-of-call fallback.
  - VaultMediaGrid now surfaces explicit source badges and source-specific open actions (`Open Direct Message` / `Open Community`) derived from the canonical stored `sourceConversationId`, and preview/footer copy now makes DM vs community origin explicit.
  - Added localized Vault origin/source-action strings in `en`/`es`/`zh` and expanded focused Vault tests to lock badge visibility, source-specific action labels, and preview copy.

## Evidence

- `pnpm.cmd offline:asset-policy:check`
- `pnpm.cmd docs:check`
- `.\node_modules\.bin\vitest.cmd run app/features/account-sync/services/account-event-bootstrap-service.test.ts`
- `.\node_modules\.bin\vitest.cmd run app/features/messaging/services/local-history-reset-service.test.ts`
- `.\node_modules\.bin\vitest.cmd run app/features/messaging/providers/runtime-messaging-transport-owner-provider.test.tsx`
- `pnpm.cmd exec vitest run app/features/messaging/components/chat-view.test.tsx`
- `pnpm.cmd exec vitest run app/features/messaging/providers/runtime-messaging-transport-owner-provider.test.tsx app/features/messaging/controllers/incoming-dm-event-handler.test.ts app/features/messaging/controllers/outgoing-dm-publisher.test.ts`
- `pnpm.cmd exec vitest run app/features/messaging/hooks/use-conversation-messages.integration.test.ts app/features/messaging/providers/runtime-messaging-transport-owner-provider.test.tsx app/features/messaging/controllers/incoming-dm-event-handler.test.ts`
- `.\node_modules\.bin\vitest.cmd run app/features/messaging/controllers/dm-event-builder.test.ts app/features/messaging/controllers/outgoing-dm-send-preparer.test.ts app/features/main-shell/hooks/use-chat-actions.delete-targets.test.ts app/features/crypto/__tests__/crypto-service-impl.test.ts app/features/messaging/controllers/outgoing-dm-publisher.test.ts app/features/messaging/services/dm-delivery-deterministic.integration.test.ts`
- `.\node_modules\.bin\vitest.cmd run app/features/main-shell/hooks/use-chat-actions.delete-targets.test.ts`
- `.\node_modules\.bin\vitest.cmd run app/features/messaging/controllers/enhanced-dm-controller.test.ts app/features/messaging/providers/runtime-messaging-transport-owner-provider.test.tsx`
- `.\node_modules\.bin\tsc.cmd --noEmit --pretty false` (currently fails on pre-existing `use-conversation-messages.ts` readonly/implicit-any issues unrelated to this fix)
- `pnpm.cmd -C apps/pwa exec vitest run app/features/network/services/presence-evidence.test.ts app/features/messaging/components/chat-header.test.tsx app/features/messaging/components/sidebar.test.tsx app/features/main-shell/main-shell.test.tsx`
- `.\node_modules\.bin\vitest.cmd run app/features/account-sync/services/encrypted-account-backup-service.test.ts app/features/account-sync/services/account-event-bootstrap-service.test.ts app/features/messaging/hooks/use-conversation-messages.integration.test.ts`
- `.\node_modules\.bin\vitest.CMD run app/features/messaging/hooks/use-conversation-messages.integration.test.ts` (from `apps/pwa`, 16/16 passing)
- `.\node_modules\.bin\vitest.CMD run app/features/messaging/hooks/use-conversation-messages.integration.test.ts` (from `apps/pwa`, 17/17 passing after malformed-timestamp sparse-window fix)
- `.\node_modules\.bin\vitest.CMD run app/features/messaging/hooks/use-conversation-messages.integration.test.ts` (from `apps/pwa`, 18/18 passing after hidden voice-call-signal row suppression)
- `.\node_modules\.bin\tsc.CMD --noEmit --pretty false` (from `apps/pwa`, passing)
- `.\node_modules\.bin\vitest.CMD run app/components/app-shell.test.tsx app/components/mobile-tab-bar.test.tsx` (from `apps/pwa`, 14/14 passing)
- `pnpm.cmd release:streaming-update-contract:check` (passed)
- `pnpm.cmd offline:asset-policy:check` (passed)
- `.\node_modules\.bin\tsc.CMD --noEmit --pretty false` (from `apps/pwa`, passing after streaming-update/offline test additions)
- `.\node_modules\.bin\vitest.CMD run app/features/updates/services/streaming-update-policy.test.ts app/components/pwa-service-worker-registrar.test.tsx app/features/main-shell/main-shell.test.tsx` (from `apps/pwa`, 14/14 passing)
- `pnpm.cmd docs:check` (passed)
- `pnpm.cmd release:test-pack -- --skip-preflight` (passed; includes new streaming update contract gate + focused tests)
- `pnpm.cmd -C apps/pwa build` (passed; production bundle baseline for replay)
- `pnpm.cmd release:streaming-update-manifest:build -- --assets-dir release-assets --output docs/assets/demo/v1.3.8/raw/streaming-update-policy.generated.json` (expected fail; missing `release-assets/*` inputs in local workspace)
- `pnpm.cmd -C apps/desktop build` (passed with escalation; produced a local Windows NSIS installer in the desktop build output directory)
- `pnpm.cmd -C apps/pwa exec playwright install chromium` (passed with escalation; replay runtime dependency installed)
- automated offline replay probe script (Node + Playwright; artifacts in `docs/assets/demo/v1.3.8/raw/`)
- `pnpm.cmd offline:asset-policy:check` (passed after SW owner hardening)
- `pnpm.cmd -C apps/pwa build` (passed after SW owner hardening)
- `.\node_modules\.bin\tsc.CMD --noEmit --pretty false` (from `apps/pwa`, passing)
- `.\node_modules\.bin\vitest.CMD run app/features/main-shell/main-shell.test.tsx app/components/pwa-service-worker-registrar.test.tsx app/features/account-sync/services/account-sync-ui-policy.test.ts` (from `apps/pwa`, 10/10 passing)
- extended production replay script (Node + Playwright via `@playwright/test`; artifacts include `pwa-offline-settings.png`, `pwa-reconnect.png`, updated replay JSON)
- `.\\node_modules\\.bin\\vitest.CMD run app/features/messaging/services/realtime-voice-timeout-policy.test.ts app/features/messaging/services/realtime-voice-session-lifecycle.test.ts app/features/messaging/services/realtime-voice-session-owner.test.ts` (from `apps/pwa`, 22/22 passing; executed with escalation due sandbox `spawn EPERM`)
- `.\\node_modules\\.bin\\tsc.CMD --noEmit --pretty false` (from `apps/pwa`, passing after timeout-policy integration)
- `.\\node_modules\\.bin\\vitest.CMD run app/features/vault/components/vault-media-grid.test.tsx` (from `apps/pwa`, 4/4 passing after origin-copy/source-action coverage)
- `.\\node_modules\\.bin\\tsc.CMD --noEmit --pretty false` (from `apps/pwa`, passing after Vault origin-copy polish)

## Changed Files

- `apps/pwa/app/features/account-sync/services/history-reset-cutoff-store.ts`
- `apps/pwa/app/features/account-sync/services/account-event-bootstrap-service.ts`
- `apps/pwa/app/features/account-sync/services/account-event-bootstrap-service.test.ts`
- `apps/pwa/app/features/vault/components/vault-media-grid.tsx`
- `apps/pwa/app/features/vault/components/vault-media-grid.test.tsx`
- `apps/pwa/app/features/messaging/services/local-history-reset-service.ts`
- `apps/pwa/app/features/messaging/services/local-history-reset-service.test.ts`
- `apps/pwa/app/features/messaging/providers/runtime-messaging-transport-owner-provider.tsx`
- `apps/pwa/app/features/messaging/providers/runtime-messaging-transport-owner-provider.test.tsx`
- `apps/pwa/app/features/messaging/components/chat-view.tsx`
- `apps/pwa/app/features/messaging/components/chat-view.test.tsx`
- `apps/pwa/app/lib/i18n/locales/en.json`
- `apps/pwa/app/lib/i18n/locales/es.json`
- `apps/pwa/app/lib/i18n/locales/zh.json`
- `apps/pwa/app/features/messaging/hooks/use-conversation-messages.ts`
- `apps/pwa/app/features/messaging/hooks/use-conversation-messages.integration.test.ts`
- `apps/pwa/app/features/messaging/controllers/dm-event-builder.ts`
- `apps/pwa/app/features/messaging/controllers/dm-event-builder.test.ts`
- `apps/pwa/app/features/messaging/controllers/outgoing-dm-send-preparer.ts`
- `apps/pwa/app/features/messaging/controllers/outgoing-dm-send-preparer.test.ts`
- `apps/pwa/app/features/messaging/controllers/outgoing-dm-publisher.ts`
- `apps/pwa/app/features/messaging/controllers/outgoing-dm-publisher.test.ts`
- `apps/pwa/app/features/messaging/services/dm-delivery-deterministic.integration.test.ts`
- `apps/pwa/app/features/main-shell/hooks/use-chat-actions.ts`
- `apps/pwa/app/features/messaging/lib/media-upload-policy.ts`
- `apps/pwa/app/features/messaging/lib/media-upload-policy.test.ts`
- `apps/pwa/app/features/messaging/lib/nip96-upload-service.ts`
- `apps/pwa/app/features/messaging/lib/nip96-upload-service.test.ts`
- `apps/pwa/app/features/main-shell/hooks/use-chat-actions.delete-targets.test.ts`
- `apps/pwa/app/features/main-shell/main-shell.tsx`
- `apps/pwa/app/features/messaging/services/realtime-voice-timeout-policy.ts`
- `apps/pwa/app/features/messaging/services/realtime-voice-timeout-policy.test.ts`
- `apps/pwa/app/features/crypto/crypto-service-impl.ts`
- `apps/pwa/app/features/crypto/__tests__/crypto-service-impl.test.ts`
- `apps/pwa/app/features/messaging/controllers/enhanced-dm-controller.ts`
- `apps/pwa/app/features/messaging/controllers/enhanced-dm-controller.test.ts`
- `apps/pwa/app/features/network/services/presence-evidence.ts`
- `apps/pwa/app/features/network/services/presence-evidence.test.ts`
- `apps/pwa/app/features/account-sync/services/encrypted-account-backup-service.ts`
- `apps/pwa/app/features/account-sync/services/encrypted-account-backup-service.test.ts`
- `apps/pwa/app/features/vault/hooks/use-vault-media.ts`
- `apps/pwa/app/features/vault/services/local-media-store.ts`
- `apps/pwa/app/features/vault/services/native-local-media-adapter.ts`
- `apps/pwa/app/features/vault/services/native-local-media-adapter.test.ts`
- `apps/pwa/app/vault/page.tsx`
- `scripts/check-offline-ui-asset-policy.mjs`
- `scripts/check-streaming-update-contract.mjs`
- `scripts/build-streaming-update-manifest.mjs`
- `scripts/pwa-ci-scan.mjs`
- `scripts/run-release-test-pack.mjs`
- `scripts/check-release-artifact-matrix.mjs`
- `.github/workflows/release.yml`
- `package.json`
- `CHANGELOG.md`
- `docs/roadmap/v1.3.8-offline-ui-asset-inventory.md`
- `docs/roadmap/v1.3.8-streaming-update-contract.md`
- `docs/roadmap/v1.3.8-hybrid-offline-streaming-update-plan.md`
- `docs/roadmap/current-roadmap.md`
- `docs/07-operations-and-release-flow.md`
- `docs/README.md`
- `docs/handoffs/current-session.md`
- `apps/desktop/release/streaming-update-policy.example.json`
- `apps/pwa/app/features/updates/services/streaming-update-policy.ts`
- `apps/pwa/app/features/updates/services/streaming-update-policy.test.ts`
- `apps/pwa/app/components/pwa-service-worker-registrar.test.tsx`
- `apps/pwa/app/components/desktop-updater.tsx`
- `apps/pwa/public/sw.js`
- `docs/assets/demo/v1.3.8/manual-verification-checklist.md`
- `docs/assets/demo/v1.3.8/runtime-evidence-summary.json`

## Open Risks Or Blockers

- Release-blocker: the user-reported fresh-device DM delete/restore privacy regression is still runtime-open. Focused owner-path suites are green, but we still need live A/B replay to prove deleted-for-everyone rows and local tombstoned rows do not resurrect after login+restore and that startup does not publish stale local state from old mutation history before restore completes.
- Vault browser runtime replay is now green for source badges, `Removed` round-trip behavior, and browser download artifacts, but native desktop replay is still open: verify the Tauri save dialog path writes image/video/audio/file assets to user-chosen filesystem locations and that the saved files open correctly through the desktop runtime rather than browser download fallback.
- Messaging upload browser runtime replay is partially green: the real composer now shows the expected single-video-per-message and 384MB batch-size guardrails, but desktop/native runtime replay is still open for actual upload success/retry behavior, large successful upload stability, and post-send memory behavior.
- Fresh-device backup-restore replay is still open: focused provider/persistence/conversation-hook coverage now locks the late-restore owner path, and durable DM delete tombstones now flow through encrypted backup publish/restore, but desktop/PWA runtime replay still needs to confirm the real restore flow emits `messaging.chat_state_replaced`, migrates history, repopulates the DM sidebar, refreshes an already-open conversation without a reload, and does not resurrect delete-for-everyone text or voice-call invite history.
- New release-blocker (2026-04-06): two-user runtime replay reports `B -> A` DM visibility failure (A cannot see B messages consistently), which blocks reliable interaction QA and has not yet been reproduced by focused deterministic suites.
- Evidence gap: focused owner-path suites are green, so the regression currently appears runtime/manual only and likely tied to a lifecycle/identity-state combination not covered by existing tests.
- New voice-call blocker (2026-04-08): runtime reports ongoing call setup timeouts under real two-user conditions; timeout policy is now hardened with bounded extensions for connecting sessions with transport progress evidence, and connected-call waveform decay/dynamics were tightened to avoid a sticky reused voiceprint, but manual replay evidence is still required to confirm timeout-frequency reduction, live voiceprint motion, and no stuck-call regressions.
- Notification follow-up polish (2026-04-08): desktop/browser notification payloads now deep-link to exact conversations for DM follow-up, and call notifications were simplified to a chat-follow-up owner path with no room IDs and no misleading accept/decline system-toast affordances; runtime verification is still required on Windows native to confirm which click/open-chat affordances the OS toast surface actually honors beyond the existing in-app and service-worker paths.
- M2 manual replay evidence is still open:
  - desktop offline/degraded UX replay is still pending (PWA production replay now passes and artifacts are attached),
  - in-app update replay from previous stable build to candidate build (needs explicit previous-stable + candidate replay harness artifacts/context).
- M2 diagnostics-bundle capture is still open for updater success/failure/rollout/min-safe paths; offline PWA diagnostics are now attached.
- M3 production closeout items are still open:
  - verify updater path in production for the published `v1.3.8` tag,
  - append final checkpoint marking plan complete.
- Roadmap deletion guard remains active; file removal is blocked until the remaining M2/M3 closeout conditions are truly complete.

## Next Atomic Step

Create the \u000b1.3.14 release commit and tag from the validated tree, publish it to origin, then begin the website lane in \u0007pps/website using docs/assets/gifs/, CHANGELOG.md, and GitHub release artifacts as the canonical content sources.

































































































































## Next Thread Bootstrap Prompt

```text
Read AGENTS.md, docs/08-maintainer-playbook.md, and docs/handoffs/current-session.md.
Resume from the Next Atomic Step exactly.
Keep edits scoped to that step and update docs/handoffs/current-session.md before finishing.
```

## Checkpoints

<!-- CONTEXT_CHECKPOINTS_START -->
### 2026-04-04T10:54:15Z checkpoint
- Summary: initialized session handoff document.
- Evidence: no commands run yet.
- Uncertainty: objective and next step still need refinement.
- Next: refine objective and begin implementation.
### 2026-04-04T10:54:24Z checkpoint
- Summary: Mapped incoming call dismiss to canonical decline path so requester receives immediate leave evidence and exits waiting state.
- Evidence: not provided
- Uncertainty: not provided
- Next: Run two-user manual replay: invite -> immediate dismiss/decline -> verify requester transitions from ringing_outgoing to ended without timeout fallback.
### 2026-04-04T10:55:25Z checkpoint
- Summary: Validated main-shell voice dismiss sync fix with focused vitest (main-shell.test.tsx). Incoming dismiss now routes through decline path, emitting leave signal evidence to caller.
- Evidence: not provided
- Uncertainty: not provided
- Next: Run two-user runtime replay for immediate reject/dismiss synchronization and, after freeing disk space, add a dedicated regression test for incoming-dismiss signal propagation.
### 2026-04-04T11:16:18Z checkpoint
- Summary: Freed local disk by removing regenerable build caches (.next, target-check, libobscur target, and most src-tauri target). Remaining locked artifact is running obscur_desktop_app.exe only (~0.03 GB).
- Evidence: not provided
- Uncertainty: not provided
- Next: Optionally close desktop runtime and rerun safe cache cleanup if any target artifacts regrow.
### 2026-04-04T11:42:10Z checkpoint
- Summary: Added tested realtime voice invite-exit contract and wired main-shell decline path to that canonical resolver. Incoming call dismiss/decline now share evidence-based leave dispatch semantics.
- Evidence: not provided
- Uncertainty: not provided
- Next: Run two-user runtime replay: caller sends voice invite, callee immediately closes or declines, caller UI should leave ringing_outgoing and transition to ended/remote_left without waiting for timeout.
### 2026-04-04T12:25:15Z checkpoint
- Summary: Tightened DM delete-command convergence so incoming deletes suppress all resolved aliases, including off-screen persisted rows whose local id differs from the target event id.
- Evidence: `.\node_modules\.bin\vitest.cmd run app/features/messaging/controllers/incoming-dm-event-handler.test.ts`; `.\node_modules\.bin\vitest.cmd run app/features/messaging/hooks/use-conversation-messages.integration.test.ts`
- Uncertainty: group deletion and full two-user runtime replay remain unverified in this thread.
- Next: Run Canonical Replay Suite C for DM delete-for-everyone with older history, reopen churn, and recipient-side verification.
### 2026-04-04T12:48:22Z checkpoint
- Summary: Added a scoped history-reset cutoff so Reset Local History now retires older relay-backed DM history and stale sync checkpoints instead of letting bootstrap import them straight back into projection.
- Evidence: `.\node_modules\.bin\vitest.cmd run app/features/account-sync/services/account-event-bootstrap-service.test.ts`; `.\node_modules\.bin\vitest.cmd run app/features/messaging/services/local-history-reset-service.test.ts`
- Uncertainty: live two-user DM receive failure still needs runtime replay after both profiles perform the reset.
- Next: Reset local history on both profiles, reload, and rerun a fresh A/B DM exchange to determine whether a separate live transport bug remains.
### 2026-04-04T12:57:44Z checkpoint
- Summary: Enabled runtime DM transport during projection bootstrapping for the bound unlocked account, so realtime incoming DMs and delete commands should not stall behind account restore.
- Evidence: `.\node_modules\.bin\vitest.cmd run app/features/messaging/providers/runtime-messaging-transport-owner-provider.test.tsx`
- Uncertainty: needs two-user runtime replay to confirm live relay delivery now works end-to-end while restore is active.
- Next: Replay A/B live DM send and delete-for-everyone during the restore banner and capture whether any remaining failure is transport-level rather than hydration-level.
### 2026-04-04T13:21:26Z checkpoint
- Summary: Added batch-delete permission guidance that explicitly defines `Delete for me` vs `Delete for everyone`, matching the product copy requirement at the canonical action surface.
- Evidence: `pnpm.cmd exec vitest run app/features/messaging/components/chat-view.test.tsx`
- Uncertainty: live two-user runtime replay during restore banner is still pending for transport/delete convergence verification.
- Next: Run a fresh two-user DM replay during the restore banner: confirm A->B receipt, B->A receipt, and delete-for-everyone convergence without waiting for projection bootstrap to finish.
### 2026-04-04T13:31:25Z checkpoint
- Summary: Lifted runtime transport owner gate to include `activating_runtime` for unlocked, projection-bound sessions so realtime incoming DMs/delete commands can stay active during restore activation instead of waiting for `ready`.
- Evidence: `pnpm.cmd exec vitest run app/features/messaging/providers/runtime-messaging-transport-owner-provider.test.tsx app/features/messaging/controllers/incoming-dm-event-handler.test.ts app/features/messaging/controllers/outgoing-dm-publisher.test.ts`
- Uncertainty: requires live two-user runtime replay to confirm end-to-end realtime exchange and delete-for-everyone convergence while restore banner is visible.
- Next: Run fresh A/B runtime replay during restore banner and capture app-event evidence for send, receive, and delete convergence (`messaging.transport.*`, `messaging.delete_for_everyone_remote_result`).
### 2026-04-04T13:54:06Z checkpoint
- Summary: Patched DM realtime/hydration convergence for mixed legacy/canonical conversation ids so incoming messages and delete events no longer depend on a delayed conversation-id migration to become visible.
- Evidence: `pnpm.cmd exec vitest run app/features/messaging/hooks/use-conversation-messages.integration.test.ts app/features/messaging/providers/runtime-messaging-transport-owner-provider.test.tsx app/features/messaging/controllers/incoming-dm-event-handler.test.ts`
- Uncertainty: still need two-user runtime replay to prove relay-path behavior in live restore banner conditions.
- Next: Execute two-user A/B runtime replay during restore banner and capture diagnostics for A->B delivery, B->A delivery, and delete-for-everyone convergence (`messaging.transport.*`, `messaging.delete_for_everyone_remote_result`).
### 2026-04-04T14:25:48Z checkpoint
- Summary: Bound DM delete-for-everyone to canonical event IDs (rumor IDs for NIP-17) and fixed signEvent created_at preservation to prevent wrapper/rumor drift.
- Evidence: not provided
- Uncertainty: not provided
- Next: Run two-user runtime replay for DM delete-for-everyone: send, recall, and verify remote removal converges without refresh; capture messaging.delete_for_everyone_remote_result evidence.
### 2026-04-04T14:27:12Z checkpoint
- Summary: Landed canonical DM delete target contract (NIP-17 canonical event IDs + created_at-preserving signEvent), passed focused tests, and refreshed session handoff metadata/evidence.
- Evidence: not provided
- Uncertainty: not provided
- Next: Run two-user runtime replay for DM delete-for-everyone: send, recall, verify remote removal convergence without refresh, and capture messaging.delete_for_everyone_remote_result evidence.
### 2026-04-04T14:50:04Z checkpoint
- Summary: Added transport safety-sync watchdog: periodic catch-up sync every 15s and visibility-resume sync when incoming owner is active/visible/connected, to prevent indefinite stale DM/delete state after silent subscription stalls.
- Evidence: not provided
- Uncertainty: not provided
- Next: Run two-user runtime replay with one-side idle/stalled tab for >60s, then delete-for-everyone; verify remote convergence without manual refresh and collect messaging.transport.sync_* plus delete_for_everyone_remote_result evidence.
### 2026-04-04T14:52:09Z checkpoint
- Summary: Documented transport safety-sync watchdog in handoff state/evidence and kept next atomic step on two-user realtime/delete convergence replay.
- Evidence: not provided
- Uncertainty: not provided
- Next: Execute two-user runtime replay (idle/stall >60s, send+delete-for-everyone), verify both message and deletion converge without refresh, and capture messaging.transport.sync_* plus messaging.delete_for_everyone_remote_result diagnostics.
### 2026-04-04T14:57:05Z checkpoint
- Summary: Tuned transport safety-sync watchdog to 15s interval and revalidated controller/provider transport tests to speed stale-state recovery after silent subscription stalls.
- Evidence: not provided
- Uncertainty: not provided
- Next: Run two-user runtime replay with one side idle >60s, then send+delete-for-everyone; confirm remote convergence <=15s without refresh and capture sync/delete diagnostics.
### 2026-04-04T15:13:16Z checkpoint
- Summary: Implemented auto-scroll-to-latest on fresh outgoing messages: sending now forces follow-bottom mode and smooth scroll, while stale outgoing replays stay non-disruptive.
- Evidence: not provided
- Uncertainty: not provided
- Next: Run manual chat replay: scroll up in a long thread, send a message, verify viewport jumps to latest message immediately and remains in follow-bottom mode for subsequent sends.
### 2026-04-04T15:42:43Z checkpoint
- Summary: Added canonical online evidence fallback: main-shell now resolves peer online state from relay presence OR recent inbound peer activity timestamps, preventing false OFFLINE during active DM exchange.
- Evidence: not provided
- Uncertainty: not provided
- Next: Run two-user runtime replay with both accounts open: verify Online indicator flips within one activity window during active messaging and returns Offline after stale window with no peer activity.
### 2026-04-04T15:46:30Z checkpoint
- Summary: Landed realtime DM online indicator fallback contract: sidebar/chat header now resolve online state from relay presence OR recent inbound peer activity evidence; added focused presence-evidence tests and validated main-shell/sidebar/chat-header suites.
- Evidence: not provided
- Uncertainty: not provided
- Next: Run two-user runtime replay: while both accounts remain open and idle between messages, confirm Online flips during active exchange and transitions back to Offline after stale window without manual refresh.
### 2026-04-04T16:01:41Z checkpoint
- Summary: Prepared v1.3.4 release lane docs/version sync: updated README, changelog release section, roadmap/project health snapshots, and aligned all release-tracked manifests to 1.3.4.
- Evidence: not provided
- Uncertainty: not provided
- Next: Stage full workspace changes, create v1.3.4 release commit, and push main to origin.
### 2026-04-04T16:38:57Z checkpoint
- Summary: Fixed readonly reverse typecheck blocker in use-conversation-messages loadEarlier path by cloning earlierWindow.rows before reverse; release:test-pack skip-preflight now passes locally.
- Evidence: not provided
- Uncertainty: not provided
- Next: Push this one-line typing-safe fix, then rerun Vercel deployment check to confirm remote build recovers from the previous TS compile failure.
### 2026-04-04T16:40:32Z checkpoint
- Summary: Validated fix against both gates: release:test-pack (--skip-preflight) passed and apps/pwa production build now compiles/types/generates successfully.
- Evidence: not provided
- Uncertainty: not provided
- Next: Commit and push this patch so CI/Vercel can rerun and clear the previous compile failures.
### 2026-04-05T03:45:18Z checkpoint
- Summary: Hardened media pre-upload processing to prevent production desktop stalls at 0%: FFmpeg core fetch/init, transcode, and thumbnail generation now fail fast with bounded timeouts and fallback to original file.
- Evidence: not provided
- Uncertainty: not provided
- Next: Run a production desktop replay: attach a >10MB video in chat and verify processing completes (or gracefully skips compression) and NIP-96 upload starts instead of hanging at 0%.
### 2026-04-05T03:50:01Z checkpoint
- Summary: Prepared v1.3.5 patch release for production desktop media upload stall: added fail-fast media processor timeouts with fallback, synced versions to 1.3.5, and updated changelog.
- Evidence: not provided
- Uncertainty: not provided
- Next: Commit/tag/push v1.3.5 and monitor CI + production installer replay for video attachment upload start behavior.
### 2026-04-05T05:40:35Z checkpoint
- Summary: Hardened desktop WebView data migration and fixed relay coverage recovery path so partial cold-start sync now triggers full-history backfill when additional relays connect.
- Evidence: not provided
- Uncertainty: not provided
- Next: Run two-user reinstall/reset replay on production desktop to confirm history convergence and data retention across update install.
### 2026-04-05T05:51:26Z checkpoint
- Summary: Prepared v1.3.6 hotfix release: synced all manifests to 1.3.6, documented desktop migration + relay coverage backfill fixes, and passed release:test-pack --skip-preflight after tightening dm-sync optional since narrowing.
- Evidence: not provided
- Uncertainty: not provided
- Next: Create v1.3.6 release commit/tag, push to origin, and validate installer two-account reinstall/reset replay for history convergence.
### 2026-04-05T06:36:30Z checkpoint
- Summary: Added NSIS installer hooks for Windows to stop lingering obscur_desktop_app.exe and tor.exe before install/uninstall, reducing tor.exe write-lock dialogs during reinstall/new-device setup.
- Evidence: not provided
- Uncertainty: not provided
- Next: Build a Windows NSIS artifact and run reinstall smoke test while app/tor are intentionally left running to verify no write-lock prompt appears.
### 2026-04-05T07:26:41Z checkpoint
- Summary: Quarantined delete-command junk during restore/hydration: bootstrap import now skips __dweb_cmd__ rows and suppresses targeted legacy message rows; conversation hydration now auto-scans older windows when newest pages are command-only, preventing blank/empty chat illusions and reducing restore confusion.
- Evidence: not provided
- Uncertainty: not provided
- Next: Run production two-account reinstall replay to verify contact list/chat history appears quickly without command JSON leaks; then tune staged sync budget if restore still exceeds acceptable wait.
### 2026-04-05T07:52:33Z checkpoint
- Summary: Quarantined delete-command DM rows at backup/restore owner boundaries: encrypted backup parse/merge/hydrate/build now suppresses command payloads, their targeted history rows, and command-preview chat rows before chat-state restore/import.
- Evidence: not provided
- Uncertainty: not provided
- Next: Run a two-account login+account-sync replay where older messages were deleted-for-everyone, then verify no __dweb_cmd__/JSON junk or resurrected targets appear in sidebar/chat history after restore completes.
### 2026-04-05T07:53:25Z checkpoint
- Summary: Validated backup/restore delete-command quarantine with focused regression coverage: encrypted-account-backup-service merge + indexed hydration now suppress command rows/targets, and targeted suites passed.
- Evidence: not provided
- Uncertainty: not provided
- Next: Run two-account runtime login+sync replay with older delete-for-everyone history and capture whether any command JSON resurfaces in chat list/history after restore.
### 2026-04-05T08:13:41Z checkpoint
- Summary: Auth import no longer emits dev-crashing console errors for invalid/partial nsec input: decode-private-key now fails quietly and returns null, with focused decode/auth-screen tests passing.
- Evidence: not provided
- Uncertainty: not provided
- Next: Run pnpm -C apps/pwa dev, paste an invalid nsec in auth import, and confirm inline validation appears without Next.js console error overlay.
### 2026-04-05T08:24:03Z checkpoint
- Summary: Resolved desktop dev lock-class failure (Access is denied removing target\\\\debug\\\\obscur_desktop_app.exe) by identifying stale running debug app process and extending predev cleanup to stop stale obscur_desktop_app.exe alongside managed \tor.exe under src-tauri/target.
- Evidence: not provided
- Uncertainty: not provided
- Next: From a fresh terminal, run pnpm -C apps/desktop dev twice in a row and confirm second start no longer fails with file-lock delete error for obscur_desktop_app.exe.
### 2026-04-05T08:38:01Z checkpoint
- Summary: Validate context-rescue with internal checkpoint writer
- Evidence: context rescue snapshot created
- Uncertainty: not provided
- Next: Use context:rescue before context exceeds 70%
### 2026-04-05T08:38:31Z checkpoint
- Summary: Validated context-rescue checkpoint durability under context pressure and added non-spawn fallback semantics for restricted environments
- Evidence: not provided
- Uncertainty: not provided
- Next: From a fresh terminal, run pnpm -C apps/desktop dev twice in a row and confirm the second start no longer fails with an obscur_desktop_app.exe lock delete error.
### 2026-04-05T08:58:51Z checkpoint
- Summary: Documented v1.3.7 DM delete/restore divergence incident and landed canonical identity convergence fixes (eventId-first hydration, eventId-aware delete quarantine, alias-based merge dedupe) with focused backup-service regression coverage.
- Evidence: not provided
- Uncertainty: not provided
- Next: Run two-account A/B runtime replay across login+account-sync restore to verify deleted-history non-resurrection and timeline parity; capture account_sync.backup_restore_* plus messaging.delete_for_everyone_remote_result diagnostics for the new incident doc.
### 2026-04-05T09:36:42Z checkpoint
- Summary: Made initial DM history hydration adaptive so sparse visible windows (e.g., after command/deleted-row cleanup) auto-scan earlier pages instead of stopping at the first visible row; added integration coverage for hidden-command-heavy latest pages.
- Evidence: not provided
- Uncertainty: not provided
- Next: Run runtime chat replay after deleting recent malicious rows and refreshing: verify chat auto-populates meaningful history (>1 visible row) without needing immediate manual Load More, then capture diagnostics if sparse.
### 2026-04-05T09:45:55Z checkpoint
- Summary: Updated DM hydration owner to fill the latest visible 200-message window by default (with bounded multi-pass scanning) before showing Load More; this removes fixed first-page stopping when newest rows are mostly hidden command/deleted entries.
- Evidence: not provided
- Uncertainty: not provided
- Next: Run runtime replay on affected DM threads: refresh after command/deleted-row cleanup and verify messages render immediately without a blank Load More-only state; capture diagnostics if history is still sparse after bounded scan.
### 2026-04-05T09:52:58Z checkpoint
- Summary: Investigated persistent blank-with-Load-More symptom and fixed a deeper hydration bug: sparse-window scanning previously anchored on the last raw row timestamp, so malformed/zero-timestamp rows could halt earlier-page discovery. Scan now anchors on earliest valid timestamp; added regression coverage for malformed sparse windows.
- Evidence: not provided
- Uncertainty: not provided
- Next: Replay the exact affected DM thread in runtime and verify initial render no longer requires manual Load More; if still reproducible, capture messaging.conversation_hydration_diagnostics + a row sample to locate remaining owner path.
### 2026-04-05T10:01:02Z checkpoint
- Summary: Investigated persistent blank-with-Load-More beyond hydration-window size. Landed two deeper fixes: (1) suppress voice-call-signal payload rows during hydration because they are intentionally hidden in MessageRow; (2) add MessageList virtualizer self-recovery when message count > 0 but virtual rows are empty. Added regression tests and verified apps/pwa typecheck.
- Evidence: not provided
- Uncertainty: not provided
- Next: Retest the exact affected DM thread on runtime build; if blank persists, capture messaging.conversation_hydration_diagnostics + messaging.message_list_virtualizer_recovery_attempt plus parent scroll container metrics to isolate any remaining render-path issue.
### 2026-04-05T10:13:18Z checkpoint
- Summary: Fixed frequent sidebar/menu navigation non-response by switching AppShell and MobileTabBar nav clicks to explicit router.push on primary clicks (with existing hard fallback retained) and removing defaultPrevented short-circuit drops. Added focused nav tests; app-shell/mobile-tab-bar suites pass.
- Evidence: not provided
- Uncertainty: not provided
- Next: Run runtime desktop/PWA replay with repeated rapid sidebar tab changes under active chat load; if a click still fails, capture navigation.route_request/navigation.route_settled plus route_stall_hard_fallback events for the failing tap.
### 2026-04-05T10:21:48Z checkpoint
- Summary: Synced release-tracked manifests from 1.3.6 to 1.3.7 using canonical version:sync flow and verified alignment with version:check.
- Evidence: not provided
- Uncertainty: not provided
- Next: Create and push the v1.3.7 release commit/tag, then capture a concise offline-first UI architecture plan for component and asset loading boundaries.
### 2026-04-05T10:30:50Z checkpoint
- Summary: Released v1.3.7: committed staged fixes/version sync as release: v1.3.7, tagged v1.3.7, pushed main and tag to origin to trigger CI/release workflows.
- Evidence: not provided
- Uncertainty: not provided
- Next: Plan v1.3.8 hybrid offline-first UX lane: keep core UI shell/assets/components fully local/offline, retain network paths only for relay-dependent data flows, and define measurable offline coverage + perf gates.
### 2026-04-05T11:22:55Z checkpoint
- Summary: Added roadmap goal: support in-app streaming updates so users can upgrade directly inside the app without manual installer download from GitHub/website.
- Evidence: not provided
- Uncertainty: not provided
- Next: Draft v1.3.8 streaming-update architecture: signed release manifest + in-app updater UX + staged rollout/fallback strategy across desktop/PWA runtimes.
### 2026-04-05T11:29:20Z checkpoint
- Summary: Created a single canonical v1.3.8 execution-contract roadmap file for hybrid offline-first UI + in-app streaming updates, with non-removal gates and phased checklist; linked it from current-roadmap/docs index.
- Evidence: not provided
- Uncertainty: not provided
- Next: Start Phase M0: lock canonical owners for offline shell cache, network boundary resolver, and desktop updater runtime; then define diagnostics event map and baseline risk evidence.
### 2026-04-05T11:39:03Z checkpoint
- Summary: Fixed attachment progress UX stall: media processing progress now uses monotonic updates plus fallback ticker (cap 95%) so UI does not sit at 0% during active work; added focused hook internals tests and updated v1.3.8 roadmap checklist with this completed item.
- Evidence: not provided
- Uncertainty: not provided
- Next: Run runtime manual replay for large/small video attachment flow and confirm composer shows non-zero progressing state through processing/upload/send stages under fast and slow networks.
### 2026-04-05T14:00:27Z checkpoint
- Summary: Implemented new-device history-loading UX: account sync UI policy now factors projection runtime + empty-conversation state, showing a dedicated 'Syncing account history' banner and empty-state restore notice when contacts/messages are still restoring.
- Evidence: not provided
- Uncertainty: not provided
- Next: Run desktop/PWA manual fresh-device login replay and verify the new sync notice appears during empty-history warmup, then disappears after conversations hydrate.
### 2026-04-05T14:43:22Z checkpoint
- Summary: Extended new-device sync UX with sidebar hydration skeletons: when account history restore is active and chat list is empty, sidebar now shows placeholder rows + syncing hint instead of a blank list. Added focused sidebar, main-shell, and account-sync-ui-policy tests.
- Evidence: not provided
- Uncertainty: not provided
- Next: Run manual fresh-device login replay on desktop/PWA to verify top banner + empty-state + sidebar sync placeholders all appear during restore and disappear once conversations hydrate.
### 2026-04-05T15:16:11Z checkpoint
- Summary: Landed v1.3.8 M1 offline shell asset inventory and CI guard contracts (new guard script + gate wiring + roadmap/doc index updates).
- Evidence: not provided
- Uncertainty: not provided
- Next: Implement and verify deterministic offline app-shell start behavior (Phase M1 item 3), then capture desktop/PWA manual replay evidence for offline boot plus fresh-device restore placeholders.
### 2026-04-05T15:22:42Z checkpoint
- Summary: Fixed runtime TDZ crash (Cannot access 'accountSyncUiPolicy' before initialization) by computing accountSyncUiPolicy before effects/deps in main-shell.
- Evidence: pnpm -C apps/pwa exec vitest run app/features/main-shell/main-shell.test.tsx; .\\\\node_modules\\\\.bin\\\\tsc.CMD --noEmit --pretty false (from apps/pwa)
- Uncertainty: not provided
- Next: Resume Phase M1 item 3: implement/verify deterministic offline app-shell start behavior and run desktop/PWA manual replay for offline boot + fresh-device restore placeholders.
### 2026-04-05T16:17:17Z checkpoint
- Summary: Landed v1.3.8 streaming update contract + rollout controls (policy module/tests, updater UI enforcement, release manifest generation/check gates) and verified gates (offline policy, streaming contract, focused vitest, apps/pwa tsc, docs:check, release:test-pack --skip-preflight). Updated roadmap/handoff/changelog truth; M2 manual replay + production tag verification remain open, so roadmap deletion stays blocked.
- Evidence: not provided
- Uncertainty: not provided
- Next: Run M2 manual replay evidence (offline desktop/PWA + in-app update previous-stable->candidate), attach diagnostics bundle refs, then execute M3 publish/verification closeout before considering roadmap deletion.
### 2026-04-06T04:48:12Z checkpoint
- Summary: Started M2 replay execution after pushing main commit 339b9da9: initialized docs/assets/demo/v1.3.8 evidence packet, built desktop artifact locally, installed Playwright Chromium, and captured first PWA offline replay probe artifacts. Probe currently fails pass criteria (swControlled=false, offline reload ERR_INTERNET_DISCONNECTED), so offline replay remains in-progress.
- Evidence: not provided
- Uncertainty: not provided
- Next: Continue M2 by resolving PWA SW-control offline replay path and capturing passing offline/degraded/reconnect evidence, then run updater success/failure replay evidence before M3 publish verification.
### 2026-04-06T06:20:38Z checkpoint
- Summary: Resolved v1.3.8 PWA offline replay blocker by replacing stale generated SW path with repository-owned apps/pwa/public/sw.js + policy gate hardening; production replay now passes swControlled/offline boot/offline navigation/reconnect and release:test-pack remains green.
- Evidence: not provided
- Uncertainty: not provided
- Next: Complete remaining M2 manual replays: desktop offline/degraded UX and in-app updater success/failure/rollout/min-safe, then run M3 tag + production updater verification before roadmap deletion.
### 2026-04-06T06:22:49Z checkpoint
- Summary: Pushed commit 8349b12e to main with repository-owned PWA service worker owner path, offline policy gate hardening, and updated v1.3.8 replay packet. Production PWA replay now passes SW control/offline navigation/reconnect; roadmap/manual checklist updated to reflect remaining desktop + updater + M3 closeout blockers.
- Evidence: not provided
- Uncertainty: not provided
- Next: Execute remaining manual replays (desktop offline state + in-app updater success/failure/rollout/min-safe), then publish/verify v1.3.8 tag in production and only then remove the roadmap file.
### 2026-04-06T06:36:32Z checkpoint
- Summary: Published v1.3.8 release commit/tag (92c4b29d, tag v1.3.8) to origin and updated roadmap/evidence/handoff truth: release is out, but production updater-path verification and remaining M2 updater replay evidence still block roadmap deletion.
- Evidence: not provided
- Uncertainty: not provided
- Next: Run updater production verification for v1.3.8 (success/failure/rollout/min-safe), capture diagnostics artifacts, then append final completion checkpoint and remove roadmap file only if guard conditions are fully satisfied.
### 2026-04-06T08:15:11Z checkpoint
- Summary: Fixed CI docs-check failure by removing a non-repo local desktop build artifact path from docs/handoffs/current-session.md that failed stale-path-ref on clean runners.
- Evidence: not provided
- Uncertainty: not provided
- Next: Re-run docs-check/release workflow on latest main; if release publishing is still required from v1.3.8 lane, cut next patch tag from this fixed commit instead of retagging.
### 2026-04-06T08:44:43Z checkpoint
- Summary: Cut and pushed v1.3.9 from fixed CI commit 667c7117 to avoid retagging v1.3.8; release workflow triggered successfully (run #107, in_progress).
- Evidence: not provided
- Uncertainty: not provided
- Next: Monitor release workflow run #107 to completion; if publish succeeds, verify latest stable release/updater visibility and then close roadmap guard tasks.
### 2026-04-06T10:10:44Z checkpoint
- Summary: Enabled chat media seek controls for audio/video preview players by wiring progress bars to explicit range-driven currentTime updates with duration safety guards; added focused player seek regression tests.
- Evidence: not provided
- Uncertainty: not provided
- Next: Run quick desktop/PWA manual replay on chat attachments (audio + video) to confirm drag seek UX feels correct and then continue remaining v1.3.8 production verification tasks.
### 2026-04-06T10:44:29Z checkpoint
- Summary: Added first-login history-sync notice persistence for empty-history device restores: main-shell now enforces a one-minute minimum visibility window for the existing account history sync notice (with per-profile/account first-run sentinel) while retaining policy-driven visibility, and all notice surfaces now share the same visibility state.
- Evidence: not provided
- Uncertainty: not provided
- Next: Run manual fresh-device login replay to confirm the notice remains visible for at least 60 seconds, then verify it clears after hold expiry when restore state settles.
### 2026-04-06T11:08:57Z checkpoint
- Summary: Fixed DM unread inflation at account projection owner: incoming unread now increments only for new relay_live events (not relay_sync/local_bootstrap replay) and only once per messageId; added regression coverage for historical replay suppression and duplicate-live-event safety.
- Evidence: not provided
- Uncertainty: not provided
- Next: Run a fresh-device restore replay and verify chat/request badges stay near zero after history sync, then confirm new live incoming messages increment unread dynamically.
### 2026-04-06T11:22:21Z checkpoint
- Summary: Updated empty conversation center panel with a persistent user-facing sync hint: when contacts/history are missing, it now explicitly tells users to wait a few minutes for loading and account-data synchronization; added focused component tests for both inactive/active sync notice states.
- Evidence: not provided
- Uncertainty: not provided
- Next: Run a manual fresh-device empty-state replay to confirm the new hint is visible in the screenshot area and wording stays clear on desktop + PWA.
### 2026-04-06T11:55:55Z checkpoint
- Summary: Added canonical per-target notification preferences with chat-header bell toggles (DM/group), wired DesktopNotificationHandler message notifications to respect target-level mute state, and aligned legacy group notification toggles to the shared notification-target owner with focused tests.
- Evidence: not provided
- Uncertainty: not provided
- Next: Run manual desktop + mobile background notification replay: verify global settings + per-chat bell toggles suppress/allow message popups for DM and group targets.
### 2026-04-06T12:33:25Z checkpoint
- Summary: Made chat-header notification bell explicitly interactive: click now triggers a callback action path (toast from main-shell) and applies a clear enabled/disabled style state with aria-pressed; added regression assertion for visual/state toggle.
- Evidence: not provided
- Uncertainty: not provided
- Next: Run quick manual DM/group header replay and verify bell state, toast feedback, and per-chat mute behavior while receiving background messages.
### 2026-04-06T12:52:30Z checkpoint
- Summary: Added desktop drag-scroll control for chat timelines: ChatView now exposes a Drag Scroll toggle and MessageList supports guarded mouse pointer-drag scrolling (grab/grabbing cursors, click suppression after drag, interactive-target exclusions) so users can pan history like mobile without breaking normal controls.
- Evidence: not provided
- Uncertainty: not provided
- Next: Run manual desktop replay: toggle Drag Scroll in an active DM/group, drag through history, confirm links/buttons still click normally when not dragging and accidental clicks are suppressed after drag gestures.
### 2026-04-06T13:07:29Z checkpoint
- Summary: Removed desktop drag-scroll mode from chat timeline due UX regression: deleted ChatView drag-scroll control, removed MessageList mouse pointer-drag scrolling handlers/cursor mode/click-suppression path, and reverted associated chat-view test additions.
- Evidence: not provided
- Uncertainty: not provided
- Next: Manual desktop replay: verify chat timeline scroll/selection/media controls feel normal and no drag-scroll control is visible; continue with stable desktop UX path only.
### 2026-04-06T13:49:20Z checkpoint
- Summary: Improved incoming voice-call background handling across the shared runtime owner path. Added a canonical voice-call overlay action bridge module, wired incoming-call desktop notification clicks to dispatch `open_chat`, and added main-shell visibility/focus resume logic so hidden-background incoming invites reopen into an interactive call surface with Accept/Decline controls when users return.
- Evidence: `.\\node_modules\\.bin\\tsc.CMD --noEmit --pretty false` (from `apps/pwa`); `.\\node_modules\\.bin\\vitest.CMD run app/components/desktop-notification-handler.test.tsx app/lib/notification-service.test.ts app/features/messaging/components/global-voice-call-overlay.test.tsx` (from `apps/pwa`); `.\\node_modules\\.bin\\vitest.CMD run app/features/main-shell/main-shell.test.tsx` (from `apps/pwa`)
- Uncertainty: Native Tauri notification-click callbacks are not yet action-aware in this patch; desktop-native clicks still rely on user focus/visibility return path to surface call controls.
- Next: Run manual desktop + mobile replay with app backgrounded on both chat and non-chat routes; verify invite notification appears, returning/clicking surfaces the call UI immediately, and Accept/Decline actions complete correctly.
### 2026-04-06T02:47:13Z checkpoint
- Summary: Upgraded notification delivery to a more system-native path for background behavior: runtime notifications now request permission on-demand when permission is `default`, web/mobile notifications prefer `ServiceWorkerRegistration.showNotification`, call alerts carry structured click metadata (`overlayAction`, `href`, `requireInteraction`), service worker now handles `notificationclick` to focus/open app and post action messages, and DesktopNotificationHandler consumes SW click messages and relays them through the canonical voice-call overlay action bridge.
- Evidence: `.\\node_modules\\.bin\\tsc.CMD --noEmit --pretty false` (from `apps/pwa`); `.\\node_modules\\.bin\\vitest.CMD run app/lib/notification-service.test.ts app/components/desktop-notification-handler.test.tsx` (from `apps/pwa`); `.\\node_modules\\.bin\\vitest.CMD run app/features/messaging/components/global-voice-call-overlay.test.tsx app/features/main-shell/main-shell.test.tsx` (from `apps/pwa`)
- Uncertainty: Native Tauri notification action buttons (`Accept`/`Decline` directly in OS toast) are still not implemented; current native flow focuses/reopens and hands off to in-app interactive controls.
- Next: Execute manual runtime replay on desktop (Tauri) and mobile PWA with app minimized/backgrounded; verify notification appearance reliability, click-to-chat call handoff, and permission behavior on first notification.
### 2026-04-06T03:19:29Z checkpoint
- Summary: Added desktop unread app-icon badge owner path for minimized/backgrounded awareness: introduced `unread-taskbar-badge` utility to normalize unread counts, render dynamic Windows overlay badge icons (with `99+` cap), apply `setBadgeCount` where supported, and clear icon when unread is zero. Wired `DesktopNotificationHandler` to drive badge updates from `chatsUnreadCount` plus active incoming-call ring state, so call+message pending state is visible from taskbar/tray context.
- Evidence: `.\\node_modules\\.bin\\tsc.CMD --noEmit --pretty false` (from `apps/pwa`); `.\\node_modules\\.bin\\vitest.CMD run app/components/desktop-notification-handler.test.tsx app/features/desktop/utils/unread-taskbar-badge.test.ts app/lib/notification-service.test.ts app/features/messaging/components/global-voice-call-overlay.test.tsx app/features/main-shell/main-shell.test.tsx` (from `apps/pwa`)
- Uncertainty: Visual badge appearance depends on OS/taskbar support for overlay icons/badges; runtime manual verification is still needed on the target desktop shell.
- Next: Run manual desktop minimized replay: generate unread DMs and incoming ringing call, confirm app icon marker updates in taskbar/tray context, verify `99+` cap behavior, then clear unread and confirm badge removal.
### 2026-04-06T16:47:01Z checkpoint
- Summary: Recorded B->A DM visibility regression as explicit release blocker, replayed focused transport/receive suites (green), and added bidirectional deterministic DM delivery integration coverage (A->B then B->A) to prevent silent one-way regressions.
- Evidence: not provided
- Uncertainty: not provided
- Next: Run manual two-account runtime replay with diagnostics capture to reproduce B->A drop path in live lifecycle state, then patch canonical owner boundary once divergence is isolated.
### 2026-04-06T17:17:03Z checkpoint
- Summary: Patched runtime messaging transport owner gate to stay enabled for unlocked active runtime phases independent of projection replay/readiness, preventing incoming subscription drop during projection lifecycle transitions that can cause one-way DM visibility (B->A). Added/updated owner-provider tests and kept bidirectional deterministic DM replay guard.
- Evidence: not provided
- Uncertainty: not provided
- Next: Run two-account manual runtime replay (A and B) with event diagnostics; if B->A still fails, capture incoming_event_seen + hydration diagnostics and patch the next canonical owner boundary.
### 2026-04-06T17:23:25Z checkpoint
- Summary: Added canonical incoming-owner diagnostics at runtime transport boundary (messaging.transport.runtime_owner_enabled/disabled) and kept owner gate decoupled from projection readiness. Verified focused suites: runtime owner provider, incoming DM handler, and deterministic bidirectional delivery all passing.
- Evidence: not provided
- Uncertainty: not provided
- Next: Execute manual two-account runtime replay (A/B) while watching the new owner diagnostics plus incoming/hydration events to confirm B->A convergence under minimized/backgrounded and normal foreground flows.
### 2026-04-06T19:06:16Z checkpoint
- Summary: Implemented desktop tray unread badge + tray incoming-call accept/decline bridge; extended runtime notification actions and SW notificationclick action routing; verified with focused pwa tests, pwa tsc, and desktop build.
- Evidence: not provided
- Uncertainty: not provided
- Next: Manual two-user replay: verify minimized/background flow shows tray unread counts and accepts/declines incoming calls via tray menu + notification actions on web/mobile service worker path.
### 2026-04-07T01:45:03Z checkpoint
- Summary: Added background-alert fallback badge owner in DesktopNotificationHandler so minimized/hidden incoming-message notifications increment badge even when projection unread remains zero; added focused regression test and fixed act-wrapped assertions.
- Evidence: not provided
- Uncertainty: not provided
- Next: User runtime replay on Windows: confirm tray icon badge now increments while hidden/minimized and clears on foreground focus; if still absent, capture whether tray icon swaps visually to determine OS/tray renderer limitation vs state path issue.
### 2026-04-07T02:46:43Z checkpoint
- Summary: Fixed notification/tray suppression gates: native runtime defaults notifications enabled when no persisted preference, background message badge increments independent of preference state, desktop call notifications can force-send in native background, and tray badge updates no longer require supportsWindowControls.
- Evidence: not provided
- Uncertainty: not provided
- Next: Hard runtime replay: full tray Quit -> relaunch -> background message/call test; if still no system prompt/icon change, capture whether runtime detects native bridge and whether desktop commands set_tray_unread_badge_count / show_notification are invoked at all.
### 2026-04-07T03:31:15Z checkpoint
- Summary: Hardened Windows build toggle-api script with retry-based rename to survive transient EPERM locks; cleared locking node/desktop processes; rebuilt desktop successfully with latest background-notification/tray-badge fixes and produced new NSIS installer.
- Evidence: not provided
- Uncertainty: not provided
- Next: User installs/runs fresh Obscur_1.3.9_x64-setup.exe and replays minimized/background message + incoming call flows; if system prompts/tray badge still absent, capture runtime capability snapshot and native invoke diagnostics from packaged app.
### 2026-04-07T04:12:09Z checkpoint
- Summary: Addressed user-reported PowerShell toast identity and route-dependent notification gaps: show_notification now uses Windows notify-rust path with explicit app identifier; DesktopNotificationHandler gained unread-count background fallback notifier to avoid chat-route-only event dependence; rebuilt desktop installer successfully.
- Evidence: not provided
- Uncertainty: not provided
- Next: User installs new NSIS build and verifies: notification header no longer Windows PowerShell, message notifications fire while on non-chat routes, tray unread badge increments while minimized.
### 2026-04-07T05:42:21Z checkpoint
- Summary: DesktopNotificationHandler now parses incoming voice-call-invite payloads from messageBus and emits actionable incoming-call notifications (Accept/Decline) instead of raw JSON message previews; voice-call control payloads are suppressed from generic DM message toasts; added focused regression test.
- Evidence: not provided
- Uncertainty: not provided
- Next: User retest on dev server: B sends call invite while A on non-chat routes/minimized; verify system toast shows Incoming call + actions, not JSON; verify accept/decline actions route through overlay bridge.
### 2026-04-07T09:22:05Z checkpoint
- Summary: Call invite UX owner path hardened: DesktopNotificationHandler now persists same IncomingVoiceCallToast fallback for invite payloads (including background arrivals), and voice-call actions from fallback/SW/Tauri bridges route to chat for accept/decline/open_chat so users can answer from any route. GlobalVoiceCallOverlay now also routes accept/decline to chat on non-chat routes. Added focused regression tests for off-route accept behavior; pwa vitest + tsc pass.
- Evidence: not provided
- Uncertainty: not provided
- Next: Manual replay on desktop dev build: receive voice-call invite while on non-chat route and while app minimized; verify same incoming call card appears on return and Accept/Decline works without manually navigating to chat first. If Windows system toast still lacks actionable buttons, keep toast as wake signal and rely on tray actions + in-app card as canonical interactive surface.
### 2026-04-07T10:46:02Z checkpoint
- Summary: Incoming call notifications no longer depend on non-actionable Windows toast alone: added native window_show_and_focus command + permission and wired DesktopNotificationHandler incoming-call path to surface the desktop window when hidden, so the same in-app IncomingVoiceCallToast card becomes immediately actionable (Accept/Decline) from background/minimized state.
- Evidence: not provided
- Uncertainty: not provided
- Next: User retests with latest desktop build: minimize/hide app, trigger incoming call, confirm app surfaces with interactive call card and Accept/Decline actions work without opening chat manually.
### 2026-04-07T11:57:28Z checkpoint
- Summary: Implemented native incoming-call popup ownership for desktop: Rust now maintains canonical incoming-call state, emits desktop://incoming-call-state, opens/hides a dedicated always-on-top incoming-call-popup window, and exposes desktop_get_incoming_call_state + desktop_incoming_call_action commands. PWA now routes popup windows through DesktopWindowRootSurface (skipping full chat shell) and renders IncomingCallPopupSurface using the same IncomingVoiceCallToast component with Accept/Decline actions bridged to native call action command.
- Evidence: not provided
- Uncertainty: not provided
- Next: User installs latest desktop build and runs two-account replay: with app minimized/backgrounded and off-chat route, incoming call must open incoming-call-popup with actionable card; verify accept/decline works immediately and popup closes/updates state correctly.
### 2026-04-07T15:08:14Z checkpoint
- Summary: Implemented premium in-app message notification cards with shared call/message card tokens, action row (Reply/Mark read/Open chat), mention/encrypted badges, and handler wiring for unread-clear + compose focus; updated focused notification tests to assert foreground in-app card ownership.
- Evidence: not provided
- Uncertainty: not provided
- Next: Run desktop two-account replay: verify incoming message cards appear on non-chat foreground routes with Reply/Mark read/Open chat behavior, and confirm incoming-call popup + message-card visual consistency on minimized/background return path.
### 2026-04-07T15:33:41Z checkpoint
- Summary: Corrected in-app message card action routing to canonical convId deep-link owner path (replacing non-canonical conversation param), added regression tests for Open chat + Reply route intent and mark-read behavior, and updated manual verification checklist with message-card + call-popup parity replay gates.
- Evidence: not provided
- Uncertainty: not provided
- Next: Execute manual two-account desktop replay: validate foreground non-chat message cards (Reply/Mark read/Open chat), verify convId routing resolves correct conversation, and confirm minimized/background incoming-call popup remains actionable and visually aligned with message cards.
### 2026-04-07T16:09:17Z checkpoint
- Summary: Removed chat-embedded IncomingVoiceCallToast render path from main-shell to stop call-card overlap/layout break; hardened incoming-call popup detection with URL query fallback (incomingCallPopup=1) and promoted hidden/minimized invite handling to native tray incoming-call state so popup owner path is engaged before OS-toast fallback.
- Evidence: not provided
- Uncertainty: not provided
- Next: User retests latest desktop build: confirm no in-chat layout break from incoming call cards, hidden/minimized incoming calls open dedicated popup window with actionable Accept/Decline, and OS toast is only secondary wake signal.
### 2026-04-07T16:11:18Z checkpoint
- Summary: Addressed user-reported UX regression directly: removed chat-embedded incoming-call card render from main-shell (prevents chat layout break), added popup-window detection fallback via incomingCallPopup query flag, and changed hidden/minimized desktop invite handling to prefer native popup path (set tray incoming-call state + focus) while skipping redundant OS-toast fallback in that mode.
- Evidence: not provided
- Uncertainty: not provided
- Next: User retests latest desktop build: incoming calls should no longer overlay/break chat layout; hidden/minimized incoming calls should open dedicated popup card with Accept/Decline; if popup still absent, capture runtime logs for set_tray_incoming_call_state + desktop://incoming-call-state emission.
### 2026-04-07T16:31:42Z checkpoint
- Summary: Made desktop packaging deterministic in network-restricted environments by removing next/font/google dependency from app/layout and defining local sans/mono stacks in globals.css. Rebuilt desktop successfully (NSIS installer produced) with prior incoming-call regression fixes: removed in-chat incoming-call card path, popup-window detection fallback, and hidden/minimized call handling that prioritizes native popup owner path over redundant OS-toast fallback.
- Evidence: not provided
- Uncertainty: not provided
- Next: User installs latest Obscur_1.3.9_x64-setup.exe and replays two-account call flow: verify no chat-layout overlap, hidden/minimized incoming calls surface dedicated popup with Accept/Decline, and message card actions still route to convId target correctly.
### 2026-04-07T17:10:54Z checkpoint
- Summary: Recovery-by-subtraction pass landed and built: removed duplicate main-shell VoiceCallDock render (global overlay/popup is now canonical call surface), simplified inline voice-call invite timeline blocks to compact cards, hardened desktop notification caller-name fallback to use conversation/pubkey display names before unknown placeholders, and rebuilt desktop installer successfully after offline-safe font setup.
- Evidence: not provided
- Uncertainty: not provided
- Next: User installs latest Obscur_1.3.9_x64-setup.exe and verifies: (1) no in-chat call-control bar overlap, (2) voice-call invite messages appear compact (not oversized premium cards), (3) hidden/minimized incoming calls use popup/interactive path with actionable controls and improved caller naming.
### 2026-04-07T17:57:15Z checkpoint
- Summary: Restored floating in-app incoming-call card behavior as canonical cross-route surface: GlobalVoiceCallOverlay now renders on chat and non-chat routes, IncomingVoiceCallToast elevated above app UI, duplicate main-shell call dock remains removed, and desktop caller-name fallback prefers conversation/pubkey names over unknown placeholders. Rebuilt desktop installer successfully after clearing lock-holding processes.
- Evidence: not provided
- Uncertainty: not provided
- Next: User installs latest Obscur_1.3.9_x64-setup.exe and verifies floating incoming-call card appears on chat and non-chat pages with prominent Accept/Decline + avatar/name, no in-chat top bar overlap, and minimized/background calls still surface actionable popup flow.
### 2026-04-07T18:17:36Z checkpoint
- Summary: Isolated incoming-call UI from chat layout: removed in-chat call status/action strip from ChatHeader and moved IncomingVoiceCallToast rendering to a body portal with high fixed z-layer so call cards always float above UI without participating in page flow.
- Evidence: not provided
- Uncertainty: not provided
- Next: User retests latest desktop build: incoming call card should float above all routes without shifting header/content layout; verify Accept/Decline and popup/minimized flows still work.
### 2026-04-07T18:20:30Z checkpoint
- Summary: Hardened floating-call owner boundary: GlobalVoiceCallOverlay now portals to document.body with fixed pointer-events-none wrapper, ensuring both IncomingVoiceCallToast and VoiceCallDock render outside route/layout flow. Revalidated focused chat-header/global-overlay/desktop-notification tests + PWA typecheck.
- Evidence: not provided
- Uncertainty: not provided
- Next: User retests desktop runtime: incoming call card and dock should float above all routes without shifting chat/network/vault layouts; confirm Accept/Decline/end actions still route correctly on chat and non-chat pages.
### 2026-04-07T18:29:59Z checkpoint
- Summary: Delivered floating-call layout isolation in build artifacts: incoming-call UI now uses body-portal rendering (IncomingVoiceCallToast + GlobalVoiceCallOverlay), chat-header inline call strip removed, focused pwa tests/typecheck passing, and desktop installer rebuilt successfully after clearing Node/Obscur lock holders.
- Evidence: not provided
- Uncertainty: not provided
- Next: User installs fresh Obscur_1.3.9_x64-setup.exe and verifies incoming call card/dock float above all pages with zero layout shift while Accept/Decline/end still work on chat and non-chat routes.
### 2026-04-08T03:38:00Z checkpoint
- Summary: Repositioned floating VoiceCallDock from bottom-center/left-influenced placement to bottom-right overlay zone (high z-layer, fixed right/bottom offsets, constrained width) so it remains visible and operable without clashing with left-side UI chrome. Focused messaging overlay tests and PWA typecheck pass.
- Evidence: not provided
- Uncertainty: not provided
- Next: User retests runtime call flow on chat and non-chat routes to confirm dock/card now consistently appears bottom-right and remains fully clickable; if overlap persists, tune bottom offset for composer height in desktop mode.
### 2026-04-08T03:46:02Z checkpoint
- Summary: Raised floating call surfaces above clipped bottom zone: IncomingVoiceCallToast and VoiceCallDock now use safe-area-aware elevated bottom anchors (calc(env(safe-area-inset-bottom)+6rem), sm +5.5rem) while staying bottom-right. Focused overlay/notification tests and PWA typecheck pass.
- Evidence: not provided
- Uncertainty: not provided
- Next: User retests desktop runtime: active call dock and incoming call card should now appear visibly above composer/window edge and remain fully clickable on chat/non-chat routes; if still too low, bump desktop offset token further.
### 2026-04-08T03:56:35Z checkpoint
- Summary: Made call overlay placement deterministic: IncomingVoiceCallToast and VoiceCallDock now use explicit inline bottom offsets (max(6.5rem, calc(env(safe-area-inset-bottom)+6rem))) plus left:auto, removing dependence on potentially dropped Tailwind arbitrary calc classes that caused clipped left-bottom fallback placement. Focused overlay tests + PWA tsc pass.
- Evidence: not provided
- Uncertainty: not provided
- Next: User retests runtime: incoming call card/tab should stay on right side and clear of composer input; if still too close, raise shared bottom offset token further.
### 2026-04-08T04:06:31Z checkpoint
- Summary: Finalized right-side/non-obstructive call placement with deterministic inline offsets and rebuilt desktop installer. IncomingVoiceCallToast + VoiceCallDock now force right anchoring (left:auto) and elevated bottom offset above composer; packaged NSIS installer regenerated successfully after clearing lock holders.
- Evidence: not provided
- Uncertainty: not provided
- Next: User installs latest Obscur_1.3.9_x64-setup.exe and verifies incoming call card/tab appears on right side above input box and remains fully operable; if needed, increment shared bottom offset token further.
### 2026-04-08T04:33:10Z checkpoint
- Summary: Addressed persistent bottom-left cropped call-card regression with two hardening layers: (1) incoming-call and call-dock components now force position/right/bottom/zIndex via inline styles (independent of Tailwind class generation), using elevated bottom offset above composer; (2) desktop-shell builds now always unregister/skip service workers to prevent stale cached runtime assets. Focused tests + tsc pass, desktop installer rebuilt.
- Evidence: not provided
- Uncertainty: not provided
- Next: User fully exits Obscur, installs latest NSIS build, and verifies incoming call card appears on right and above input without cropping. If any left/cropped render remains, capture runtime version/hash and active window label to detect stale binary/process mismatch.
### 2026-04-08T05:38:11Z checkpoint
- Summary: Implemented adaptive call-overlay placement policy for cross-page polish: IncomingVoiceCallToast and VoiceCallDock now accept anchorMode and use chat-aware high right anchor on '/' (clear composer) plus lower right anchor on non-chat pages for better visual balance. Wired anchor mode through GlobalVoiceCallOverlay and DesktopNotificationHandler fallback path, retained deterministic inline position/right/bottom/zIndex styling, verified focused tests + tsc, and rebuilt desktop installer.
- Evidence: not provided
- Uncertainty: not provided
- Next: User installs latest Obscur_1.3.9_x64-setup.exe and reviews call-card placement across chat/network/discovery/settings; if needed, tune chat/page offsets separately without changing ownership path.
### 2026-04-08T06:14:47Z checkpoint
- Summary: Implemented connected-call dock policy requested by user: on chat route and connected phase, VoiceCallDock now anchors bottom-center above composer, widens to ~46rem max, and uses a three-lane layout with dedicated center waveform lane so voiceprint is not obscured by action buttons. Non-connected phases keep right-rail adaptive placement. Focused tests + pwa tsc pass; desktop installer rebuilt.
- Evidence: not provided
- Uncertainty: not provided
- Next: User installs latest NSIS and verifies: connected call status card is bottom-center, clears input box, and waveform remains visible between identity and action controls; tune connected bottom offset/center-lane width if needed.
### 2026-04-08T07:53:05Z checkpoint
- Summary: Adjusted post-confirmation call dock anchoring: chat-mode VoiceCallDock now centers at bottom not only for connected, but also connecting and interrupted phases, keeping the wider center-oriented layout and avoiding right-corner placement after accept. Focused tests + pwa tsc pass; desktop installer rebuilt.
- Evidence: not provided
- Uncertainty: not provided
- Next: User installs latest NSIS and verifies after accepting a call the status card stays bottom-center through connecting->connected instead of moving to bottom-right.
### 2026-04-08T08:05:57Z checkpoint
- Summary: Unified call status dock horizontal placement for consistency: VoiceCallDock now anchors bottom-center across call-status phases (including initiator outgoing/connecting), with route-based vertical offset only (chat above composer, non-chat lower). Maintained widened centered layout for clear waveform/action separation and rebuilt desktop installer.
- Evidence: not provided
- Uncertainty: not provided
- Next: Run two-account runtime replay focused on voice-call setup timeout behavior (normal + minimized/backgrounded): verify connecting sessions with ongoing SDP/ICE progress no longer hard-timeout at 30s, and capture `messaging.realtime_voice.connect_timeout_diagnostics` plus `messaging.realtime_voice.connect_timeout_extended` evidence for both caller and callee.
### 2026-04-08T09:43:32Z checkpoint
- Summary: Added deterministic connect-timeout policy owner path for realtime voice calls. `main-shell` now routes `ringing_outgoing/connecting` timeout handling through `resolveRealtimeVoiceConnectTimeoutDecision`, allowing one bounded extension only for `connecting` sessions that still show transport progress evidence (RTC connecting/local-or-remote description) before fallback end/interrupted handling. Added new diagnostics event `messaging.realtime_voice.connect_timeout_extended` and explicit timeout decision context in existing timeout diagnostics.
- Evidence: `.\\node_modules\\.bin\\vitest.CMD run app/features/messaging/services/realtime-voice-timeout-policy.test.ts app/features/messaging/services/realtime-voice-session-lifecycle.test.ts app/features/messaging/services/realtime-voice-session-owner.test.ts` (from `apps/pwa`, 22/22 passing); `.\\node_modules\\.bin\\tsc.CMD --noEmit --pretty false` (from `apps/pwa`, passing).
- Uncertainty: Manual runtime evidence is still required to confirm the reported timeout regression is mitigated end-to-end across caller/joiner flows and that bounded extension does not mask true failed setup states.
- Next: Run two-account runtime replay focused on voice-call setup timeout behavior (normal + minimized/backgrounded): verify connecting sessions with ongoing SDP/ICE progress no longer hard-timeout at 30s, and capture `messaging.realtime_voice.connect_timeout_diagnostics` plus `messaging.realtime_voice.connect_timeout_extended` evidence for both caller and callee.
### 2026-04-08T10:26:06Z checkpoint
- Summary: Restored live voiceprint dynamics in connected call status cards by wiring a canonical audio-level channel through the global overlay owner path: `main-shell` now publishes smoothed max(local/remote) voice energy into `realtime-voice-global-ui-store`, `GlobalVoiceCallOverlay` passes the live level into `VoiceCallDock`, and `VoiceCallDock` now consumes that level directly with speech-detection boost so bars visibly jump when audio is present.
- Evidence: `.\\node_modules\\.bin\\tsc.CMD --noEmit --pretty false` (from `apps/pwa`, passing); `.\\node_modules\\.bin\\vitest.CMD run app/features/messaging/components/global-voice-call-overlay.test.tsx` (from `apps/pwa`, 6/6 passing, includes waveform-level propagation assertion).
- Uncertainty: Runtime verification is still needed to calibrate perceived motion amplitude against real microphone/speaker levels across desktop routes and minimized/background return paths.
- Next: Run desktop two-user replay while connected: verify the call status-card voiceprint now visibly jumps with speech/activity on either side (not static), then continue the voice-timeout diagnostics replay (`messaging.realtime_voice.connect_timeout_diagnostics` + `messaging.realtime_voice.connect_timeout_extended`).
### 2026-04-08T10:29:30Z checkpoint
- Summary: Slightly reduced the centered call-status dock width cap from `46rem` to `43rem` in `VoiceCallDock` so the middle card reads tighter without changing layout ownership, control grouping, or anchor behavior.
- Evidence: `.\\node_modules\\.bin\\tsc.CMD --noEmit --pretty false` (from `apps/pwa`, passing).
- Uncertainty: Runtime visual verification is still needed to confirm the new width feels balanced across connecting and connected states on desktop.
- Next: Run desktop replay to confirm the centered call-status card now feels better proportioned at the slightly reduced width, then continue the voice-timeout diagnostics replay (`messaging.realtime_voice.connect_timeout_diagnostics` + `messaging.realtime_voice.connect_timeout_extended`).
### 2026-04-08T15:11:41Z checkpoint
- Summary: Hardened the connected-call voiceprint owner path so the center waveform no longer gets stuck after one prior burst: extracted canonical smoothing/decay into `realtime-voice-waveform-level`, updated `main-shell` to publish overlay waveform levels through that contract, reduced overlay store deadband, and simplified `VoiceCallDock` to render the canonical live level directly instead of adding a second sticky smoothing layer.
- Evidence: `.\\node_modules\\.bin\\tsc.CMD --noEmit --pretty false` (from `apps/pwa`, passing); `.\\node_modules\\.bin\\vitest.CMD run app/features/messaging/services/realtime-voice-waveform-level.test.ts app/features/messaging/components/global-voice-call-overlay.test.tsx` (from `apps/pwa`, 8/8 passing).
- Uncertainty: Manual desktop replay is still required to confirm perceived waveform motion remains lively across repeated connected calls and real microphone/speaker activity, not just focused test harness updates.
- Next: Run desktop two-user replay while connected to verify the center voiceprint now keeps moving and decays back down between speech bursts across repeated calls, then continue the voice-timeout diagnostics replay (`messaging.realtime_voice.connect_timeout_diagnostics` + `messaging.realtime_voice.connect_timeout_extended`).
### 2026-04-08T15:37:12Z checkpoint
- Summary: Notification UX/action pass landed through the existing `DesktopNotificationHandler` owner path: added typed notification presentation helpers for exact conversation deep-links, upgraded background DM notifications to carry exact `convId` href + onClick routing, upgraded incoming-call notification copy/actions to be clearer about opening chat, and refreshed the in-app message/call cards so previews and primary follow-up actions are more visually prominent without adding a parallel navigation owner.
- Evidence: `.\\node_modules\\.bin\\tsc.CMD --noEmit --pretty false` (from `apps/pwa`, passing); `.\\node_modules\\.bin\\vitest.CMD run app/components/desktop-notification-handler.test.tsx app/features/notifications/utils/notification-presentation.test.ts app/lib/notification-service.test.ts` (from `apps/pwa`, 27/27 passing).
- Uncertainty: Windows native toast visuals are still constrained by the current Tauri/Windows adapter, so runtime replay is still needed to confirm whether the richer copy plus target hrefs are sufficient there or whether a deeper native-notification action bridge is needed for parity with browser/service-worker click-through.
- Next: Run a desktop notification replay to verify richer message/call notifications now open the target conversation reliably from click-through paths (browser/service-worker/in-app, and Windows native where supported), then continue the voice-call runtime replay for waveform motion and timeout diagnostics (`messaging.realtime_voice.connect_timeout_diagnostics` + `messaging.realtime_voice.connect_timeout_extended`).
### 2026-04-08T15:54:41Z checkpoint
- Summary: Refined the call-notification decision to match runtime truth: room IDs were removed from user-facing call notification copy, system-call notifications now expose only the `open_chat` follow-up path (no misleading accept/decline toast actions), and the in-app incoming-call card now points users toward the chat surface for controls/follow-up instead of showing transport internals.
- Evidence: `.\\node_modules\\.bin\\tsc.CMD --noEmit --pretty false` (from `apps/pwa`, passing); `.\\node_modules\\.bin\\vitest.CMD run app/components/desktop-notification-handler.test.tsx app/features/notifications/utils/notification-presentation.test.ts app/lib/notification-service.test.ts` (from `apps/pwa`, 27/27 passing).
- Uncertainty: Windows native runtime replay is still required to confirm the OS toast click path reliably opens the chat surface, since the current native adapter still cannot own inline answer/decline behavior.
- Next: Run a desktop notification replay to verify simplified call notifications now open the target chat reliably without exposing room IDs or non-functional system-toast call actions, then continue the voice-call runtime replay for waveform motion and timeout diagnostics (`messaging.realtime_voice.connect_timeout_diagnostics` + `messaging.realtime_voice.connect_timeout_extended`).
### 2026-04-08T16:08:30Z checkpoint
- Summary: Removed extra explanatory copy from the in-app incoming-call card and changed actionable desktop notifications to prefer the JS-owned browser/WebView notification path when an onClick handler is present, so toast clicks can route into the target chat instead of relying on the Windows native adapter that only dismisses the toast.
- Evidence: not provided
- Uncertainty: not provided
- Next: Run a desktop notification replay on Windows: verify incoming call and DM toasts now click through into the exact chat surface, and confirm the slimmer in-app incoming-call card still feels clear without the extra helper text.
### 2026-04-08T16:13:35Z checkpoint
- Summary: Reverted the attempted JS/browser notification fallback for Tauri desktop after it surfaced as Windows PowerShell in Windows toasts. Native-branded desktop notifications are restored, the slimmer in-app incoming-call card remains, and the Windows system-toast click-through limitation remains unresolved under the current native adapter.
- Evidence: not provided
- Uncertainty: not provided
- Next: Investigate a native-branded Windows notification click bridge instead of WebView/browser notifications; user should retest that call/message toasts are back to normal Obscur branding while in-app card copy stays simplified.
### 2026-04-08T17:56:04Z checkpoint
- Summary: Cut and pushed release v1.3.10 from main. Root/package/version contracts were aligned to 1.3.10, CHANGELOG gained a v1.3.10 entry, release commit 395e7fdb was created (elease: v1.3.10), and tag v1.3.10 was pushed to origin.
- Evidence: not provided
- Uncertainty: not provided
- Next: Monitor the v1.3.10 remote release flow and validate packaged/runtime behavior on the next install pass, with special attention to Windows native notification click behavior which remains limited under the current adapter.
### 2026-04-09T03:31:29Z checkpoint
- Summary: Cleared the failing release gates by updating the offline asset policy to validate the actual local font owner path in apps/pwa/app/globals.css instead of a stale next/font/google contract, and by hardening release-preflight branch/command resolution for Windows and GitHub Actions detached checkouts (git.exe on Windows plus GITHUB_REF_NAME/GITHUB_HEAD_REF fallback before git branch probing).
- Evidence: not provided
- Uncertainty: not provided
- Next: Commit and push the release-gate script/doc fixes, then rerun the remote CI push workflow to confirm Preflight Checks and reliability-gates both stay green in GitHub Actions.
### 2026-04-09T03:41:10Z checkpoint
- Summary: Committed the release-gate parity fixes as a0a2c65a (\fix: restore release gate parity), pushed main, deleted the old remote v1.3.10 tag, and recreated/pushed v1.3.10 so it now points at the corrected commit instead of the earlier release snapshot.
- Evidence: not provided
- Uncertainty: not provided
- Next: Monitor the refreshed v1.3.10 CI/release run on GitHub and confirm the repaired gates stay green on the recreated tag.
### 2026-04-09T05:50:55Z checkpoint
- Summary: Replaced the legacy inline voice-call invite block in message-list with VoiceCallInviteCard, added terminal call-result styling for completed/missed/timed-out/failed outcomes, removed room-id display from the card, and enabled callback only for missed incoming calls.
- Evidence: not provided
- Uncertainty: not provided
- Next: Manually verify outgoing unanswered, incoming missed, timeout, failure, and completed call cards in the chat timeline to confirm the visual states and callback affordance match live runtime behavior.
### 2026-04-09T08:27:14Z checkpoint
- Summary: Patched settings-page localization leaks by moving visible Appearance, Notifications, Relays, and Storage rollout/status copy onto translation keys, localized shared SettingsActionStatus phase labels, and added matching en/es/zh locale entries for the new settings keys.
- Evidence: not provided
- Uncertainty: not provided
- Next: Manually verify Spanish and Chinese settings pages again, especially relay/API status cards and storage rollout flags, then sweep remaining hard-coded settings strings outside this patched subset if any English still appears.
### 2026-04-09T10:42:33Z checkpoint
- Summary: Localized remaining settings security/appearance leaks by replacing hard-coded English in password-reset and auto-lock panels, added matching en/es/zh locale keys, and updated the focused settings i18n test mock for interpolation; apps/pwa tsc passes and auto-lock-settings-panel vitest passes.
- Evidence: not provided
- Uncertainty: not provided
- Next: Manually verify Spanish and Chinese settings pages again, especially relay/API status cards and storage rollout flags, then sweep any remaining hard-coded English outside the patched security settings subset if surfaced.
### 2026-04-09T14:14:38Z checkpoint
- Summary: Hardened canonical app-shell navigation owner against dev/native route-mount stalls by adding idle route prefetch warmup for core nav targets, with explicit warmup diagnostics in app-shell. This keeps UI route chunks warming locally instead of waiting for first-click compilation/mount under dev server latency, without conflating relay readiness with shell renderability. apps/pwa tsc passes and focused app-shell vitest passes (12/12).
- Evidence: not provided
- Uncertainty: not provided
- Next: Reproduce the page-switch freeze in desktop dev runtime and inspect navigation diagnostics (
### 2026-04-09T14:15:42Z checkpoint
- Summary: Corrected the navigation-freeze handoff after the prior checkpoint truncated its Next step. Current state remains: app-shell route prefetch warmup landed, apps/pwa typecheck passes, and focused app-shell tests pass.
- Evidence: not provided
- Uncertainty: not provided
- Next: Reproduce the page-switch freeze in desktop dev runtime and inspect navigation diagnostics: navigation.route_request, navigation.route_mount_probe_slow, navigation.route_stall_hard_fallback, and navigation.route_prefetch_warmup_started/completed. Use that evidence to decide whether the remaining stall is route-mount latency, a desktop WebView/runtime issue, or a specific route surface.
### 2026-04-09T15:51:31Z checkpoint
- Summary: Reduced deterministic page-switch freeze pressure for Discover and Settings by splitting both route entry points into lightweight dynamic wrappers (\u0007pp/search/page.tsx, \u0007pp/settings/page.tsx) that lazy-load the existing heavy client page bodies from search-page-client.tsx and settings-page-client.tsx with local loading shells. This keeps sidebar navigation able to render a local UI immediately instead of blocking on the full Discover/Settings bundle during dev/native route switches. apps/pwa tsc passes and focused app-shell vitest passes (12/12).
- Evidence: not provided
- Uncertainty: not provided
- Next: Retest desktop dev runtime switching from sidebar to Discover and Settings. If the UI now shows the loading shell instead of freezing, capture whether any remaining delay comes from the lazy client page body itself; if it still hard-freezes, inspect navigation diagnostics plus desktop WebView logs to identify whether the stall is below the route owner.
### 2026-04-09T16:13:59Z checkpoint
- Summary: Reduced desktop page-switch freeze pressure by making app-shell route warmup explicit and bounded: desktop runtime now skips automatic route prefetch warmup entirely, and web warmup only prefetches lightweight routes (/network, /vault) once instead of rewarming all nav routes including heavy Discover/Settings after every navigation. Added a navigation-prefetch warmup policy module plus focused tests, keeping lazy Discover/Settings wrappers intact while removing repeated background compile/load pressure from the canonical navigation owner path.
- Evidence: not provided
- Uncertainty: not provided
- Next: Retest the desktop runtime by switching Chats -> Network -> Discover -> Settings repeatedly. Confirm whether Discover/Settings now stay interactive with only the local loading shell delay. If any hard freeze remains, capture navigation diagnostics plus desktop WebView logs to determine whether the remaining stall is inside the lazy client page body or below the route owner.
### 2026-04-10T04:40:53Z checkpoint
- Summary: Implemented the first Vault manageability recovery slice through the existing local-only Vault owner path. Hidden media no longer disappears irreversibly: Vault now supports a dedicated Hidden filter with counts, per-item Restore, bulk Restore in selection mode, and a clearer empty-state message. Hide remains a Vault-only organization action, separate from Delete Local/cache flush and separate from chat/community message truth. Added focused component coverage in vault-media-grid.test.tsx and revalidated apps/pwa typecheck.
- Evidence: not provided
- Uncertainty: not provided
- Next: Retest the Vault UX manually with a mixed media set: hide several items, confirm they disappear from All/Local/Remote/Favorites, reappear under Hidden, and can be restored individually or in bulk without affecting the original chat/community media surfaces. Then decide the next Vault management slice: search/sort/source filters or a conversation-origin drill-down.
### 2026-04-10T04:52:18Z checkpoint
- Summary: Extended the Vault manageability slice beyond reversible hiding. VaultMediaGrid now includes lightweight search and sort controls (filename/content-type/URL/kind search plus newest/oldest/file-name sort) while preserving the existing owner boundary: Vault manages aggregated library presentation and local cache only, not chat/community message truth. Hidden items remain recoverable through the Hidden filter and restore actions. Added focused component coverage for both hide/restore and search/sort browsing behavior, and apps/pwa typecheck still passes.
- Evidence: not provided
- Uncertainty: not provided
- Next: Manually retest Vault with a larger mixed media set in desktop/PWA: confirm search narrows by filename/type, sort changes the card order predictably, Hidden items stay excluded from normal filters until restored, and Delete Local still only affects cache state. Then choose the next Vault pre-release slice: origin drill-down back to the source conversation/community, or richer metadata filters (date range / file kind chips / only cached).
### 2026-04-10T04:58:39Z checkpoint
- Summary: Completed the next Vault release slice by wiring origin drill-down into the existing aggregated media owner path. Vault media items now retain sourceConversationId from the original message record, and VaultMediaGrid exposes Open Source actions in both the per-item menu and preview footer, routing back through the canonical /?convId=... conversation path instead of inventing a detached media route. Search, sort, hidden recovery, and local cache actions remain Vault-only. Focused Vault component coverage now verifies hide/restore, search/sort, and source-chat routing; apps/pwa typecheck still passes.
- Evidence: not provided
- Uncertainty: not provided
- Next: Manually retest Vault with real DM and community media: confirm Open Source from a Vault tile and preview returns to the correct conversation, hidden items remain reversible, and search/sort still behave predictably. Then decide the final pre-release Vault polish slice: richer filters (date range / only cached / only hidden), or explicit source badges/copy that distinguish DM vs community origin.
### 2026-04-10T06:45:20Z checkpoint
- Summary: Vault now exposes explicit origin labels and source-specific open actions in the aggregated media owner path, distinguishing DM vs community media without adding a separate routing owner. Added focused Vault tests and localized source-copy keys.
- Evidence: not provided
- Uncertainty: not provided
- Next: Manually retest Vault with real DM and community media in desktop/PWA: confirm DM items show direct-message origin copy, community items show community origin copy, Open Source actions still route to the correct conversation, and hidden/search/sort behavior remains intact. Then decide whether the final pre-release Vault slice should be richer origin metadata (participant/community naming) or additional filters.
### 2026-04-10T07:04:28Z checkpoint
- Summary: Fixed Vault browsing polish issues in the existing aggregated media owner path: item action menus are no longer clipped by tile overflow, and the Sort control now uses an app-owned themed dropdown that renders consistently in light and dark modes. Updated focused Vault tests and revalidated apps/pwa typecheck.
- Evidence: not provided
- Uncertainty: not provided
- Next: Manually verify the Vault grid in desktop/PWA: open an item menu near tile edges to confirm it fully escapes the card bounds, and open the Sort dropdown in both light and dark themes to confirm contrast/readability. Then continue the remaining real-media Vault replay for DM vs community origin copy and source routing.
### 2026-04-10T10:34:21Z checkpoint
- Summary: Optimized fresh-device encrypted backup restore so account sync no longer hydrates local IndexedDB/message-queue history before showing remote contacts/chat state when the incoming backup already has durable private-state evidence. Added a focused restore regression test locking the fast path while preserving the existing local-evidence hydration path for sparse/invite-recovery cases.
- Evidence: not provided
- Uncertainty: not provided
- Next: Manually verify new-device login on desktop/PWA with a populated account: confirm contacts and message history appear sooner, measure whether the empty sidebar/history notice clears promptly, and capture account_sync.backup_restore_merge_diagnostics to confirm freshDevice=true uses shouldHydrateLocalMessages=false on the fast path. If users still wait too long, inspect relay fetch timing and consider staging UI status/notice policy next.
### 2026-04-10T12:37:35Z checkpoint
- Summary: Fixed the late-restore hydration regression keeping new-device contacts/history blank after backup restore. MessagingProvider now refreshes from scoped chat-state when CHAT_STATE_REPLACED_EVENT fires, so restored DM/contact rows appear even if the provider already hydrated an empty state on mount. MessagePersistenceService now prefers the in-memory replaced chat-state over stale IndexedDB chatState during replace-triggered migration, closing the race where restored history never migrated into the messages store because the replace event fired before the deferred chatState DB write landed. Added focused provider and message-persistence regression tests; apps/pwa targeted vitest and typecheck pass.
- Evidence: not provided
- Uncertainty: not provided
- Next: Manually retest new-device login on desktop/PWA with a populated account. Verify that after restore completes the DM sidebar populates without a reload and selecting a restored conversation shows migrated history. Capture messaging.chat_state_replaced, messaging.legacy_migration_diagnostics, and account_sync.backup_restore_apply_diagnostics. If history is still missing after the sidebar repopulates, patch the conversation-history hook to refresh directly on late restore for already-open conversations.
### 2026-04-10T13:19:29Z checkpoint
- Summary: Patched late-restore messaging refresh end-to-end: MessagingProvider scoped refresh plus useConversationMessages late chat-state replace rehydrate now cover both sidebar contacts and already-open conversations after backup restore; added focused provider, persistence, and conversation-hook regression coverage; apps/pwa targeted vitest and typecheck pass.
- Evidence: not provided
- Uncertainty: not provided
- Next: Manually retest new-device login on desktop/PWA with a populated account. Verify that after restore completes the DM sidebar populates without a reload and an already-open restored conversation shows migrated history. Capture messaging.chat_state_replaced, messaging.legacy_migration_diagnostics, and account_sync.backup_restore_apply_diagnostics. If history still lags after those events, inspect whether the selected conversation id or route state is stale rather than the chat-state refresh owner path.
### 2026-04-10T13:59:29Z checkpoint
- Summary: Identified and subtracted a second DM-contact owner that was wiping or hiding restored contacts on fresh devices. Removed the main-shell bridge that rewrote MessagingProvider.createdConnections from peerTrust.acceptedPeers, and taught usePeerTrust to rehydrate accepted peers explicitly when CHAT_STATE_REPLACED_EVENT lands so restored chat-state can make DM conversations visible without waiting on unrelated rerenders. Added focused peer-trust and main-shell regression coverage; apps/pwa targeted vitest and typecheck pass.
- Evidence: not provided
- Uncertainty: not provided
- Next: Retest fresh-device login in Chrome guest window and desktop. Verify that after backup restore the DM sidebar repopulates on its own, the history-sync notice clears once restored chats are visible, and an already-open restored conversation shows migrated history. Capture messaging.chat_state_replaced, account_sync.backup_restore_apply_diagnostics, messaging.legacy_migration_diagnostics, and messaging.history_sync_notice_visible. If contacts still stay hidden, inspect whether projection-read authority or request/peer acceptance evidence is masking restored chats despite the repaired legacy owner path.
### 2026-04-10T15:10:05Z checkpoint
- Summary: Added durable DM delete tombstones to encrypted backup publish/restore and bootstrap filtering so stale deleted messages or call-log invite rows cannot resurrect on fresh-device login even when only tombstone evidence remains. Local delete-for-everyone now stores canonical target aliases before backup fast-follow publish.
- Evidence: `.\node_modules\.bin\vitest.CMD run app/features/account-sync/services/encrypted-account-backup-service.test.ts app/features/account-sync/services/account-event-bootstrap-service.test.ts app/features/messaging/services/message-delete-tombstone-store.test.ts app/features/main-shell/hooks/use-chat-actions.delete-targets.test.ts` (from `apps/pwa`, 72/72 passing); `.\node_modules\.bin\tsc.CMD --noEmit --pretty false` (from `apps/pwa`, passing).
- Uncertainty: Manual two-user fresh-device replay is still required to confirm relay-backed encrypted backup selection plus mutation fast-follow publish prevent deleted text rows and deleted voice-call invite cards from resurfacing on real desktop/PWA login.
- Next: Run a fresh-device two-user login replay in Chrome guest window and desktop with historical delete-for-everyone text and voice-call invite rows. Verify no deleted history or ghost call-log cards return after restore, and capture account_sync.backup_restore_merge_diagnostics, account_sync.backup_restore_apply_diagnostics, account_sync.backup_restore_delete_target_unresolved, and messaging.delete_for_everyone_remote_result.
### 2026-04-10T15:43:45Z checkpoint
- Summary: Hardened local DM delete convergence against self-authored alias drift. Message delete bus events now carry identity aliases, useConversationMessages removes rows by id or eventId, MessagePersistenceService persists alias suppressions, and local delete-for-me / local delete-for-everyone emit alias-aware deletes so fresh-window restore cannot keep A-authored rows just because they rehydrate under canonical eventId instead of the original wrapper id.
- Evidence: not provided
- Uncertainty: not provided
- Next: Replay the exact A/B fresh-window login case the user reported. On account A, locally delete mixed A-authored and B-authored DM history, open a fresh Chrome guest window and desktop window, wait for restore, and verify both authors' deleted rows stay absent. Capture account_sync.backup_restore_merge_diagnostics, account_sync.backup_restore_apply_diagnostics, account_sync.backup_restore_delete_target_unresolved, messaging.delete_for_everyone_remote_result, and any surviving row's id/eventId pair from dev tools if resurrection still occurs.
### 2026-04-10T16:02:52Z checkpoint
- Summary: Connected local delete tombstones to account-sync mutation publishing. Incoming-message Delete for me was already writing durable tombstones, but those writes did not trigger encrypted backup refresh. Tombstone store updates now emit account-sync mutation signals, so backup fast-follow publish can carry delete-for-me history suppression to fresh logins. Focused delete/persistence/restore suites and apps/pwa typecheck pass.
- Evidence: not provided
- Uncertainty: not provided
- Next: Replay the user's exact scenario: on account A, delete incoming messages from B (including call-log cards), wait briefly for backup fast-follow publish, then log into a fresh Chrome/desktop window and verify those deleted incoming rows stay gone. Capture account_sync.backup_publish_attempt/result, account_sync.backup_restore_merge_diagnostics, account_sync.backup_restore_apply_diagnostics, and account_sync.backup_restore_delete_target_unresolved. If rows still resurrect, inspect whether the fresh window is selecting an older remote backup event despite the local tombstone-triggered publish.
### 2026-04-10T17:02:13Z checkpoint
- Summary: Fixed a stale DM-history owner path that could republish deleted incoming rows. Delete-for-me and local delete-for-everyone now subtract message identities from the canonical chat-state blob via chatStateStoreService.removeMessageIdentities, so encrypted backup hydration no longer starts from stale chatState messages that survived only in the chatState IndexedDB blob after message-store deletion. Focused chat-state/delete/persistence/restore suites and apps/pwa typecheck pass.
- Evidence: not provided
- Uncertainty: not provided
- Next: Replay the user's exact incoming-message delete case again. Delete B-authored DM rows on A, wait for the tombstone-triggered backup publish, then open a fresh window and verify the rows stay gone. If anything still resurrects, capture account_sync.backup_publish_attempt/result, account_sync.backup_restore_selection, account_sync.backup_restore_merge_diagnostics, and the surviving row's id/eventId from dev tools to confirm whether restore is still selecting an older backup event rather than replaying stale local chatState.
### 2026-04-11T04:07:57Z checkpoint
- Summary: Added a canonical DM removal event to the account projection owner path. Local delete-for-me/delete-for-everyone now append DM_REMOVED_LOCALLY events, bootstrap import emits the same event from durable tombstones, and the account-event reducer subtracts deleted messages from projection replay. Also narrowed backup projection fallback to recover only outgoing history, not incoming messages. Focused projection/delete/restore suites and apps/pwa typecheck pass.
- Evidence: not provided
- Uncertainty: not provided
- Next: Replay the user's fresh-device restore again with deleted incoming rows that previously resurfaced as Unknown sender. If any still appear, capture account_sync.backup_publish_attempt/result, account_sync.backup_restore_selection, account_sync.backup_restore_merge_diagnostics, and whether projectionReadAuthority/useProjectionReads is active for that conversation so we can verify whether the fresh device is still selecting an older backup or whether live relay/account-event ingestion is reintroducing messages after restore.
### 2026-04-11T08:52:59Z checkpoint
- Summary: Prepared release v1.3.12 for install/promotion. Updated README/CHANGELOG/docs to reflect cross-device DM history hardening and metadata hydration recovery, synced release-tracked versions to 1.3.12, rebuilt the desktop production installer, and reran release:test-pack successfully after the final DM-history and metadata fixes.
- Evidence: not provided
- Uncertainty: not provided
- Next: Install the production desktop artifact at apps/desktop/src-tauri/target/release/bundle/nsis/Obscur_1.3.12_x64-setup.exe, run fresh-device A/B sanity replays against the packaged build, then commit/tag/push v1.3.12 if runtime behavior matches the latest production artifact.
### 2026-04-11T14:32:02Z checkpoint
- Summary: Added runtime-safe large media upload guardrails. Attachment selection now rejects oversized batches before processing, skips heavyweight image/video preprocessing above bounded safety budgets, native/Tauri uploads prefer the browser upload path for oversized files to avoid arrayBuffer byte-buffer pressure, and sent-file caching skips in-memory byte duplication for large attachments. Focused upload/media suites and apps/pwa typecheck pass.
- Evidence: not provided
- Uncertainty: not provided
- Next: Manually test production and dev builds with large media files near and above the new safety budgets: verify oversized selections fail early with a clear message instead of hanging/crashing, mid-sized videos still attach/upload, and large successful uploads no longer spike memory as sharply during post-upload sent-file caching. If needed after runtime replay, tune the native-direct-upload and preprocess budgets.
### 2026-04-12T14:21:13Z checkpoint
- Summary: Extended the Vault owner path with two management actions: Download saves Vault items to a user-chosen local path (native save dialog on desktop, browser download fallback on web), and Hide/Restore UX is now framed explicitly as Remove from Vault / Restore to Vault so users can make items invisible in the aggregated library without touching chat/source truth. Added focused Vault component + native adapter coverage; apps/pwa typecheck passes.
- Evidence: not provided
- Uncertainty: not provided
- Next: Manually test Vault in the production desktop build: download an image/video/audio/file from the Vault to a chosen filesystem path, confirm the saved file opens correctly, remove several items from Vault and verify they disappear from normal filters, appear under Hidden, and can be restored without affecting the original DM/community message history.
### 2026-04-13T05:43:55Z checkpoint
- Summary: Reconciled interrupted Vault/media-upload work into one coherent owner path: Vault now uses a single canonical Removed filter with legacy Hidden migration, desktop Vault download uses the native save dialog boundary with browser fallback, and the in-progress upload hardening slice is validated in-tree with single-video-per-message policy, provider rotation, and transient upload retry handling.
- Evidence: .\\\\node_modules\\\\.bin\\\\vitest.CMD run app/features/vault/components/vault-media-grid.test.tsx app/features/vault/services/native-local-media-adapter.test.ts (from apps/pwa, 9/9 passing); .\\\\node_modules\\\\.bin\\\\vitest.CMD run app/features/messaging/lib/media-upload-policy.test.ts app/features/messaging/lib/nip96-upload-service.test.ts (from apps/pwa, 12/12 passing); .\\\\node_modules\\\\.bin\\\\tsc.CMD --noEmit --pretty false (from apps/pwa, passing)
- Uncertainty: Manual desktop/PWA runtime replay is still required for Vault download/remove/restore behavior and for real large-media upload behavior; use-chat-actions retry is validated indirectly through lower-level upload/policy coverage rather than a dedicated hook test.
- Next: Manually test the production desktop build for both recovered slices: in Vault, download an image/video/audio/file to a chosen filesystem path, confirm the saved file opens correctly, remove several items from Vault and verify they disappear from normal filters, appear under Removed, and can be restored without affecting the original DM/community message history; in messaging, test large media uploads near and above the safety budgets to confirm early rejection, single-video-per-message enforcement, retry resilience, and successful uploads without hangs.
### 2026-04-13T05:45:38Z checkpoint
- Summary: Revalidated the surrounding use-chat-actions hook contract after the interrupted upload retry diff. The focused delete-target suite still passes on top of the reconciled Vault/download and upload-policy changes, so the remaining work is runtime replay rather than additional in-tree repair.
- Evidence: .\\\\node_modules\\\\.bin\\\\vitest.CMD run app/features/vault/components/vault-media-grid.test.tsx app/features/vault/services/native-local-media-adapter.test.ts (from apps/pwa, 9/9 passing); .\\\\node_modules\\\\.bin\\\\vitest.CMD run app/features/messaging/lib/media-upload-policy.test.ts app/features/messaging/lib/nip96-upload-service.test.ts (from apps/pwa, 12/12 passing); .\\\\node_modules\\\\.bin\\\\vitest.CMD run app/features/main-shell/hooks/use-chat-actions.delete-targets.test.ts (from apps/pwa, 5/5 passing); .\\\\node_modules\\\\.bin\\\\tsc.CMD --noEmit --pretty false (from apps/pwa, passing)
- Uncertainty: Manual desktop/PWA runtime replay is still required for Vault download/remove/restore behavior and for real large-media upload behavior; the new upload retry behavior in use-chat-actions remains covered indirectly by lower-level upload/policy tests rather than a dedicated hook-specific retry test.
- Next: Manually test the production desktop build for both recovered slices: in Vault, download an image/video/audio/file to a chosen filesystem path, confirm the saved file opens correctly, remove several items from Vault and verify they disappear from normal filters, appear under Removed, and can be restored without affecting the original DM/community message history; in messaging, test large media uploads near and above the safety budgets to confirm early rejection, single-video-per-message enforcement, retry resilience, and successful uploads without hangs.
### 2026-04-13T06:37:00Z checkpoint
- Summary: Captured live browser runtime evidence for both interrupted recovery slices. Production next-start replay now verifies Vault source badges, Removed-filter round trip, and browser downloads for image/video/audio/file, and verifies the messaging composer surfaces the single-video-per-message and 384MB batch-size guardrails on a seeded unlocked DM thread.
- Evidence: .artifacts/runtime-replay/browser-runtime-summary.json; .artifacts/runtime-replay/vault-live-grid.png; .artifacts/runtime-replay/vault-live-removed-filter.png; .artifacts/runtime-replay/downloads/vault-image.png; .artifacts/runtime-replay/downloads/vault-video.mp4; .artifacts/runtime-replay/downloads/vault-audio.wav; .artifacts/runtime-replay/downloads/vault-notes.txt
- Uncertainty: Desktop-native behavior is still the remaining gap: the Vault Tauri save-dialog path and actual desktop upload success/retry path were not automated in this browser replay, and large successful upload stability still needs a true desktop/manual run.
- Next: Run the packaged desktop build (apps/desktop/src-tauri/target/release/bundle/nsis/Obscur_1.3.12_x64-setup.exe) and finish the remaining native-only replay: in Vault, confirm the save dialog writes image/video/audio/file downloads to chosen filesystem paths and the files open correctly; in messaging, verify actual desktop upload success/retry behavior and large successful upload stability now that the browser composer already shows the single-video and 384MB guardrails.
### 2026-04-13T09:28:12Z checkpoint
- Summary: Investigated fresh-device community message loss. Root cause is app-side restore/materialization drift, not a relay/community-server ownership issue: community history already flows into encrypted backup chatState.groupMessages, but MessagePersistenceService.migrateFromLegacy preferred metadata-only scoped chat-state from localStorage over full IndexedDB chatState, so restored community timelines could be skipped when the replace event was missed or when only lightweight cache state was available. Patched migrateFromLegacy to fall back to IndexedDB when cached chat-state lacks timeline domains, and added a focused regression test for restored group timelines.
- Evidence: .\\\\node_modules\\\\.bin\\\\vitest.CMD run app/features/messaging/services/message-persistence-service.test.ts (from apps/pwa, 11/11 passing); .\\\\node_modules\\\\.bin\\\\tsc.CMD --noEmit --pretty false (from apps/pwa, passing); docs/04-messaging-and-groups.md; docs/10-community-and-groups-overhaul.md; docs/16-cross-device-group-visibility-incident.md
- Uncertainty: A full fresh-device runtime replay is still required to confirm the patched migration closes the real community-history blank timeline reported by the user, especially for restore sequences where membership is reconstructed from ledger evidence and the group chat opens after account sync completes.
- Next: Run a two-device fresh-login replay focused on community message history: create/join a community on device A, exchange community messages, log into a fresh device B, and verify restored group history appears in the community chat without requiring a manual reload. Capture account_sync.backup_restore_merge_diagnostics, account_sync.backup_restore_apply_diagnostics, messaging.chat_state_replaced, messaging.legacy_migration_diagnostics, and groups.membership_recovery_hydrate. If history is still blank, inspect whether the restored community conversation id in groupMessages matches the selected group conversation id after membership reconstruction.
### 2026-04-13T11:24:34Z checkpoint
- Summary: Extended the community cross-device investigation and landed a second durability hardening fix. Besides the restored group-history materialization bug in MessagePersistenceService, I found a membership persistence gap in the canonical account-sync owner: useAccountSync only handled mutation-driven backup publishes once snapshot.phase was ready, so early community join mutations could be missed even though relay membership succeeded. Patched useAccountSync to defer private-state mutation publishes until ready, and added a focused regression test covering community_membership_changed before ready plus a group-provider integration test proving groupMessages-only restore reconstructs membership.
- Evidence: .\\\\node_modules\\\\.bin\\\\vitest.CMD run app/features/account-sync/hooks/use-account-sync.test.ts app/features/groups/providers/group-provider.cross-device-membership.integration.test.tsx app/features/messaging/services/message-persistence-service.test.ts (from apps/pwa, 27/27 passing); .\\\\node_modules\\\\.bin\\\\tsc.CMD --noEmit --pretty false (from apps/pwa, passing); docs/04-messaging-and-groups.md; docs/10-community-and-groups-overhaul.md; docs/16-cross-device-group-visibility-incident.md
- Uncertainty: A real two-device fresh-device replay is still required to confirm the reported symptom is fully closed in runtime, especially the sequence where account B accepts an invite, relay roster reflects B as joined on account A, and B then signs into a new device before or during account-sync convergence.
- Next: Run a targeted two-device runtime replay for community durability: on device A/B, accept a community invite on B, verify A sees B as a member, then sign B into a fresh device while account sync is still converging. Confirm both the group list and community timeline restore without requiring rejoin. Capture account_sync.backup_publish_attempt/result, account_sync.backup_restore_merge_diagnostics, account_sync.backup_restore_apply_diagnostics, messaging.legacy_migration_diagnostics, groups.membership_recovery_hydrate, and groups.membership_ledger_load. If the symptom persists, compare whether B's latest published backup actually contains createdGroups / communityMembershipLedger / groupMessages for that community or whether relay selection is choosing an older backup event.
### 2026-04-13T16:15:49Z checkpoint
- Summary: Preserved canonical hashed community identity during membership-ledger and recovery merges so fresh-device restore cannot downgrade real communities into weaker groupId+relay placeholder shells. Added focused ledger/recovery/provider regression coverage for hashed-identity downgrade and revalidated adjacent account-sync + cross-device membership suites.
- Evidence: not provided
- Uncertainty: not provided
- Next: Run a targeted two-device runtime replay for community durability with a sealed community that uses hashed canonical identity: on device A create/invite, on device B accept and exchange community messages, then sign B into a fresh device while account sync is still converging. Confirm the restored group keeps the same community identity/name instead of falling back to a Private Group shell, and capture account_sync.backup_publish_attempt/result, account_sync.backup_restore_merge_diagnostics, account_sync.backup_restore_apply_diagnostics, groups.membership_recovery_hydrate, groups.membership_ledger_load, and any restored group id/communityId pair if drift persists.
### 2026-04-13T17:05:46Z checkpoint
- Summary: Fixed a stale community member convergence path in the canonical sealed-community runtime. Relay roster (kind 39002) replay now subtracts omitted active members as MEMBER_LEFT at the roster timestamp instead of only ever seeding MEMBER_JOINED, so peers do not stay permanently 'already in this community' when a member has locally left but sealed leave evidence is missing. Added a focused use-sealed-community integration regression for newer roster omission and revalidated adjacent group-provider/cross-device suites plus apps/pwa typecheck.
- Evidence: not provided
- Uncertainty: not provided
- Next: Run a targeted two-device runtime replay for the exact stale-member case: have B enter the reset placeholder/private group, leave it, then inspect A's original TestClub1 member list and invite dialog. Confirm B disappears from active members and invite eligibility once newer roster evidence arrives, and capture groups.membership_recovery_hydrate, groups.membership_ledger_load, any community.event.rejected entries, account_sync.backup_publish_attempt/result, and the live member list before/after the relay roster refresh if drift persists.
### 2026-04-13T17:42:21Z checkpoint
- Summary: Fixed the recovery dead-end after community leave. The sealed-community runtime now subtracts omitted members from newer relay roster snapshots so stale active-member state does not block invites, and the Network/Discovery recovery surfaces now route users through the canonical community preview/join flow instead of creating another local shell or dead-ending on an empty Groups tab.
- Evidence: not provided
- Uncertainty: not provided
- Next: Replay the exact A/B TestClub1 scenario in runtime: after B leaves the reset placeholder/private group, open A's original TestClub1 page and B's Network surfaces. Confirm A drops B from the active member list/invite gate once relay roster refreshes, and confirm B can recover through Discovery/public preview into the canonical join/request flow rather than seeing only an empty Groups tab. Capture groups.membership_recovery_hydrate, groups.membership_ledger_load, any community.event.rejected entries, and the visible member roster / preview join state before and after refresh if drift persists.
### 2026-04-14T09:59:50Z checkpoint
- Summary: Locked the remaining community recovery UI contracts in-tree. Added focused tests proving `GroupDiscovery` routes both joined and invite-only discovery results through the canonical public preview flow, and `NetworkDashboard` now sends an empty Groups state to Discovery instead of dead-ending or opening a local shell. Revalidated the sealed-community stale-member subtraction and cross-device membership reconstruction owner paths.
- Evidence: `.\\node_modules\\.bin\\vitest.CMD run app/features/groups/components/group-discovery.test.tsx app/features/network/components/network-dashboard.test.tsx app/features/groups/hooks/use-sealed-community.integration.test.ts app/features/groups/providers/group-provider.cross-device-membership.integration.test.tsx` (from `apps/pwa`, 19/19 passing); `.\\node_modules\\.bin\\tsc.CMD --noEmit --pretty false` (from `apps/pwa`, passing)
- Uncertainty: Real runtime replay is still the remaining gap. The in-tree contracts now lock the canonical recovery path, but the exact A/B TestClub1 sequence still needs live verification against relay/account-sync timing.
- Next: Replay the exact A/B TestClub1 scenario in runtime: after B leaves the reset placeholder/private group, open A's original TestClub1 page and B's Network surfaces. Confirm A drops B from the active member list/invite gate once relay roster refreshes, and confirm B can recover through Discovery/public preview into the canonical join/request flow rather than seeing only an empty Groups tab. Capture `groups.membership_recovery_hydrate`, `groups.membership_ledger_load`, any `community.event.rejected` entries, and the visible member roster / preview join state before and after refresh if drift persists.
### 2026-04-14T10:48:15Z checkpoint
- Summary: Removed a fresh-device phantom-membership recovery path that matched the user’s unresolved symptom. `community-membership-reconstruction` was treating sender-local outgoing `community-invite-response` accept messages as durable joined evidence, which could recreate a one-member placeholder/private group for B on a fresh device even without canonical room-key/group-history/ledger evidence. Recovery now ignores sender-local accepted responses, and focused account-sync/group-provider regressions lock that no phantom private group is materialized from local acceptance alone.
- Evidence: `.\\node_modules\\.bin\\vitest.CMD run app/features/groups/services/community-membership-reconstruction.test.ts app/features/groups/providers/group-provider.test.tsx app/features/groups/providers/group-provider.cross-device-membership.integration.test.tsx app/features/account-sync/services/encrypted-account-backup-service.test.ts` (from `apps/pwa`, 82/82 passing); `.\\node_modules\\.bin\\tsc.CMD --noEmit --pretty false` (from `apps/pwa`, passing)
- Uncertainty: Runtime replay is still required to confirm this closes the real TestClub1 divergence end to end. A’s stale member list/reinvite gate may still depend on whether B’s leave produces roster evidence that A ingests in time, but B should no longer self-recreate the phantom reset private group from sender-local accepted-response DM history alone.
- Next: Replay the exact A/B TestClub1 scenario in runtime from a clean state: create/invite on A, accept on B, log B into a fresh device, verify B no longer gets a reset placeholder/private group from local accepted-response history alone, then have B leave if any recovery shell still appears and confirm A drops B from the active member list/invite gate after relay roster refresh. Capture `account_sync.backup_restore_merge_diagnostics`, `account_sync.backup_restore_apply_diagnostics`, `groups.membership_recovery_hydrate`, `groups.membership_ledger_load`, any `community.event.rejected` entries, and A’s visible invite eligibility before/after refresh if drift persists.
### 2026-04-14T11:01:12Z checkpoint
- Summary: Added a second convergence fix for A-side stale membership. `useSealedCommunity` now ingests direct scoped NIP-29 leave events (`9022`) as membership-left evidence, so if B’s device can publish the relay leave but misses the sealed leave payload, A can still subtract B from the active member set without waiting for a later roster snapshot. Added a focused integration regression for relay leave evidence without sealed leave payload.
- Evidence: `.\\node_modules\\.bin\\vitest.CMD run app/features/groups/hooks/use-sealed-community.integration.test.ts` (from `apps/pwa`, 13/13 passing); `.\\node_modules\\.bin\\tsc.CMD --noEmit --pretty false` (from `apps/pwa`, passing)
- Uncertainty: Live runtime replay is still required to confirm the combined fixes close the user-reported loop end to end. The remaining check is whether A’s invite UI, which derives eligibility from locally persisted member lists, now converges fast enough once the direct relay leave is ingested in runtime.
- Next: Run the exact A/B TestClub1 runtime replay again with the two new fixes in place. Verify B no longer self-recreates a one-member reset private group from local accepted-response history alone on fresh-device login, and verify A drops B from the active member list and reinvite block once B’s scoped relay leave (`9022`) or the next roster refresh arrives. Capture `account_sync.backup_restore_merge_diagnostics`, `account_sync.backup_restore_apply_diagnostics`, `groups.membership_recovery_hydrate`, `groups.membership_ledger_load`, any `community.event.rejected` entries, and A’s visible invite eligibility before/after refresh if drift persists.
### 2026-04-14T11:47:23Z checkpoint
- Summary: Rebalanced the fresh-device restore contract after the initial phantom-group fix proved too strict. `community-membership-reconstruction` now restores joined membership from sender-local accepted invite responses only when matching room-key invite evidence for the same community also exists in restored DM history. Bare outgoing accepted-response history still does not fabricate membership, but legitimate invite+accept pairs restore joined communities again. Revalidated account-sync restore, group-provider cross-device membership, and reconstruction suites after the contract change.
- Evidence: `.\\node_modules\\.bin\\vitest.CMD run app/features/groups/services/community-membership-reconstruction.test.ts app/features/groups/providers/group-provider.cross-device-membership.integration.test.tsx app/features/account-sync/services/encrypted-account-backup-service.test.ts` (from `apps/pwa`, 70/70 passing); `.\\node_modules\\.bin\\tsc.CMD --noEmit --pretty false` (from `apps/pwa`, passing)
- Uncertainty: The remaining truth check is runtime behavior, not in-tree contracts. We now have three intended guarantees at once: bare sender-local accept should not recreate a phantom private group, invite+room-key+accept evidence should restore legitimate joined communities, and A should converge from direct relay leave evidence. The exact live TestClub1 sequence still needs replay to confirm those three guarantees hold together under real relay timing.
- Next: Replay the exact A/B TestClub1 scenario again from a clean state. Verify:
  1. B fresh-device login does restore legitimate joined communities when matching invite room-key evidence exists.
  2. B does not get a phantom one-member reset private group from bare sender-local accepted-response history alone.
  3. After B leaves, A drops B from the active member list and reinvite block once direct scoped relay leave (`9022`) or roster refresh arrives.
Capture `account_sync.backup_restore_merge_diagnostics`, `account_sync.backup_restore_apply_diagnostics`, `groups.membership_recovery_hydrate`, `groups.membership_ledger_load`, any `community.event.rejected` entries, and A’s visible invite eligibility before/after refresh if drift persists.
### 2026-04-15T04:05:23Z checkpoint
- Summary: Investigated the privacy-critical DM delete/restore regression before the next tag. The current worktree points to two concrete owner-path risks: stale account-sync mutation replay could trigger backup publish on mount from old local mutation history before startup restore completes, and restore/materialization drift could leave restored DM or group history richer in legacy chat-state than in the projection/indexed owner path. In-progress fixes now remove immediate mutation replay to new subscribers, force non-v1 restore to migrate restored chat-state into the indexed messages store, and keep DM reads on legacy when restored chat-state is richer than projection. Focused account-sync, backup restore, projection authority, incoming-DM, conversation hydration, and message-persistence suites all pass, along with apps/pwa typecheck.
- Evidence: `.\\node_modules\\.bin\\vitest.CMD run app/features/account-sync/hooks/use-account-sync.test.ts app/features/account-sync/services/encrypted-account-backup-service.test.ts app/features/messaging/services/message-persistence-service.test.ts` (from `apps/pwa`, 84/84 passing); `.\\node_modules\\.bin\\tsc.CMD --noEmit --pretty false` (from `apps/pwa`, passing); `.\\node_modules\\.bin\\vitest.CMD run app/features/account-sync/services/account-projection-read-authority.test.ts app/features/messaging/hooks/use-conversation-messages.integration.test.ts app/features/messaging/controllers/incoming-dm-event-handler.test.ts app/features/account-sync/services/account-event-bootstrap-service.test.ts app/features/account-sync/services/account-event-reducer.test.ts` (from `apps/pwa`, 70/70 passing)
- Uncertainty: The remaining truth gap is runtime behavior, not focused suite coverage. The in-progress worktree changes align with the privacy incident, but we still need real A/B fresh-device replay to confirm no deleted rows resurface after restore and no mount-time stale mutation replay triggers a pre-restore backup publish in the live lifecycle.
- Next: Replay the user-reported A/B fresh-device DM deletion scenario from a clean state before the next release tag. Verify historical delete-for-everyone and local delete tombstones stay suppressed after login+restore, verify no startup backup publish is triggered from stale mutation history alone, and capture account_sync.backup_publish_attempt/result, account_sync.backup_restore_merge_diagnostics, account_sync.backup_restore_apply_diagnostics, account_sync.backup_restore_delete_target_unresolved, and messaging.delete_for_everyone_remote_result if any row resurfaces.
### 2026-04-15T05:40:18Z checkpoint
- Summary: Prepared the `v1.3.14` release content and validation lane. Updated release-facing docs (`README.md`, `CHANGELOG.md`, canonical docs, and `apps/website/README.md`) to reflect the current unreleased work, wired the root README to the production GIF library under `docs/assets/gifs/`, synced all release-tracked manifests to `1.3.14`, and fixed `scripts/bump-version.js` so it now updates root `package.json` before calling `version:sync` instead of silently reverting the bump.
- Evidence: `pnpm.cmd version:check` (passed); `pnpm.cmd docs:check` (passed); `pnpm.cmd release:test-pack -- --skip-preflight` (passed); `pnpm.cmd release:preflight -- --tag v1.3.14 --allow-dirty 1` (passed)
- Uncertainty: Validation is green, but the tree still needs to be committed before strict clean-tree preflight/tagging can be claimed complete.
- Next: Create the `v1.3.14` release commit and tag from the validated tree, publish it to origin, then begin the website lane in `apps/website` using `docs/assets/gifs/`, `CHANGELOG.md`, and GitHub release artifacts as the canonical content sources.
<!-- CONTEXT_CHECKPOINTS_END -->
