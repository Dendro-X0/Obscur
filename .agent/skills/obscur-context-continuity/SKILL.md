---
name: obscur-context-continuity
description: Obscur handoff and checkpoint discipline. Use when starting, resuming, checkpointing, or closing Obscur sessions; when context limits approach; or when updating docs/handoffs/current-session.md. Requires obscur-session-gate before any diff. Do NOT use for greenfield repos without handoff or read-only architecture questions.
---

# Obscur Context Continuity

Progress lives in files, not chat. Run [obscur-session-gate](../obscur-session-gate/SKILL.md) before any code edit.

## Required inputs (read order)

1. [`docs/START-HERE.md`](../../../docs/START-HERE.md)
2. [`docs/handoffs/current-session.md`](../../../docs/handoffs/current-session.md) → **Next Atomic Step only**
3. [`AGENTS.md`](../../../AGENTS.md) — if policy ambiguity
4. [plan-execution-checklist.md](../../workflows/plan-execution-checklist.md) — before any diff
5. [context-continuity.md](../../workflows/context-continuity.md)

Global: `~/.cursor/skills/backend-rigor/` (execution-checklist, maintainer-session)

## Execution rules

1. Post session header from **obscur-session-gate** before coding.
2. Treat `docs/handoffs/current-session.md` as canonical queue — not chat memory.
3. **Refuse** diffs that conflict with PAUSED/CANCELLED bands until handoff updated.
4. Checkpoint when decisions, evidence, or blockers change.
5. End thread with evidence paths, **one** next atomic step, and proof layers named.

## Checkpoint minimum contract

Each checkpoint records:

1. summary of changes,
2. evidence (L1–L4 commands, capture paths),
3. remaining uncertainty or risk,
4. exact next atomic step.

## Anti-rationalization

| Agent thought | Response |
|---------------|----------|
| "I'll update handoff at the end if I remember" | Update before thread close — mandatory |
| "Chat summary is enough for next session" | Handoff is canonical |
| "Checkpoint is overhead for tiny fix" | Required when evidence or blockers change |

## Quick commands

1. `pnpm context:handoff:init`
2. `pnpm context:checkpoint -- --summary "..." --next "..."`
3. `pnpm context:handoff:show`
4. `pnpm context:rescue -- --summary "..." --next "..."` — when context pressure is high

## Bootstrap prompt (next thread)

```text
Read docs/START-HERE.md and docs/handoffs/current-session.md.
Run obscur-session-gate — quote Next Atomic Step before any edit.
Resume from that step only; update handoff before finishing.
```
