---
name: obscur-foundation-recovery
description: Use when working on Obscur core recovery tasks involving identity, profile isolation, runtime lifecycle, relay transport, requests, messaging, or release-risk documentation. Focus on canonical owners, removing overlapping paths, and leaving evidence-backed outcomes.
---

# Obscur Foundation Recovery

Use this skill for core Obscur maintenance work where runtime drift is a real risk.

## When To Use

Trigger this skill when the task involves any of:

- identity import/unlock/restore,
- profile/window isolation,
- desktop multi-window ownership,
- relay publish/subscribe behavior,
- request or DM send/receive,
- sync checkpoints or account rehydrate,
- unreleased v0.9 recovery documentation.

## Working Rules

1. Start by naming the canonical owner of the flow.
2. Look for overlapping legacy/new paths before patching behavior.
3. Treat sender-local UI state as provisional unless recipient/network evidence exists.
4. Prefer contract tightening and path reduction over UI compensation.
5. Leave behind one of:
   - a test,
   - a diagnostics surface,
   - a doc update,
   - a smaller boundary.

## Repository Hotspots

Read only the relevant files first:

- `apps/pwa/app/features/auth/*`
- `apps/pwa/app/features/runtime/*`
- `apps/pwa/app/features/profiles/*`
- `apps/pwa/app/features/relays/*`
- `apps/pwa/app/features/messaging/*`
- `apps/pwa/app/features/account-sync/*`
- `apps/desktop/src-tauri/src/*`
- `docs/37-v0.9x-foundation-recovery-roadmap.md`
- `docs/39-v0.9-r0-architectural-drift-control.md`
- `docs/40-v0.9.0-beta-status-and-recovery-handoff.md`

## Default Execution Loop

1. Classify the bug:
   - lifecycle,
   - ownership,
   - transport,
   - sync,
   - projection.
2. Trace one user action end to end.
3. Identify any duplicate mutation paths.
4. Fix the earliest incorrect boundary.
5. Validate with focused tests and `pnpm.cmd -C apps/pwa exec tsc --noEmit --pretty false`.
6. Update docs/changelog if release truth changed.

## Output Expectations

When the work is partial, explicitly state:

- what is now provably fixed,
- what is still only inferred,
- what still blocks release confidence.

