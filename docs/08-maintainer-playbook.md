# 08 Maintainer Playbook and Continuation Handoff

_Last reviewed: 2026-03-29 (baseline commit cad5779e)._

This is the canonical handoff runbook for restarting work safely in a fragile codebase.

## Purpose

1. Resume work without relying on version-specific docs.
2. Keep architecture-safe execution under ongoing feature expansion.
3. Ensure regressions are captured before they are "fixed" by new layering.

## Context Continuity Contract

Use `docs/handoffs/current-session.md` as the canonical state across Codex threads.

1. Start thread:
: read `AGENTS.md`, this playbook, and `docs/handoffs/current-session.md`.
2. During thread:
: checkpoint when owner decisions, evidence, or blockers change.
3. End thread:
: update `Next Atomic Step` and append one final checkpoint.

Helper commands:
1. `pnpm context:handoff:init`
2. `pnpm context:checkpoint -- --summary "..." --next "..."`
3. `pnpm context:handoff:show`
4. `pnpm context:rescue -- --summary "..." --next "..."`

### Context Pressure Emergency Routine

When context window pressure rises above ~70% or interruption looks likely:

1. run `pnpm context:rescue -- --summary "..." --next "..."` immediately,
2. continue work only after the rescue bundle path is printed,
3. if interruption happens, resume from:
: `docs/handoffs/current-session.md`
: latest `.artifacts/context-rescue/*/manifest.json`
: latest `.artifacts/context-rescue/*/git-diff.patch`

## Current Health Snapshot

As of 2026-03-29:
1. project health is stable,
2. no unresolved severe blocker is currently identified,
3. risk remains concentrated in startup lifecycle, cross-device sync, community membership convergence, and realtime voice timing.

## Resume Checklist (Always First)

1. `pnpm install`
2. `pnpm docs:check`
3. `pnpm version:check`
4. `pnpm release:test-pack -- --skip-preflight`
5. verify active owner boundaries in:
: `docs/12-core-architecture-truth-map.md`
: `docs/14-module-owner-index.md`

## Default Recovery Heuristic

When a core flow breaks:

1. identify canonical owner,
2. list all parallel mutations,
3. remove or isolate non-canonical mutation paths,
4. add diagnostics at canonical boundary,
5. repair behavior after ownership is clear.

## One-Copy Diagnostics Captures

Primary capture (preferred):

1. `copy(window.obscurM0Triage?.captureJson(300))`

Fallback bundle:

```js
copy(JSON.stringify({
  runtime: window.obscurWindowRuntime?.getSnapshot?.() ?? null,
  relayRuntime: window.obscurRelayRuntime?.getSnapshot?.() ?? null,
  relayJournal: window.obscurRelayTransportJournal?.getSnapshot?.() ?? null,
  digest: window.obscurAppEvents?.getDigest?.(300) ?? null,
  crossDevice: window.obscurAppEvents?.getCrossDeviceSyncDigest?.(400) ?? null,
}, null, 2));
```

## Canonical Replay Suites

Run these suites before release candidate tags and after high-risk fixes.

### A. Session and Navigation Liveness

1. restart/login continuity on desktop + web,
2. route stress replay:
: `chats -> network -> groups -> settings -> chats`,
3. relay degraded replay with navigation still interactive.

Evidence probes:
1. `window.obscurAppEvents.findByName("auth.auto_unlock_scan", 30)`
2. `window.obscurAppEvents.findByName("navigation.route_settled", 30)`
3. `window.obscurAppEvents.findByName("navigation.route_stall_hard_fallback", 30)`

### B. Cross-Device Sync and History

1. DM outgoing/incoming continuity across two devices,
2. group membership visibility and sendability convergence,
3. media hydration parity after restore.

Evidence probes:
1. `window.obscurAppEvents.getCrossDeviceSyncDigest(400).summary.selfAuthoredDmContinuity`
2. `window.obscurAppEvents.getCrossDeviceSyncDigest(400).summary.membershipSendability`
3. `window.obscurAppEvents.getCrossDeviceSyncDigest(400).summary.mediaHydrationParity`

### C. Message Deletion Convergence

1. delete-for-me replay,
2. delete-for-everyone replay in DM and group,
3. resurrection checks after scroll/reopen/new-message churn.

Evidence probes:
1. `window.obscurAppEvents.findByName("messaging.delete_for_everyone_remote_result", 30)`
2. cross-device digest delete summary slices.

### D. Realtime Voice Reliability

1. invite/cancel/accept/rejoin replay,
2. immediate reinvite after previous call end,
3. cancel-before-accept synchronization replay,
4. long-session connected stability replay.

Evidence probes:
1. `window.obscurAppEvents.findByName("messaging.realtime_voice.session_transition", 40)`
2. `window.obscurAppEvents.findByName("messaging.realtime_voice.connect_timeout_diagnostics", 20)`
3. `window.obscurAppEvents.findByName("messaging.realtime_voice.session_event_ignored", 20)`

### E. Anti-Abuse and Trust Controls

1. incoming request burst/cooldown replay,
2. quarantine summary and reason-code badge verification,
3. strict/standard trust profile behavior replay.

Evidence probes:
1. `window.obscurAppEvents.findByName("messaging.request.incoming_quarantined", 30)`
2. `window.obscurAppEvents.getCrossDeviceSyncDigest(400).summary.incomingRequestAntiAbuse`
3. `window.obscurM10TrustControls?.captureJson?.(400)`

## Required Quality Gates Per High-Risk Change

1. focused touched-owner tests,
2. `pnpm -C apps/pwa exec tsc --noEmit --pretty false`,
3. `pnpm docs:check`,
4. release gate set when preparing tag candidates.

## Change Discipline

1. Keep slices narrow and owner-scoped.
2. Do not add hidden singleton state for profile/account scope.
3. Do not claim delivery/sync success from local optimistic UI state.
4. Do not add a second lifecycle owner to "quick-fix" races.
5. If diagnostics are missing, add diagnostics before behavior changes.

## Documentation Discipline

When architecture or runtime behavior meaningfully changes:

1. update canonical docs in the same change set,
2. keep milestone/release outcomes in general docs,
3. keep archive docs audit-only,
4. update `CHANGELOG.md` and `ISSUES.md` truthfully.

## Escalation Triggers

Pause feature expansion and switch to recovery mode if any of these appear:

1. startup infinite loading or unrecoverable auth lock loop,
2. route freeze/blank-page regression class,
3. recurring self-authored DM history loss after restore,
4. community membership/sendability divergence after account switch,
5. realtime voice sessions repeatedly timing out in nominal network conditions.

When triggered:
1. capture one-copy diagnostics,
2. map to canonical owner,
3. patch owner path,
4. replay the relevant suite before resuming expansion.
