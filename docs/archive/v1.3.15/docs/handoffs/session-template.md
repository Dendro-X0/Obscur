# Session Handoff Template

Use this template to create or reset `docs/handoffs/current-session.md`.

## Rules

1. Keep this file concise and factual.
2. Treat it as canonical continuity state across threads.
3. Update it before ending each substantive Codex thread.

## Template

````md
# Current Session Handoff

- Last Updated (UTC): YYYY-MM-DDTHH:MM:SSZ
- Session Status: in-progress
- Active Owner: <module/feature owner>

## Active Objective

<single clear objective>

## Current Snapshot

- What is true now:
- What changed in this thread:

## Evidence

- Command/Test: result

## Changed Files

- path/to/file

## Open Risks Or Blockers

- <risk or blocker>

## Next Atomic Step

<single concrete next action>

## Next Thread Bootstrap Prompt

```text
Read AGENTS.md, docs/08-maintainer-playbook.md, and docs/handoffs/current-session.md.
Resume from the Next Atomic Step exactly.
Keep edits scoped to that step and update docs/handoffs/current-session.md before finishing.
```

## Checkpoints

<!-- CONTEXT_CHECKPOINTS_START -->
### YYYY-MM-DDTHH:MM:SSZ checkpoint
- Summary:
- Evidence:
- Uncertainty:
- Next:
<!-- CONTEXT_CHECKPOINTS_END -->
````
