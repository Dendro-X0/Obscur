# Regression Playbooks

_Last reviewed: 2026-03-14 (baseline commit ab08104)._


This document provides quick diagnosis paths for common regressions.

## 1) Chat Scroll Lag / Jank

Likely files:

- `apps/pwa/app/features/messaging/components/message-list.tsx`
- `apps/pwa/app/features/messaging/hooks/use-conversation-messages.ts`
- `apps/pwa/app/features/messaging/lib/performance-monitor.ts`

Checks:

1. confirm `chatPerformanceV2` state.
2. inspect pending event backlog (`pendingEventCount`).
3. profile rerenders in message row path.
4. compare behavior in `next dev` vs production start.

## 2) Missing / Duplicate Messages

Likely files:

- `.../messaging/services/message-bus.ts`
- `.../messaging/hooks/use-conversation-messages.ts`
- `.../messaging/services/message-persistence-service.ts`

Checks:

1. verify id stability and dedupe behavior.
2. verify delete/update ordering in same flush window.
3. verify persistence flush on hidden/unload paths.

## 3) Group Message Rejections / Scope Mismatch

Likely files:

- `.../groups/hooks/use-sealed-community.ts`
- `.../relays/providers/relay-provider.tsx`

Checks:

1. confirm scoped relay URL normalization.
2. confirm event relay URL matches expected scope.
3. confirm community binding tags (`h`/`d`) match group id.

## 4) Media Upload / Playback Failures

Likely files:

- `.../messaging/lib/nip96-upload-service.ts`
- `.../messaging/lib/upload-service.ts`
- `.../messaging/lib/media-upload-policy.ts`
- `.../messaging/components/audio-player.tsx`
- `.../messaging/components/video-player.tsx`

Checks:

1. validate file size/type policy.
2. inspect provider fallback sequence.
3. verify attachment kind inference in message rendering.

## 5) Settings Flag Not Taking Effect

Likely files:

- `.../settings/services/privacy-settings-service.ts`
- consumers in messaging/groups hooks/components

Checks:

1. ensure save writes expected localStorage key.
2. ensure `privacy-settings-changed` event is emitted.
3. ensure consumers subscribe and refresh state.

## 6) Identity / Lock / Session Issues

Likely files:

- `.../auth/hooks/use-identity.ts`
- `.../auth/services/pin-lock-service.ts`
- `.../auth/services/session-api.ts`

Checks:

1. verify stored identity hydration path.
2. verify lock/unlock transitions.
3. verify desktop/native session handoff behavior.

## 7) Ghost Users / Communities / Sybil-Like Spam

Likely files:

- `.../network/services/identity-integrity-migration.ts`
- `.../messaging/controllers/enhanced-dm-controller.ts`
- `.../groups/hooks/use-sealed-community.ts`
- `.../messaging/controllers/incoming-dm-event-handler.ts`

Checks:

1. verify v0.8.5 integrity migration ran (`obscur:integrity-migration:v085:done:*` localStorage key).
2. inspect backup snapshot (`obscur:integrity-migration:v085:backup:*`) before manual repair attempts.
3. verify connection/join suppressions are returning deterministic reason codes (pending/cooldown/block).
4. verify malformed inbound events are quarantined and not creating visible chats/groups.
5. review abuse counters in dev diagnostics (request/join suppressed, quarantined malformed, deduped entries).

## 8) Minimum Repro Template

When filing regression issues, include:

1. app/runtime (`pwa dev`, `pwa prod`, desktop).
2. feature flag state (`chatPerformanceV2`).
3. exact steps and expected vs actual behavior.
4. logs/stack traces and affected file references.
5. commit hash or release tag.

## 9) Open Deferred Issue: Desktop Auth Overlay Background Blocking

Issue ID: `DESK-AUTH-OVERLAY-001`

Status: deferred, reproducible in desktop dev runtime.

Observed behavior:

