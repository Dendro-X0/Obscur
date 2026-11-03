# Specs — investigation & design shelf

**Not the product front door.** Start at [docs/START-HERE.md](../docs/START-HERE.md) → handoff.

_Last updated: 2026-11-03 · rewrite band_

---

## Layout

| Shelf | Role |
|-------|------|
| [backend/](./backend/) | Backend investigation / design / soak notes (large; search by topic) |
| [frontend/](./frontend/) | UI / shell specs (includes former `docs/frontend-spec-*.md`) |
| [ui/](./ui/) | Thin UI contracts (relays IA, protocols panel, …) |
| [ci/](./ci/) | CI / release-pack investigations |

## How to treat files

| Class | Rule |
|-------|------|
| **Active** | Cited from [docs/handoffs/current-session.md](../docs/handoffs/current-session.md), [docs/CURRENT.md](../docs/CURRENT.md), or a live `docs/program/` charter |
| **Closed / Pass evidence** | Keep in place for citation; do **not** re-open as current work |
| **Wrong / superseded** | `git mv` → `docs/archive/…` or future `specs/archive/…` — never hard-delete |

## Frontend specs (2026-11)

Moved from `docs/` root into [frontend/](./frontend/) so the docs root stays front-door only (`START-HERE` · `CURRENT` · `README` · `DOC-MAINTENANCE`).

## Backend archive (Waves 2+4 — 2026-11)

| Location | Role |
|----------|------|
| [backend/](./backend/) | Active citation closure (~184 `.md`) |
| [archive/backend-inactive-2026-11/](./archive/backend-inactive-2026-11/) | **294** archived one-shots (Wave 2: 216 · Wave 4: +78) |

Further pruning only with a fresh citation closure — never hard-delete.
