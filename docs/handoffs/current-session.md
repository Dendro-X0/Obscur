# Current Session Handoff

- Last Updated (UTC): 2026-04-05T10:21:48Z
- Session Status: in-progress
- Active Owner: Account backup restore/hydration delete-command quarantine boundary

## Active Objective

Prevent deleted historical DM messages from resurfacing as `__dweb_cmd__`/JSON junk after login + account-sync restore by enforcing delete-command suppression at backup/restore owner boundaries.

## Current Snapshot

- What is true now:
  - `Reset Local History` now records a scoped cutoff so old relay-backed DM history and stale sync checkpoints do not come straight back after reset.
  - Runtime DM transport used to stay disabled during `bootstrapping`, even for the correct unlocked account, which could stall realtime incoming DMs and delete commands behind account restore.
  - DM transport now stays enabled during `bootstrapping` when projection ownership matches the active identity.
  - Outgoing DM rows now persist canonical event IDs (`rumor.id` for NIP-17) so delete-for-everyone can target recipient-visible IDs directly instead of relying on wrapper-only IDs.
  - `signEvent` now preserves caller-provided `created_at`, removing timestamp drift that previously broke deterministic rumor-id derivation for delete convergence.
  - Incoming transport now has a safety-sync watchdog (15s interval + tab-visibility resume trigger) so silent subscription stalls cannot leave DM/delete state stale indefinitely without refresh.
  - DM online indicators now resolve through a canonical owner path in `main-shell`: relay presence first, then bounded recent inbound peer-activity evidence to prevent active-chat false `OFFLINE`.
  - Encrypted account backup restore/hydration now quarantines delete-command DM rows and their targeted historical rows before chat-state restore/import, and chat preview rows no longer keep command payload snippets as `lastMessage`.
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
- `.\node_modules\.bin\vitest.cmd run app/features/account-sync/services/encrypted-account-backup-service.test.ts app/features/account-sync/services/account-event-bootstrap-service.test.ts app/features/messaging/hooks/use-conversation-messages.integration.test.ts`
- `.\node_modules\.bin\vitest.CMD run app/features/messaging/hooks/use-conversation-messages.integration.test.ts` (from `apps/pwa`, 16/16 passing)
- `.\node_modules\.bin\vitest.CMD run app/features/messaging/hooks/use-conversation-messages.integration.test.ts` (from `apps/pwa`, 17/17 passing after malformed-timestamp sparse-window fix)
- `.\node_modules\.bin\vitest.CMD run app/features/messaging/hooks/use-conversation-messages.integration.test.ts` (from `apps/pwa`, 18/18 passing after hidden voice-call-signal row suppression)
- `.\node_modules\.bin\tsc.CMD --noEmit --pretty false` (from `apps/pwa`, passing)
- `.\node_modules\.bin\vitest.CMD run app/components/app-shell.test.tsx app/components/mobile-tab-bar.test.tsx` (from `apps/pwa`, 14/14 passing)

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
- `apps/pwa/app/features/account-sync/services/encrypted-account-backup-service.ts`
- `apps/pwa/app/features/account-sync/services/encrypted-account-backup-service.test.ts`
- `docs/handoffs/current-session.md`

## Open Risks Or Blockers

- Two-account runtime verification is still required to confirm deleted historical messages do not reappear as command JSON junk after login + account-sync restore completes.
- If junk rows still appear after this boundary hardening, the next likely owner is non-canonical message persistence/import outside encrypted backup parse/merge/hydrate paths.
- `apps/pwa` typecheck currently has unrelated pre-existing failures in `app/features/messaging/hooks/use-conversation-messages.ts` (`readonly reverse` + implicit `any`) that were not introduced by this fix.
- Initial sparse-window auto-scan is bounded to twelve earlier-page passes; extremely command-heavy histories beyond that bound can still require manual `Load More`.
- If runtime still shows `Load More` on a blank timeline after this fix, capture `messaging.conversation_hydration_diagnostics` with indexed/projection counts to confirm whether non-displayable rows are coming from a different owner path.
- If runtime still shows blank+`Load More`, check for `messaging.message_list_virtualizer_recovery_attempt` events to confirm virtualizer-level recovery is triggering; if not, capture DOM/scroll metrics for `parentRef` sizing.
- Sidebar/page navigation behavior still needs runtime replay in desktop/PWA to confirm route taps remain responsive under load and during long chat sessions.

## Next Atomic Step

Create and push the v1.3.7 release commit/tag, then capture a concise offline-first UI architecture plan for component and asset loading boundaries.




































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
<!-- CONTEXT_CHECKPOINTS_END -->
