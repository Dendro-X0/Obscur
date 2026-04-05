# Current Session Handoff

- Last Updated (UTC): 2026-04-05T05:40:35Z
- Session Status: in-progress
- Active Owner: DM realtime presence truth surface (relay presence + inbound peer activity evidence)

## Active Objective

Make DM online/offline indicators converge in realtime during active chat exchange by using canonical relay presence with bounded inbound-activity evidence fallback.

## Current Snapshot

- What is true now:
  - `Reset Local History` now records a scoped cutoff so old relay-backed DM history and stale sync checkpoints do not come straight back after reset.
  - Runtime DM transport used to stay disabled during `bootstrapping`, even for the correct unlocked account, which could stall realtime incoming DMs and delete commands behind account restore.
  - DM transport now stays enabled during `bootstrapping` when projection ownership matches the active identity.
  - Outgoing DM rows now persist canonical event IDs (`rumor.id` for NIP-17) so delete-for-everyone can target recipient-visible IDs directly instead of relying on wrapper-only IDs.
  - `signEvent` now preserves caller-provided `created_at`, removing timestamp drift that previously broke deterministic rumor-id derivation for delete convergence.
  - Incoming transport now has a safety-sync watchdog (15s interval + tab-visibility resume trigger) so silent subscription stalls cannot leave DM/delete state stale indefinitely without refresh.
  - DM online indicators now resolve through a canonical owner path in `main-shell`: relay presence first, then bounded recent inbound peer-activity evidence to prevent active-chat false `OFFLINE`.
- What changed in this thread:
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

## Evidence

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

## Changed Files

- `apps/pwa/app/features/account-sync/services/history-reset-cutoff-store.ts`
- `apps/pwa/app/features/account-sync/services/account-event-bootstrap-service.ts`
- `apps/pwa/app/features/account-sync/services/account-event-bootstrap-service.test.ts`
- `apps/pwa/app/features/messaging/services/local-history-reset-service.ts`
- `apps/pwa/app/features/messaging/services/local-history-reset-service.test.ts`
- `apps/pwa/app/features/messaging/providers/runtime-messaging-transport-owner-provider.tsx`
- `apps/pwa/app/features/messaging/providers/runtime-messaging-transport-owner-provider.test.tsx`
- `apps/pwa/app/features/messaging/components/chat-view.tsx`
- `apps/pwa/app/features/messaging/components/chat-view.test.tsx`
- `apps/pwa/app/lib/i18n/locales/en.json`
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
- `apps/pwa/app/features/main-shell/hooks/use-chat-actions.delete-targets.test.ts`
- `apps/pwa/app/features/main-shell/main-shell.tsx`
- `apps/pwa/app/features/crypto/crypto-service-impl.ts`
- `apps/pwa/app/features/crypto/__tests__/crypto-service-impl.test.ts`
- `apps/pwa/app/features/messaging/controllers/enhanced-dm-controller.ts`
- `apps/pwa/app/features/messaging/controllers/enhanced-dm-controller.test.ts`
- `apps/pwa/app/features/network/services/presence-evidence.ts`
- `apps/pwa/app/features/network/services/presence-evidence.test.ts`

## Open Risks Or Blockers

- Full two-user runtime verification is still needed to confirm that live incoming DMs and delete commands now converge while the restore banner is present.
- Presence fallback currently uses inbound peer activity evidence; full two-user runtime replay is still needed to confirm acceptable online/offline transitions during idle periods with no inbound events.
- If DM delete-for-everyone still fails after canonical target-ID changes, the next likely owner is recipient relay scope evidence or delete-command relay publish coverage rather than local ID aliasing.
- `apps/pwa` typecheck currently has unrelated pre-existing failures in `app/features/messaging/hooks/use-conversation-messages.ts` (`readonly reverse` + implicit `any`) that were not introduced by this thread.

## Next Atomic Step

Run two-user reinstall/reset replay on production desktop to confirm history convergence and data retention across update install.



















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
<!-- CONTEXT_CHECKPOINTS_END -->
