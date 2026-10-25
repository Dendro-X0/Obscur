# CI investigation — docs-check on v2.0.0-beta.2 push

**Run:** reliability-gates / docs-check (push) · commit `fc89c7a1`  
**Class:** docs (broken-link + stale-path-ref)  
**Date:** 2026-10-25

## Primary failure

`pnpm docs:check` fails on GitHub Actions because:

1. **`docs/business/` is gitignored** (local-only GTM). Tracked docs still link into it → CI has no files → `[broken-link]`.
2. **Placeholder backtick paths** (`docs/assets/demo/<version>/`, `apps/desktop/.../net|relay|tor`) are treated as real paths → `[stale-path-ref]`.
3. **Removed repo roots** — `AGENTS.md`, `rules/`, `.agent/skills/` no longer exist; several program docs still link to them.

## Fix plan (this iteration — docs class only)

1. Harden `scripts/docs-check.mjs`: skip `docs/business/` link targets; skip backtick refs with `<…>` placeholders or `...` ellipsis.
2. Retarget or remove dead links to `AGENTS.md` / `rules/` / `.agent/skills/` / missing gif tooling paths in checked docs.
3. Re-run `pnpm docs:check` locally to Pass before push.

## Out of scope this iteration

- `release:test-pack` tsc failures (separate class)
- Vercel website deploy

_Last updated: 2026-10-25T15:00:00Z_
