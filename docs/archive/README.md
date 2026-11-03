# Archive — do not use for daily work

**This folder is not the active documentation tree.**

Superseded plans, discontinued designs, and version-stamped copies live here. Agents and humans must **not** treat archive material as current product truth.

**Historical source code:** use git tag [`v1.3.15`](https://github.com/Dendro-X0/Obscur/releases/tag/v1.3.15) — the in-repo snapshot under `docs/archive/v1.3.15/` was **removed 2026-06-18** (no longer maintained; current tree is authoritative).

---

## What belongs in archive

| Subfolder | Purpose |
|-----------|---------|
| [`consolidated/`](./consolidated/) | Superseded version plans merged at closeout |
| [`greenfield/`](./greenfield/) | Discontinued Greenfield design — intent reference only |
| [`handoffs/`](./handoffs/) | Old handoff snapshots |
| [`program/`](./program/) | Old program docs moved at closeout |
| [`program/inactive-2026-06/`](./program/inactive-2026-06/) | **2026-06-17** — ~115 superseded `docs/program/` files |
| [`rewrite-shelf/`](./rewrite-shelf/) | Legacy rewrite notes |
| [`versioned/`](./versioned/) | Version-stamped doc copies |
| [`program/inactive-2026-11/`](./program/inactive-2026-11/) | **2026-11** — rewrite-band docs/specs declutter Wave 1 |
| [`demo/`](./demo/) | Pre-v2.0.0 presenter/GIF version shelves |
| [`releases-pre-v1.9/`](./releases-pre-v1.9/) | **2026-11 Wave 3** — release notes ≤ v1.8 |
| [`encyclopedia-historical-2026-11/`](./encyclopedia-historical-2026-11/) | **2026-11 Wave 3** — encyclopedia 11 / 16 / 17 |

---

## Active docs live outside archive

Start at [../START-HERE.md](../START-HERE.md) → [../handoffs/current-session.md](../handoffs/current-session.md).  
Current demo kit: [../assets/demo/v2.0.0/](../assets/demo/v2.0.0/). Specs index: [../../specs/README.md](../../specs/README.md).

`pnpm docs:check` **skips** `docs/archive/` when validating links — broken links inside archive are acceptable.

---

## If you need historical context

1. Read the **active** spec in `docs/program/` or register for your topic.
2. For old **code** behavior, use `git show v1.3.15:<path>` or the GitHub release tag — not deleted snapshots.
3. Search archive **after** the active handoff — cite as historical only.
