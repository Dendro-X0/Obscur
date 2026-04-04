# Context Continuity Workflow

Use this workflow when work may span multiple Codex threads or when context pressure is rising.

## Canonical Sources

1. `AGENTS.md`
2. `docs/08-maintainer-playbook.md`
3. `docs/handoffs/current-session.md`

Do not treat chat history as the canonical source of project state.

## Step 1: Resume Safely

1. Read canonical sources in order.
2. Confirm the current objective and next atomic step from `docs/handoffs/current-session.md`.
3. Continue from that step before scanning unrelated files.

## Step 2: Record Checkpoints During Work

Create a checkpoint in `docs/handoffs/current-session.md` whenever one of these happens:

1. ownership or architecture decision changed,
2. files were edited across more than one feature boundary,
3. tests/typecheck produced new pass/fail evidence,
4. blockers were found,
5. thread close is expected soon.

Each checkpoint must include:

1. what changed,
2. what evidence was gathered,
3. what remains uncertain,
4. the exact next atomic step.

## Step 3: Close the Thread Deliberately

Before ending a thread:

1. refresh `Last Updated`,
2. set `Session Status`,
3. update `Next Atomic Step`,
4. append one final checkpoint.

## Step 4: Bootstrap the Next Thread

Use this prompt template:

```text
Read AGENTS.md, docs/08-maintainer-playbook.md, and docs/handoffs/current-session.md.
Resume from the Next Atomic Step exactly.
Keep edits scoped to that step and update docs/handoffs/current-session.md before finishing.
```
