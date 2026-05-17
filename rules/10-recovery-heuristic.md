# 10 — Recovery Heuristic

When a core flow is broken:

1. identify the canonical owner,
2. list all parallel paths touching that state,
3. remove or isolate non-canonical mutations,
4. add diagnostics at the canonical boundary,
5. only then repair the product behavior.

**Skill:** `.agent/skills/obscur-foundation-recovery/SKILL.md`
