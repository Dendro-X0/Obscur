# Issue Status Ledger (Pre-Launch)

Last updated: 2026-04-03

This file tracks active runtime blockers and pre-launch risk status.

## Current Status

- Active release blockers: 1.
- Known unresolved issues: 1.
- Scroll-stability regression in heavy conversations is currently unresolved and remains release-blocking.

## Pre-Launch Health Snapshot

- Navigation stability: fixed and stable under route switching stress.
- Realtime voice continuity across page switches: fixed.
- Voice call status visibility outside chat route: fixed.
- Off-chat incoming message notifications + subtle alert tone: fixed.
- Sync and restore monitoring hooks: active.
- Release workflow + version alignment contracts: passing, but release is blocked by unresolved message-list scroll stability.

## Open Incidents

### INC-2026-04-03-MSG-SCROLL-JUMP (Release Blocker)

- Severity: high (core messaging usability degradation).
- Affected runtime(s): Desktop confirmed; PWA risk not yet ruled out for comparable heavy histories.
- Owner lane: messaging message-list scroll stability.
- Status: unresolved, documented, and escalated for triage-only continuation.

Observed behavior:

- During heavy-conversation startup/backfill (especially mixed dynamic-height content), the chat viewport and scrollbar progress can jump unexpectedly while the user is actively scrolling.
- The issue can interrupt reading position and causes repeated loss of scroll intent.

Reproduction (current known pattern):

1. Open a DM/community conversation with large history and mixed-height rows (media + text).
2. Start scrolling upward while replay/backfill or dynamic measurement settling is still active.
3. Observe abrupt downward jump or scrollbar progress displacement.

Current evidence surfaces:

- Runtime diagnostics:
  - `window.obscurMessageListScrollDebug.printTimeline(400)`
  - `window.obscurMessageListScrollDebug.captureTimelineJson(400)`
- Recent implementation/test evidence is tracked in `docs/handoffs/current-session.md`.

User-facing truth statement:

- Messaging scroll behavior is currently known to be unstable for some heavy-history conversations.
- This is an unresolved product limitation and remains a release blocker until runtime behavior is consistently stable.

## Verification Basis

- Manual multi-device verification on desktop + web.
- Focused regression suites for recent critical fixes.
- Release gates passing in CI and local preflight checks:
  - `pnpm version:check`
  - `pnpm docs:check`
  - `pnpm release:integrity-check`
  - `pnpm release:artifact-version-contract-check`
  - `pnpm release:ci-signal-check`
  - `pnpm release:test-pack`
  - `pnpm release:preflight`

## Monitoring Policy

If a new issue is discovered:

1. Add it under a new "Open Incidents" section in this file.
2. Record:
   - exact reproduction steps,
   - observed logs/event names,
   - affected runtime(s) (PWA/Desktop/Mobile),
   - severity and rollback risk.
3. Link the implementing fix commit and regression test before closing.

For this active incident:

1. Do not mark resolved from test-only evidence.
2. Resolution requires desktop runtime replay confirmation on heavy conversations.
3. Keep release gate blocked until runtime evidence shows stable scrolling behavior.

## Source of Historical Context

- Release-by-release implementation history: `CHANGELOG.md`
- Canonical operational and triage runbooks: `docs/07-operations-and-release-flow.md`, `docs/08-maintainer-playbook.md`
- Active roadmap: `docs/roadmap/current-roadmap.md`
