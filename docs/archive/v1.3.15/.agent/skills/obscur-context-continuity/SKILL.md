---
name: obscur-context-continuity
description: Preserve progress across Codex context-window limits by maintaining a canonical, file-backed session handoff in this repository. Use when starting work, resuming work, checkpointing progress, or closing a thread for any multi-step engineering task.
---

# Obscur Context Continuity

Follow this skill whenever work may exceed one thread.

## Required Inputs

1. `AGENTS.md`
2. `docs/08-maintainer-playbook.md`
3. `docs/handoffs/current-session.md`
4. `.agent/workflows/context-continuity.md`

## Execution Rules

1. Start each substantial task by reading `docs/handoffs/current-session.md`.
2. Treat `docs/handoffs/current-session.md` as canonical state, not chat memory.
3. Write a checkpoint whenever architecture decisions, evidence, or blockers change.
4. End each thread with one final checkpoint and one explicit next atomic step.
5. If context pressure appears, checkpoint immediately before continuing.

## Checkpoint Minimum Contract

Each checkpoint records:

1. summary of changes,
2. evidence (tests, typecheck, runtime checks),
3. remaining uncertainty or risk,
4. exact next atomic step.

## Quick Commands

1. `pnpm context:handoff:init`
2. `pnpm context:checkpoint -- --summary "..." --next "..."`
3. `pnpm context:handoff:show`
