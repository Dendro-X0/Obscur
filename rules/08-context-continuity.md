# 08 — Context Continuity

1. **Canonical continuity state lives in files, not chat history.**
   - Always use `docs/handoffs/current-session.md` as the single source of ongoing progress.

2. **Start every substantial thread with continuity replay.**
   - Read `AGENTS.md`, `docs/encyclopedia/08-maintainer-playbook.md`, and `docs/handoffs/current-session.md` first.
   - Resume from **Next Atomic Step** before broad re-exploration.

3. **Checkpoint progress whenever runtime truth changes.**
   - Required checkpoint triggers:
     - owner/contract decision changed,
     - new evidence from tests/typecheck/runtime diagnostics,
     - blocker discovered or unresolved risk changed,
     - thread close is likely.
   - Use `pnpm context:checkpoint -- --summary "..." --next "..."` when possible.

4. **Close every substantial thread with a durable handoff.**
   - Update `Last Updated`, `Session Status`, `Open Risks Or Blockers`, and `Next Atomic Step`.
   - Append one final checkpoint entry before ending the thread.

5. **Continuity workflow and skill are mandatory references.**
   - Workflow: `.agent/workflows/context-continuity.md`
   - Skill: `.agent/skills/obscur-context-continuity/SKILL.md`
