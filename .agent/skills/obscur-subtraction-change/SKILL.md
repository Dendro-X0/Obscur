---
name: obscur-subtraction-change
description: Obscur owner subtraction. Use when changing auth, profiles, runtime lifecycle, relay transport, messaging, account-sync, workspace-kernel, groups, or desktop Tauri paths — or when parallel mutation paths, reconcile/repair/self-heal, or bridge layers are suspected. Requires retiring or quarantining a path before adding adapters. Do NOT use for copy/i18n-only, isolated UI styling, or docs-only bands.
---

# Obscur Subtraction Change

Fix by **removing overlapping owners**, not adding reconcile/repair/bridge layers. Run [obscur-session-gate](../obscur-session-gate/SKILL.md) first.

## When to activate

- Bug class is "two systems write the same state"
- Task adds `reconcile`, `repair`, `self-heal`, `fallback`, or `bridge`
- Membership/roster/directory/ledger may disagree
- New import crosses feature boundaries

## Procedure

1. **Name canonical owner** — one module owns the lifecycle (see [encyclopedia/12-core-architecture-truth-map.md](../../../docs/encyclopedia/12-core-architecture-truth-map.md) when unsure).
2. **List parallel writers** — grep for mutations on the same keys/state (ledger, directory, terminal cache, display repair, hydrate repair, etc.).
3. **Subtraction plan** (write before code):
   - Path to **retire or quarantine**
   - Path that remains canonical
   - Removal criteria ("delete when X test passes")
4. **Implement smallest slice** — canonical path only; no second owner.
5. **Proof** — targeted vitest + typecheck minimum; L3/L4 if runtime claim ([plan-execution-checklist.md](../../workflows/plan-execution-checklist.md)).

## Community band (when un-paused)

Path B contract: **coordination directory = membership authority**; relay = transport; room key = crypto.

While **PAUSED**: no subtraction implementation in `groups/**` — document owners in register only.

## Anti-rationalization

| Agent thought | Response |
|---------------|----------|
| "Add a reconcile to sync the two paths" | Retire one path first |
| "Bridge keeps legacy working" | Quarantine legacy with removal ticket |
| "UI can hide the bad state" | Fix owner boundary, not projection |
| "Self-heal on read is harmless" | Another truth owner — subtract instead |
| "Too risky to delete — wrap it" | Feasibility review if ≥3 failures; not patch #4 |

## Red flags — escalate to feasibility (rules/11)

- Cannot identify single canonical owner after investigation
- Subtraction requires touching PAUSED domain without charter
- Fix needs a third parallel writer

## Output (partial work)

State explicitly:

1. What owner is now canonical
2. What path was retired/quarantined (or blocked on PAUSED)
3. What proof ran vs what still needs L3/L4

## References

- [core-change-checklist.md](../../workflows/core-change-checklist.md)
- [recovery-triage.md](../../workflows/recovery-triage.md)
- [`rules/01-operating-principles.md`](../../../rules/01-operating-principles.md) — one owner, fix by subtraction
