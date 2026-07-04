# Plan Execution Checklist (Obscur)

**Purpose:** Stop agents from improvising a suboptimal local plan when the maintainer plan already exists in the repo.

**Obscur skills:** [obscur-session-gate](../skills/obscur-session-gate/SKILL.md) · [obscur-subtraction-change](../skills/obscur-subtraction-change/SKILL.md) · [obscur-context-continuity](../skills/obscur-context-continuity/SKILL.md)  
**Global skill:** `~/.cursor/skills/backend-rigor/` — [execution-checklist.md](~/.cursor/skills/backend-rigor/execution-checklist.md), [maintainer-session.md](~/.cursor/skills/backend-rigor/maintainer-session.md), [case-study-obscur.md](~/.cursor/skills/backend-rigor/references/case-study-obscur.md)  
**Process authority:** [docs/program/v1.9.x-execution-contract.md](../../docs/program/v1.9.x-execution-contract.md) · Boot: [docs/START-HERE.md](../../docs/START-HERE.md)

Use this workflow **before every diff** and **before claiming done**. Pair with [core-change-checklist.md](./core-change-checklist.md) (owner/proof detail) and [context-continuity.md](./context-continuity.md) (handoff updates).

---

## Mandatory session header (copy before coding)

```text
NEXT ATOMIC STEP:     [quote docs/handoffs/current-session.md]
CONCENTRATION UNIT:   [e.g. v1.9.8 Phase 4 / SEC-F v2.0f]
PAUSED / CANCELLED:   [community PAUSED | AUTH-SESSION-1 CANCELLED | …]
BAND (if community):  [B0–B5 from back-online roadmap — or NONE if paused]
ISSUE ID:             [COM-RUN-xx | register row | n/a]
OWNER:                [canonical module]
PROOF BEFORE DONE:    [L1 + L2 + L3/L4 commands]
```

**If the user request conflicts with Next Atomic Step or a PAUSED/CANCELLED band → stop. No diff.** Report conflict; offer study doc or register update only.

---

## Pre-flight gates (all must pass)

| Gate | Source | Fail → |
|------|--------|--------|
| Single north star | execution contract § Doc hierarchy | Read handoff; abandon chat-invented plan |
| Not forbidden drift | execution contract § Forbidden drift | Stop; cite row |
| Community touch | handoff + [community-relay-technical-issues-register-2026-06.md](../../docs/program/community-relay-technical-issues-register-2026-06.md) | **No code** if PAUSED |
| Stuck loop ≥3 | rules/11 | Feasibility doc only |
| Subtraction before adapter | back-online B1, rules/01 | Rewriting plan before impl |

---

## Domain stops (2026-06-17 handoff)

| Domain | Status | Agent rule |
|--------|--------|------------|
| Community / `groups/**` | **PAUSED** re-charter | Register + study only |
| AUTH-SESSION-1 / desktop F5 restore | **CANCELLED** | Policy subtraction only if handoff revives |
| SEC-F trust / SE detectors | **Active** | Scope to assessment/copy; not roster |
| v1.9.8 storage Phase 4 | Partial | Manual evidence rows in handoff |

---

## Proof commands (minimum by area)

| Area touched | Minimum before "implemented" | Before "verified" / "fixed" |
|--------------|------------------------------|-----------------------------|
| Pure logic / policy | `pnpm exec tsc --noEmit` + targeted vitest | Same if no runtime claim |
| DM persist / hydrate | `verify:p5-persistence`, `verify:thread-history` | `capture:runtime:native` on reload path |
| Relay / shell | `verify:stability` | `capture:runtime` |
| Community (when un-paused) | `verify:path-b-membership` + invariant bundle | **L4** two-profile NewTest fixture — not vitest alone |
| Trust / SEC-F | `verify:trust-v1.9.5` | Manual runtime per handoff step |

**False-green:** L1/L2 pass + user/runtime bug → L3 required ([testing-and-issue-tracking-spec.md](../../docs/program/testing-and-issue-tracking-spec.md)).

---

## Claim language (execution contract § Communication rules)

| You may say | Only when |
|-------------|-----------|
| Implemented | Phase A gates green for the slice |
| Verified | Matrix Pass or register **A** with link |
| Fixed (runtime) | L3+ evidence on correct surface (Tauri for native) |
| Landed (community patch) | L4 two-user soak recorded — **not** unit tests alone |

**V◐ on roadmap = not agent-complete.** Do not treat partial verify as exit.

---

## Session close (required)

1. `docs/handoffs/current-session.md` — Last Updated, Session Status, Next Atomic Step
2. Register delta if verification changed ([unified-verification-issues-register.md](../../docs/program/unified-verification-issues-register.md))
3. Checkpoint: changed / evidence / uncertain / next step ([context-continuity.md](./context-continuity.md))

---

## One-line rule

**Quote the handoff atomic step and name proof layers before opening an editor — or stop.**
