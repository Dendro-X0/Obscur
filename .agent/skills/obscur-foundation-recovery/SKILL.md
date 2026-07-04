---
name: obscur-foundation-recovery
description: Obscur core-flow recovery triage. Use when identity, profile isolation, runtime lifecycle, relay transport, requests, DM, sync, or desktop Tauri flows are broken — logs and unit tests insufficient. Classifies failure, traces one user action, repairs lifecycle before UI. Requires obscur-session-gate and obscur-subtraction-change when parallel paths found. Do NOT use for community membership patches while band PAUSED or for UI-only polish.
---

# Obscur Foundation Recovery

Core maintenance when runtime drift is a real risk. **Community `groups/**` is PAUSED** — triage may document owners; no membership/reconcile patches unless handoff un-pauses.

## Procedure

1. Run [obscur-session-gate](../obscur-session-gate/SKILL.md) — post header before investigation diffs.
2. Classify failure (pick one primary):
   - identity/session ownership
   - profile/window binding
   - runtime lifecycle ordering
   - relay transport/publish scope
   - inbound routing/decrypt
   - local persistence/sync checkpoint
   - UI projection only (last — after transport ruled out)
3. Trace **one user action** end to end: entry → canonical service → network → persistence → UI.
4. If multiple canonical paths appear → apply [obscur-subtraction-change](../obscur-subtraction-change/SKILL.md); that is the bug class.
5. Repair order: lifecycle → transport → persistence → UI projection.
6. Validate: focused vitest + `pnpm exec tsc --noEmit`; L3/L4 if runtime claim.
7. Close via [obscur-context-continuity](../obscur-context-continuity/SKILL.md).

Detailed steps: [recovery-triage.md](../../workflows/recovery-triage.md).

## Boot routing (do not read everything)

Start from [`docs/START-HERE.md`](../../../docs/START-HERE.md). Domain pointers:

| Domain | Read next |
|--------|-----------|
| Architecture owners | [12-core-architecture-truth-map.md](../../../docs/encyclopedia/12-core-architecture-truth-map.md) |
| DM / messaging | [exploration/modules/02-messaging-dm.md](../../../docs/exploration/modules/02-messaging-dm.md) |
| Community (paused) | [community-relay-technical-issues-register-2026-06.md](../../../docs/program/community-relay-technical-issues-register-2026-06.md) |

## Hotspots (read only what the trace needs)

- `apps/pwa/app/features/auth/*`
- `apps/pwa/app/features/runtime/*`
- `apps/pwa/app/features/profiles/*`
- `apps/pwa/app/features/relays/*`
- `apps/pwa/app/features/messaging/*`
- `apps/pwa/app/features/account-sync/*`
- `apps/pwa/app/features/workspace-kernel/*`
- `apps/desktop/src-tauri/src/*`

## Anti-rationalization

| Agent thought | Response |
|---------------|----------|
| "Start with the UI component" | Rule out lifecycle/transport first |
| "Add logging everywhere" | Diagnostics at canonical boundary only |
| "Sender state looks correct — ship it" | Recipient/network evidence required |
| "Quick reconcile between ledger and directory" | PAUSED or subtract — no third owner |

## Output (partial work)

State explicitly:

- what is provably fixed (with proof commands),
- what is still inferred,
- what blocks release confidence,
- one next atomic step in handoff.

## Working rules (inherited from project policy)

1. Canonical owner named before patch.
2. Sender-local UI state is provisional without recipient evidence.
3. Leave behind: test, diagnostics surface, doc update, or smaller boundary.
4. ≥3 failed iterations on same band → feasibility only ([rules/11](../../../rules/11-feasibility-and-modular-safety.md)).
