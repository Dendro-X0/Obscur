# Context Continuity Workflow

Use when work may span multiple agent threads or when context pressure is rising.

**Skill:** [obscur-context-continuity](../skills/obscur-context-continuity/SKILL.md)  
**Pre-diff:** [obscur-session-gate](../skills/obscur-session-gate/SKILL.md)

## Canonical sources

1. [`docs/START-HERE.md`](../../docs/START-HERE.md)
2. [`docs/handoffs/current-session.md`](../../docs/handoffs/current-session.md)
3. [`AGENTS.md`](../../AGENTS.md)

Do not treat chat history as the canonical source of project state. Do not boot from `docs/archive/**`.

## Step 1: Resume safely

1. Read canonical sources in order.
2. Confirm the current objective and **next atomic step** from the handoff.
3. Post session header ([plan-execution-checklist.md](./plan-execution-checklist.md)) before scanning unrelated files.

## Step 2: Record checkpoints during work

Create a checkpoint in `docs/handoffs/current-session.md` when:

1. ownership or architecture decision changed,
2. files were edited across more than one feature boundary,
3. tests/typecheck produced new pass/fail evidence,
4. blockers were found,
5. thread close is expected soon.

If context pressure is high or interruption is likely:

1. `pnpm context:rescue -- --summary "..." --next "..."`
2. Resume from latest `.artifacts/context-rescue/*` bundle if the thread is interrupted.

Each checkpoint must include: what changed, evidence gathered, what remains uncertain, exact next atomic step.

## Step 3: Close the thread deliberately

Before ending:

1. refresh `Last Updated`,
2. set `Session Status`,
3. update `Next Atomic Step` (one item),
4. append one final checkpoint.

## Step 4: Bootstrap the next thread

```text
Read docs/START-HERE.md and docs/handoffs/current-session.md.
Run obscur-session-gate — quote Next Atomic Step before any edit.
Keep edits scoped to that step; update handoff before finishing.
```
