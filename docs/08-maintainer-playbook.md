# 08 Maintainer Playbook and Continuation Handoff

_Last reviewed: 2026-03-21 (baseline commit 68cb62f)._

This file is the minimal context needed to resume the project after a pause.

## Current State Snapshot

- Cross-platform beta release pipeline is wired through GitHub Releases.
- Release workflow now supports dynamic publication: desktop/web release verification and manual publish are not blocked by Android lane failures, with explicit Android status evidence in workflow summary.
- Runtime architecture has moved toward explicit ownership and contract-first behavior.
- Docs were intentionally compacted to reduce maintenance overhead and token cost.
- The v0.9.2 constrained-release blocker set was revalidated in v0.9.3 manual acceptance and moved to monitoring in `ISSUES.md`.

## Monitored Risk Areas

See `ISSUES.md` for user-facing status. Engineering focus remains:

1. Cross-device account/session consistency (password/session restore behavior).
2. Direct-message history consistency after device/account synchronization.
3. Relay instability handling under partial outages.
4. Navigation liveness failures (page-transition freezes and sidebar interaction lock).
5. Infinite startup/loading loop recovery.
6. Historical media hydration parity across desktop/web after restore.

v0.9.2 direction lock:
- prioritize account data synchronization reliability as the primary engineering lane before additional feature expansion.
- treat relay-backed auto restore as best-effort and keep a deterministic manual portability fallback available.

relay foundation execution lane:
- follow `docs/15-relay-foundation-hardening-spec.md` phase order.
- do not start relay behavior rewrites before Phase 1 baseline capture is reproducible.

## Deterministic Manual Portability Fallback

When relay evidence is degraded or cross-device restore is incomplete, use Settings `Profile -> Account Sync -> Manual portability`:

1. Export `Portable Bundle` on source device (identity must be unlocked).
2. Transfer the JSON bundle securely.
3. Import `Portable Bundle` on target device while logged into the same account key.

Contracts:
- bundle import is rejected when bundle `publicKeyHex` does not match active account.
- bundle import restores through the canonical backup-apply path and canonical append path (when available).
- portability fallback is local-transfer based and does not claim relay delivery proof.

## Default Recovery Heuristic

When a core flow breaks:

1. Identify canonical owner module.
2. List all parallel code paths mutating the same state.
3. Remove or isolate non-canonical mutations.
4. Add diagnostics at the canonical boundary.
5. Repair behavior only after ownership is clear.

## High-Value Debug Surfaces

- Runtime and app events: `apps/pwa/app/shared/log-app-event.ts`
- Reliability metrics: `apps/pwa/app/shared/reliability-observability.ts`
- Relay observability: `apps/pwa/app/features/relays/services/relay-resilience-observability.ts`
- Messaging diagnostics: `apps/pwa/app/features/messaging/services/delivery-diagnostics-store.ts`
- Cross-device history diagnostics (browser console app events):
: `account_sync.backup_payload_hydration_diagnostics`
: `account_sync.backup_restore_merge_diagnostics`
: `account_sync.backup_restore_apply_diagnostics`
: `messaging.legacy_migration_diagnostics`
: `messaging.conversation_hydration_diagnostics`
: `messaging.conversation_hydration_id_split_detected`
- App-event export helper:
: `window.obscurAppEvents.getRecent(200)`
: `window.obscurAppEvents.findByName("messaging.conversation_hydration_id_split_detected", 20)`
: `window.obscurAppEvents.getDigest(300)` (compact summary when raw logs are too large)
: `window.obscurAppEvents.findByName("auth.auto_unlock_recovered_native_session", 20)` (M1 native-session retry evidence)

### Relay Foundation Baseline Capture

For relay/startup regressions, always capture this compact bundle first:

1. `window.obscurWindowRuntime.getSnapshot()`
2. `window.obscurRelayRuntime.getSnapshot()`
3. `window.obscurRelayTransportJournal.getSnapshot()`
4. `window.obscurAppEvents.getDigest(300)`

Unified capture helper (preferred):
- `window.obscurM0Triage?.capture(300)`
- `copy(window.obscurM0Triage?.captureJson(300))`

Helper location:
- `apps/pwa/app/shared/m0-triage-capture.ts` (installed at app boot in `app/components/providers.tsx`)

Then map symptoms with:
- `docs/13-relay-and-startup-failure-atlas.md`
- `docs/14-module-owner-index.md`

### Cross-Device DM Loss Triage

Capture the following in one A/B reproduction cycle:

1. Source device A before backup publish:
: verify `account_sync.backup_payload_hydration_diagnostics` includes non-zero outgoing counts for affected conversations.
2. Target device B right after restore:
: compare `incoming*` vs `merged*` counts in `account_sync.backup_restore_merge_diagnostics`.
3. Target device B after `CHAT_STATE_REPLACED_EVENT` migration:
: inspect `messaging.legacy_migration_diagnostics` for canonical collisions and incoming-only conversation counts.
4. Target device B when opening affected thread:
: watch for `messaging.conversation_hydration_id_split_detected`; if present, outgoing messages are likely split under sibling conversation IDs.
5. Export raw diagnostics in one step:
: run `window.obscurAppEvents.getRecent(300)` and copy the returned JSON array.
6. If logs are too large to copy:
: run `window.obscurAppEvents.getDigest(300)` and share only that compact object.

## Change Discipline

- Prefer subtraction over compatibility layering.
- Avoid hidden singleton assumptions for profile/account scope.
- Treat sender-local optimistic state as provisional only.
- Keep release claims tied to runtime evidence, not just passing tests.

## Resume Checklist

1. Pull latest `main` and run `pnpm install`.
2. Run `pnpm docs:check`.
3. Run `pnpm ci:scan:pwa:head` before major pushes.
4. Validate target flow in two-user reasoning terms (sender and receiver state).
5. Update `ISSUES.md` and these docs when architecture truth changes.
