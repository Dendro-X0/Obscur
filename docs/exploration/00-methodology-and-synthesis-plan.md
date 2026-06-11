# Exploration methodology & synthesis plan

_Last reviewed: 2026-06-02 (baseline commit 7f84f813)._

**Status:** Active  
**Last updated:** 2026-06-02

---

## Goal

Turn the monorepo from a **black box** into a **documented as-built map** so fork decisions (ship DM-only, finish Path B, amputate modules, or abandon) are evidence-based — not driven by the latest bug in one flow.

**Explicit non-goals during exploration:**

- No feature implementation
- No “quick fixes” in code
- No updating handoff `Next atomic step` with repair work (unless maintainer separately resumes delivery)

---

## Process (one module at a time)

### Step 1 — Frame the module

- Name bounded directory(ies) under `apps/pwa/app/features/` (+ adjacent routes/packages).
- Read canonical doc rows from truth map / encyclopedia for **stated owners**.
- State the user-visible behaviors the module is supposed to own.

### Step 2 — Map as-built ownership

For each lifecycle concern (send, persist, hydrate, list, delete, membership, etc.):

1. List **all** entry points (file + symbol).
2. Mark which paths production UI actually uses.
3. Mark dead or test-only paths.
4. Note cross-feature imports (messaging ↔ groups ↔ account-sync).

### Step 3 — Cross-check docs

| Question | Sources |
|----------|---------|
| Who does truth map say owns this? | `encyclopedia/12`, `14` |
| What does product/design claim? | `design-goals-and-constraints.md`, fork decision |
| What do incident/spec docs admit? | `encyclopedia/16–19`, handoffs |
| Does CI enforce the claim? | `verify:p5-persistence`, module tests |

Record **conflicts** explicitly (doc says stable / code says multiplicity).

### Step 4 — Test & gate inventory

- What integration tests exist for the failure modes users hit?
- What is **not** gated in CI?
- Compare to adjacent module (e.g. DM hydrate vs group message hydrate).

### Step 5 — Write module note

Use template in [modules/_template.md](./modules/_template.md). Publish as `modules/NN-<name>.md`.

### Step 6 — Queue next module

Update [README.md](./README.md) index. Do not synthesize until enough modules exist or maintainer triggers early synthesis.

---

## Module note template (summary)

Each `modules/*.md` includes:

1. **Scope** — paths, LOC scale, largest files  
2. **Stated contract** — quotes/links from canonical docs  
3. **As-built ownership table** — parallel paths  
4. **Persistence & truth** — stores, authority, known gaps  
5. **Doc vs code conflicts**  
6. **Test coverage** — present / missing  
7. **Hypotheses** — clearly labeled  
8. **Open questions for synthesis**  
9. **References** — code + doc links  

---

## Synthesis plan (future)

**Trigger:** Modules 1–8 at v1, or maintainer request after ≥3 modules if decision is urgent.

**Output file:** `synthesis/as-built-architecture-and-fork-options.md`

**Synthesis sections (draft outline):**

| Section | Inputs |
|---------|--------|
| Executive summary | Module notes 1–8 |
| Product split: what works vs what doesn’t | DM/media/voice vs community |
| Owner multiplicity heat map | All parallel-path tables merged |
| Persistence authority map | Module 8 + 1 + 3 |
| Doc debt register | All “doc vs code” conflicts |
| Test gate map | What CI proves vs manual-only |
| Fork options | Path A / B / amputation / abandon — with scope estimates |
| Recommended research order if staying | Remaining unknowns |

**Synthesis rules:**

- No new code recommendations without tying to a fork option.
- Prefer **subtraction list** (what to delete) over **add list**.
- Separate **facts** (file exists, test missing) from **judgment** (ship DM-only).

---

## Relationship to other doc shelves

| Shelf | Role |
|-------|------|
| `docs/handoffs/` | Active delivery continuity — **paused** while exploration runs |
| `docs/program/` | Official scope and trains — may **conflict** with exploration; exploration records conflicts, does not edit program docs unless maintainer asks |
| `docs/encyclopedia/` | Intended architecture — baseline for diff |
| `docs/research/` | Future architecture proposals — **not** as-built audit |
| **`docs/exploration/`** | **This shelf** — as-built findings |

---

## Session continuity for agents

When resuming exploration:

1. Read this file + [README.md](./README.md) module index.
2. Pick next **Queued** module; do not re-audit completed modules unless v2 pass scheduled.
3. Append findings; avoid duplicating encyclopedia prose — link and diff instead.
