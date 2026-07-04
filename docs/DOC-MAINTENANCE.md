# Documentation maintenance

_Last updated: 2026-06-26_

---

## Principles

1. **One front door:** [CURRENT.md](./CURRENT.md) — then [handoffs/current-session.md](./handoffs/current-session.md).
2. **Small active shelf:** `docs/program/` holds **~28** active files ([program/README.md](./program/README.md)). Superseded docs go to `archive/` — do not duplicate.
3. **Handoff is live state** — not chat history.
4. **Archive is not deleted history** — move with `git mv`; add index README in archive subfolder.

---

## Adding a document

| Step | Action |
|------|--------|
| 1 | Prefer updating [CURRENT.md](./CURRENT.md) or handoff before adding files |
| 2 | If new spec needed → `program/` + link from [program/README.md](./program/README.md) |
| 3 | Supersede old doc → move to `archive/program/inactive-YYYY-MM/` |
| 4 | Run `pnpm docs:check` |

**Transport verify (w0–w68):** all `verify:transport-engine-w*` aliases resolve to `scripts/verify-transport-engine.mjs` (flat gate). Canonical: `pnpm verify:transport-engine-w68`.

Do **not** add loose `.md` at `docs/` root except `README.md`, `START-HERE.md`, `CURRENT.md`, `DOC-MAINTENANCE.md`.

---

## Consolidation (2026-06-17)

~115 redundant `program/` files moved to [archive/program/inactive-2026-06/](./archive/program/inactive-2026-06/README.md). Goal: **readable in minutes**, not weeks.

---

## Session end

1. Update handoff (`Last Updated`, next atomic step).
2. If architecture meaning changed → [CHANGELOG.md](../CHANGELOG.md) + [CURRENT.md](./CURRENT.md) if user-facing truth shifted.
3. `pnpm docs:check`
