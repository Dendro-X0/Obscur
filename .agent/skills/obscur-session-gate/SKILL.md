---
name: obscur-session-gate
description: Obscur pre-diff gate. Use before any code edit in the Obscur monorepo, when the user says continue/resume/fix Obscur, or when touching auth, profiles, messaging, relay, groups, workspace-kernel, or desktop Tauri. Quotes handoff atomic step, honors PAUSED/CANCELLED bands, names L1–L4 proof. Do NOT use for read-only questions, docs-only edits outside forbidden bands, or greenfield repos without handoff.
---

# Obscur Session Gate

**Run before opening an editor.** Pair with global `backend-rigor` and project [plan-execution-checklist.md](../../workflows/plan-execution-checklist.md).

## Boot reads (minimal)

1. [`docs/START-HERE.md`](../../../docs/START-HERE.md)
2. [`docs/handoffs/current-session.md`](../../../docs/handoffs/current-session.md) → **Next Atomic Step only**
3. [`docs/program/v1.9.x-execution-contract.md`](../../../docs/program/v1.9.x-execution-contract.md) — if scope touches product order or forbidden drift

Do not scan `docs/archive/**` or the full encyclopedia unless START-HERE routes you there.

## Procedure

1. Post the session header (below) in the first substantive reply **before any diff**.
2. If the user request conflicts with **Next Atomic Step** or a **PAUSED/CANCELLED** band → **stop. No code.** Report conflict; offer register update or study doc only.
3. Name **canonical owner** and **proof commands** before implementing.
4. On close: update handoff + one checkpoint ([obscur-context-continuity](../obscur-context-continuity/SKILL.md)).

## Mandatory session header

```text
NEXT ATOMIC STEP:     [quote docs/handoffs/current-session.md]
PAUSED / CANCELLED:   [community PAUSED | AUTH-SESSION-1 CANCELLED | …]
CANONICAL OWNER:      [module path]
PROOF BEFORE DONE:    [L1 + L2 + L3/L4 — exact pnpm commands]
OUT OF SCOPE:         [what this session will not touch]
```

## Pre-flight gates

| Gate | Fail → |
|------|--------|
| Handoff atomic step quoted | Stop — read handoff |
| Not PAUSED/CANCELLED domain | Study/register only |
| Not forbidden drift (execution contract) | Stop; cite row |
| Stuck loop ≥3 on same band | Feasibility only ([rules/11](../../../rules/11-feasibility-and-modular-safety.md)) |
| Subtraction before adapter | Rewriting plan before impl ([obscur-subtraction-change](../obscur-subtraction-change/SKILL.md)) |

## Claim language

| May say | Only when |
|---------|-----------|
| Implemented | Phase A gates green for the slice |
| Verified | Matrix Pass or register **A** with evidence link |
| Fixed (runtime) | L3+ on correct surface (Tauri for native) |
| Landed (community) | L4 two-user soak — **not** unit tests alone |

## Anti-rationalization

| Agent thought | Response |
|---------------|----------|
| "User asked for a fix — I'll patch quickly" | Quote handoff first; PAUSED = no code |
| "Tests pass so it's fixed" | Name L-layer; L1 ≠ L3/L4 |
| "Small change doesn't need header" | Header required before every diff |
| "I'll explore the codebase first" | Boot reads only; then header or stop |
| "Community is almost working — one more reconcile" | Band PAUSED; R6 automation first |
| "Handoff is stale — I'll infer intent" | Ask maintainer or study-only; do not infer scope |

## Red flags — stop and report

- User request vs handoff atomic step mismatch
- Touching `groups/**` while community PAUSED
- Resuming AUTH-SESSION-1 without charter
- Fourth patch on same hypothesis without updated investigation spec
- Claiming "fixed" without naming executed proof commands

## References

- [plan-execution-checklist.md](../../workflows/plan-execution-checklist.md) — proof matrix, domain stops
- [core-change-checklist.md](../../workflows/core-change-checklist.md) — during editing
- Global: `~/.cursor/skills/backend-rigor/execution-checklist.md`
