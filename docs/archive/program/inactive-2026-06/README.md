# Inactive program docs (archived 2026-06-17)

**Not current truth.** Moved during `/docs` consolidation so `docs/program/` holds only **28 active files**.

---

## Why these were archived

| Category | Examples | Superseded by |
|----------|----------|----------------|
| Old scope files | `v1.5.*`–`v1.9.9` scopes | [v1.9.10-scope.md](../../../program/v1.9.10-scope.md) + [CURRENT.md](../../../CURRENT.md) |
| Duplicate community specs | R1–R6 atomic join, roster, relay binding | [community-relaunch-decision-2026-06.md](../../../program/community-relaunch-decision-2026-06.md) (band **paused**) |
| Superseded roadmaps | `current-roadmap.md`, `v2.0-resumption-charter.md` | [v1.9.x-execution-contract.md](../../../program/v1.9.x-execution-contract.md) |
| Landed phase gates | `phase1-desktop-shell-gate.md`, Path B bands | Kernel manifests + verify scripts |
| One-off audits | UI relay pool audit, startup investigations | [CURRENT.md](../../../CURRENT.md) transport gap note |

---

## If you need a file from here

1. Confirm it is not restated in [CURRENT.md](../../../CURRENT.md) or an active `program/` doc.
2. Cite as **historical** — do not boot agents from this folder.
3. To revive a spec, copy to `program/` only with a new handoff charter — do not link from daily docs by default.

`pnpm docs:check` does not validate links inside `docs/archive/`.