1. During auth/onboarding, a fullscreen overlay/background layer is mounted.
2. Visual login card is centered, but surrounding fullscreen area becomes non-interactive/blocked.
3. Attempted custom auth "window-in-window" controls did not remove the underlying fullscreen overlay behavior.

Current scope decision:

1. Revert to prior auth flow behavior for now.
2. Track as a dedicated desktop-shell/auth-layering task instead of patching ad hoc in release-critical work.

Likely files for next deep fix:

1. `apps/pwa/app/features/auth/components/auth-screen.tsx`
2. `apps/pwa/app/features/auth/components/auth-gateway.tsx`
3. `apps/pwa/app/layout.tsx`
4. `apps/pwa/app/components/desktop/title-bar.tsx`
5. `apps/desktop/src-tauri/src/lib.rs` (window behavior/lifecycle)

## 10) Path B v1 Cross-Device Account Sync Manual Gate (Phase 2)

Scope:

1. `contacts + DMs` convergence across desktop and web guest/new-device sessions.
2. Startup gating (`projection_ready`) and single transport-owner invariants.
3. Regression guard for `accepted -> stranger`, timeline loss, and render-loop failures.

Preflight:

1. Run `pnpm release:test-pack` and keep the output artifact/log.
2. Prepare two test accounts (`A`, `B`) with at least 20 historical DMs and an already accepted contact relationship.
3. Use one desktop window for `A` and one Chrome Guest window for `B` (new guest profile for each cycle).

Runbook:

1. Start `A` on desktop and log in.
2. Confirm startup evidence in logs:
`runtime.activation.complete` with `resultPhase=ready`, `accountProjectionReady=true`, `projectionPhase=ready`, `projectionStatus=ready`.
3. Confirm transport-owner invariant evidence:
`runtime.activation.transport_owner_invariant` and `messaging.transport.runtime_invariant` with `activeIncomingOwnerCount=1` and `activeQueueProcessorCount=1`.
4. Start `B` in Chrome Guest and log in.
5. Confirm projection/bootstrap evidence on `B`:
`account_projection.replay_complete` (or `account_projection.bootstrap_import` followed by replay), then `runtime.activation.complete` with ready projection context.
6. Verify `B` shows `A` as accepted contact (not pending stranger) without manual re-accept.
7. Open the `A<->B` conversation on `B` and verify historical timeline is present (not empty-only-new-messages).
8. Send `B -> A` DM and verify near-real-time delivery on `A`.
9. Send `A -> B` DM and verify near-real-time delivery on `B`.
10. Close the Guest window, open a brand-new Guest window, log in as `B`, and repeat steps 5-9 for 3 consecutive cycles.
11. During all cycles, confirm no fatal UI loop errors:
absence of repeated `Maximum update depth exceeded`.
12. During all cycles, confirm no unrecovered startup degradation:
absence of terminal `account_sync_degraded` runtime state after activation settles.

Pass criteria:

1. `accepted -> stranger` regression count is `0` across all 3 new-device cycles.
2. Historical DM timeline remains available after each new-device login.
3. Bidirectional DM delivery works in each cycle without manual contact-state repair.
4. Runtime activation reaches projection-ready with single-owner invariant (`1/1`) each cycle.

Failure signatures to capture:

1. Contact regresses to pending/stranger after login.
2. Historical chat disappears while new DMs still deliver.
3. Runtime does not recover from activation-time relay/account-sync degradation.
4. Repeated `Maximum update depth exceeded` or equivalent render-loop trace.
5. Projection ingest errors (`account_projection.append_events_failed` / `account_projection.append_events_unavailable`) in real runtime.

Required evidence bundle per failed run:

1. Exact step number and cycle number where failure occurred.
2. `runtime.activation.*`, `account_projection.*`, and `messaging.transport.sync_*` log lines around failure window.
3. `runtime.activation.transport_owner_invariant` and `messaging.transport.runtime_invariant` lines for same window.
4. Screenshot of contact state and conversation timeline immediately after failure.
5. Account IDs used (`A`, `B` pubkey suffixes) and runtime surfaces (`desktop`, `web guest`).
