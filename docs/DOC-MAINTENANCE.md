# Documentation maintenance

_Last updated: 2026-11-03_

---

## Principles

1. **One front door:** [CURRENT.md](./CURRENT.md) — then [handoffs/current-session.md](./handoffs/current-session.md).
2. **Small active shelves:** `docs/program/` for policy/product; `specs/{backend,frontend,ui,ci}/` for investigation/design.
3. **Handoff is live state** — not chat history.
4. **Archive is not deleted history** — move with `git mv`; never hard-delete markdown.
5. **No mass-delete of `docs/`** — platform safety / limitations sheets stay findable.

---

## Adding a document

| Step | Action |
|------|--------|
| 1 | Prefer updating CURRENT / handoff before adding files |
| 2 | Product / policy → `docs/program/` + link from [program/README.md](./program/README.md) |
| 2b | Investigation / design → `specs/backend/` or `specs/frontend/` — **not** `docs/` root |
| 2c | Commercial → `business/` (local) — not `program/` |
| 3 | Supersede → `docs/archive/program/inactive-<YYYY-MM>/` (or `docs/archive/demo/`) |
| 4 | Run `pnpm docs:check` |

Do **not** add loose `.md` at `docs/` root except `README.md`, `START-HERE.md`, `CURRENT.md`, `DOC-MAINTENANCE.md`.

UI specs live under **`specs/frontend/`** (moved from root `frontend-spec-*.md` in 2026-11).

---

## Feature demos

| Shelf | Role |
|-------|------|
| `docs/assets/demo/v2.0.0/` | Current feedback / presenter kit |
| `docs/archive/demo/` | Pre-v2.0.0 version shelves |
| `docs/assets/gifs/` | Silent feature GIFs |

Agents: [program/agent-docs-gif-standard.md](./program/agent-docs-gif-standard.md).

---

## Session end

1. Update handoff (`Last Updated`, next atomic step).
2. If user-facing truth shifted → CURRENT + CHANGELOG as needed.
3. `pnpm docs:check`
