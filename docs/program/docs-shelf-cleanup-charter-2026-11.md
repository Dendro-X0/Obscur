# Docs / specs shelf cleanup — 2026-11

**Status:** Active (execution band)  
**Retention:** `git mv` → archive only — **never** hard-delete markdown  
**Parents:** [docs-shelf-cleanup-charter-2026-08.md](../archive/program/inactive-2026-11/docs-shelf-cleanup-charter-2026-08.md) (prior wave) · [DOC-MAINTENANCE.md](../DOC-MAINTENANCE.md)  
**Product truth:** rewrite band SUPERSEDE · v2.0.0-beta.3 published · beta.4 packaging PAUSED on weak hosts

```text
HANDOFF ATOMIC STEP: Docs/specs shelf declutter — categorize + archive, not mass-delete
PAUSED: Soft L3 · Tor Verified · Matrix promote · local desktop:package on this host
PROOF: pnpm docs:check · front door CURRENT/START-HERE match handoff · no docs/ root frontend-spec-*
```

## Problem

| Signal | Fact |
|--------|------|
| Front door stale | CURRENT / START-HERE still say **v1.9.16** while product is **2.0.0-beta.x** + rewrite band |
| Root clutter | `docs/frontend-spec-*.md` violate DOC-MAINTENANCE (no loose root specs) |
| Specs sprawl | `specs/backend/` ~478 one-shot investigations; no index of active vs closed |
| Demo shelf | 28 version folders under `assets/demo/` — only **v2.0.0** needed for feedback recording |
| Forbid | Mass-delete of `docs/` or platform safety sheets |

## Target layout

```text
docs/
  START-HERE.md · CURRENT.md · README.md · DOC-MAINTENANCE.md   # front door only
  handoffs/          # live session
  program/           # ≤50 active policy/product (archive excess)
  releases/          # per-tag notes (keep)
  messaging/ · protocols/ · security/ · encyclopedia/   # on-demand shelves
  assets/demo/v2.0.0/   # current demo only
  archive/           # inactive-* waves + old demos
specs/
  README.md          # how to find active vs closed
  backend/           # investigation/design (keep files; index active)
  frontend/          # UI specs (incl. moved frontend-spec-*)
  ui/ · ci/          # thin shelves
  archive/           # optional future home for closed backend one-shots
```

## Wave 1 (this session)

1. Refresh front door to rewrite band + beta.3 (+ beta.4 notes drafted).
2. `git mv docs/frontend-spec*.md` → `specs/frontend/`.
3. `git mv docs/assets/demo/v1.*` → `docs/archive/demo/` (keep `v2.0.0/` + shared private-trust setup).
4. Archive prior cleanup charter + clearly superseded program scopes → `docs/archive/program/inactive-2026-11/`.
5. Add `specs/README.md` (active citation rule).
6. `pnpm docs:check`.

## Wave 2 (2026-11-03 — landed)

- Indexed ACTIVE (cited / Oct–Nov / force-kept policy) vs CLOSED uncited Jun–Aug.
- `git mv` **216** → [specs/archive/backend-inactive-2026-11/](../../specs/archive/backend-inactive-2026-11/README.md); keep-set links rewritten.
- `specs/backend/` ≈ **262** remaining.

## Wave 3 (2026-11-03 — landed)

- Release notes: **62** pre-v1.9 → [docs/archive/releases-pre-v1.9/](../archive/releases-pre-v1.9/); active `docs/releases/` ≈ **23** (v1.9 + v2.0.0-beta + cited leftovers).
- Encyclopedia: historical **11 / 16 / 17** → [docs/archive/encyclopedia-historical-2026-11/](../archive/encyclopedia-historical-2026-11/); active chapters **17** + [README](../encyclopedia/README.md).
- Backend further CANCELLED batch: **0** after citation blockers (no unsafe moves).

## Wave 4 (2026-11-03 — landed)

- Backend: citation **closure** (docs-cited ∪ force-kept ∪ 2026-11, transitive outbound) → archive **+78** unreachable (mostly Oct) into [specs/archive/backend-inactive-2026-11/](../../specs/archive/backend-inactive-2026-11/); keep ≈ **184**.
- Encyclopedia: **reading paths** in [encyclopedia/README.md](../encyclopedia/README.md) — no chapter body merges (maintainer-led later).

## Wave 5 (2026-11-03 — landed)

- Encyclopedia merges (stubs keep URLs):
  - **01** → CURRENT / START-HERE (body archived)
  - **13** → [15 § Failure Atlas](../encyclopedia/15-relay-foundation-hardening-spec.md#failure-atlas) (body archived)
  - **20** → 19 + demo validation (body archived)
- Backend citation closure re-run: **0** new unreachable (keep still ~184).

## Wave 6 (optional)

- Further encyclopedia merges only with explicit per-chapter review (e.g. 05+06 ops).
- Backend closure only after handoff citation set changes.

## Non-goals

- Deleting archive trees
- Local `desktop:package` / Full Release CI (host overload)
- Rewriting encyclopedia or rewriting Soft L3 / Tor docs as “fixed”
