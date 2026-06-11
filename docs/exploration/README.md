# Codebase exploration shelf

**Status:** Active research (exploration modules 1–8 complete; synthesis v1 published)  
**Started:** 2026-06-02  
**Purpose:** Record what the monorepo actually is — module by module — before any refactor, amputation, or rewrite decision.

---

## Why this shelf exists

The Obscur monorepo is large (~400+ docs, hundreds of feature files per domain). Canonical docs (`encyclopedia/`, `program/`, truth map) describe **intent**. This shelf records **observed reality** from code + doc cross-checks: owners, parallel paths, test gaps, and conflicts between shelves.

**Not the same as** [`docs/research/`](../research/) — that folder holds **forward-looking** proposals (P2P redesign, CRDT migration). **Exploration** is **as-built audit** and black-box mapping.

---

## How to use

| Audience | Start here |
|----------|------------|
| Human maintainer | [Methodology & synthesis plan](./00-methodology-and-synthesis-plan.md) → module index below |
| Agent / future session | Same + latest module note; **do not implement** from this shelf until synthesis doc exists |

Each module note follows a fixed template (see methodology). Findings are **evidence-backed** (file paths, doc citations, test inventory). Speculation is labeled **Hypothesis**.

---

## Module index

| # | Module | Status | Document |
|---|--------|--------|----------|
| 0 | Methodology & synthesis plan | Done | [00-methodology-and-synthesis-plan.md](./00-methodology-and-synthesis-plan.md) |
| 1 | Community / groups | **Done (v1)** | [modules/01-community-groups.md](./modules/01-community-groups.md) |
| 2 | Messaging (DM) | **Done (v1)** | [modules/02-messaging-dm.md](./modules/02-messaging-dm.md) |
| 3 | Account sync & backup restore | **Done (v1)** | [modules/03-account-sync-backup-restore.md](./modules/03-account-sync-backup-restore.md) |
| 4 | Profiles & multi-window scope | **Done (v1)** | [modules/04-profiles-multi-window-scope.md](./modules/04-profiles-multi-window-scope.md) |
| 5 | Relays & transport | **Done (v1)** | [modules/05-relays-transport.md](./modules/05-relays-transport.md) |
| 6 | Coordination / Path B workspace | **Done (v1)** | [modules/06-coordination-path-b-workspace.md](./modules/06-coordination-path-b-workspace.md) |
| 7 | Runtime, shell, startup | **Done (v1)** | [modules/07-runtime-shell-startup.md](./modules/07-runtime-shell-startup.md) |
| 8 | Native SQLite & persistence policy | **Done (v1)** | [modules/08-native-sqlite-persistence-policy.md](./modules/08-native-sqlite-persistence-policy.md) |

**v1** = first pass complete enough to inform synthesis; not a claim of exhaustive line-by-line audit.

---

## Eventual deliverable

When modules **1–8** reach v1 (or a maintainer calls synthesis early), produce:

**[Synthesis: as-built architecture & fork options](./synthesis/as-built-architecture-and-fork-options.md)** — **v1 complete** (2026-06-02)

That doc will merge module notes into: owner multiplicity map, doc-vs-code gaps, test gate map, and the three product forks (Path A DM-only, Path B coordination workspace, incremental collapse).

---

## Conventions

- **English** only (project rule).
- **No implementation tasks** in module notes — only findings, gaps, and questions for synthesis.
- Link canonical docs when contradicting them; do not silently overwrite encyclopedia claims.
- Date and note git context loosely (`Last reviewed`); exact SHA optional per module.

---

## Related canonical docs

- [Design goals and constraints](../program/design-goals-and-constraints.md)
- [Core architecture truth map](../encyclopedia/12-core-architecture-truth-map.md)
- [Community fork decision](../program/community-fork-decision-2026-05.md)
- [Native SQLite policy](../program/obscur-native-sqlite-policy.md)
