# Docs Maintenance Standard

_Last reviewed: 2026-03-03 (baseline commit 7f57b32)._


This defines required standards for documentation quality in this repository.

## 1) What Must Be Updated With Code Changes

When behavior changes, update in the same PR/commit:

1. relevant docs under `/docs`,
2. `CHANGELOG.md` if user-visible behavior changed,
3. tests (or explicit rationale if not updated).

## 2) Documentation Quality Bar

Docs should be:

- accurate to current code,
- scoped (avoid speculative future-only statements),
- actionable (include concrete file paths and commands),
- explicit about runtime differences (`pwa` vs `desktop`).
- freshness-stamped on numbered canonical docs (`01`-`20`) with:
  `_Last reviewed: YYYY-MM-DD (baseline commit <hash>)._`

## 3) Required Sections for New Feature Docs

1. purpose/scope,
2. entrypoint files,
3. invariants/contracts,
4. test expectations,
5. failure modes/triage hints.

## 4) Link and Consistency Checks

Before merging doc-heavy changes:

1. run `pnpm docs:check`,
2. verify links resolve within `/docs`,
3. ensure no references to removed files,
4. ensure terminology consistency with [Glossary](./16-glossary-and-canonical-terms.md).

## 5) CI Enforcement

- Documentation pull requests and pushes must pass docs QA in CI (`.github/workflows/docs-check.yml`).
- If `docs:check` fails in CI, treat as a merge blocker.

## 6) Ownership and Review

For core runtime docs (`03`, `04`, `10`, `11`, `12`, `14`):

- require review by a maintainer familiar with messaging/group internals.

## 7) Anti-Drift Rule

If a doc is discovered stale during implementation:

1. patch it immediately,
2. add a short note in commit/PR summary,
3. do not defer unless blocked by missing source-of-truth code decisions.
