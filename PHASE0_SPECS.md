# Phase 0 Specs: v0.9.0-beta Release Stabilization

Status: Completed (2026-03-17)
Roadmap linkage: `ROADMAP_v0.9.0-beta.md` -> Phase 0

## Scope Summary

Phase 0 is focused on stabilizing release gates and removing ambiguity that causes repeated CI/debug loops.

In scope:
- Deterministic failure triage in release test-pack.
- Canonical contract decision for avatar URL persistence/expectation.
- Local-vs-CI parity enforcement via clean-head scanning.
- Preflight discipline before tag/release.

Out of scope:
- Broad feature rewrites.
- TanStack Query migration (Phase 1).
- Rust/Kotlin/Swift refactors (Phases 2-3).

## Baseline (Observed)

- Initial deterministic gate failure:
  - `apps/pwa/app/features/profile/hooks/use-profile.test.ts`
  - test: `restores persisted local profile state after a restart-style reset`
  - mismatch: expected absolute avatar URL, received relative path.

## Spec P0.1: Avatar URL Canonical Contract

Problem:
- Runtime and test expectations disagreed on whether persisted profile avatar URLs are relative or absolute.

Decision locked:
- Persist local avatar uploads as relative paths (e.g. `/uploads/alice.png`).
- Preserve absolute HTTP(S) avatar URLs unchanged.
- Apply normalization at read/render boundaries, not at persistence-write time.

Requirements:
- One canonical format is documented and enforced.
- Test assertions align with the canonical format.
- No cross-profile persistence regression.

Acceptance criteria:
- `use-profile` restart recovery tests pass.
- Existing profile persistence behavior remains deterministic across profile switches.

Validation:
```bash
pnpm.cmd -C apps/pwa exec vitest run app/features/profile/hooks/use-profile.test.ts
```

## Spec P0.2: Release Test Pack Determinism

Problem:
- Release gate confidence is low when failures are interpreted as broad instability.

Requirements:
- `release:test-pack` must fail only for real contract regressions with clear first-failure signal.
- Noise logs do not obscure first actionable failure.

Acceptance criteria:
- `release:test-pack` completes green, or fails with a single actionable root cause.
- Team can identify root failure from command output within 2 minutes.

Validation:
```bash
pnpm.cmd release:test-pack -- --skip-preflight
```

## Spec P0.3: Local vs Remote Build Parity

Problem:
- Repeated "passes local, fails remote" loops waste release time.

Requirements:
- Clean-head scan must be part of Phase 0 completion criteria.
- Summary output must be captured and used for triage.

Acceptance criteria:
- `ci:scan:pwa:head` passes from a temporary clean worktree.
- If it fails, summary file identifies first hard error class (`Type error`, `Module not found`, etc.).

Validation:
```bash
pnpm.cmd ci:scan:pwa:head
```

## Spec P0.4: Preflight Gate Discipline

Problem:
- Tags/releases are attempted before all hard gates are truly green.

Requirements:
- Release preflight remains blocking for Phase 0 closure.
- Version/docs/CI-signal/artifact checks must all pass before tag operations.

Acceptance criteria:
- Full command gate passes on `main`.
- No tag attempt while any Phase 0 checklist item remains incomplete.

Validation:
```bash
pnpm.cmd version:check
pnpm.cmd docs:check
pnpm.cmd release:artifact-matrix-check
pnpm.cmd release:ci-signal-check
pnpm.cmd release:preflight
```

## Phase 0 Completion Definition

Phase 0 is complete only when all are true:
- P0.1 through P0.4 acceptance criteria are met.
- Checklist in root roadmap Phase 0 is fully checked.
- Completion state is pushed to remote.

## Execution Evidence (Completed)

- Targeted tests passed:
  - `pnpm.cmd -C apps/pwa exec vitest run app/features/profile/hooks/use-profile.test.ts`
  - `pnpm.cmd -C apps/pwa exec vitest run app/features/profile/hooks/use-resolved-profile-metadata.test.ts`
  - `pnpm.cmd -C apps/pwa exec vitest run app/shared/public-url.test.ts`
- Release/stability gates passed:
  - `pnpm.cmd release:test-pack -- --skip-preflight`
  - `pnpm.cmd ci:scan:pwa:head`
  - `pnpm.cmd version:check`
  - `pnpm.cmd docs:check`
  - `pnpm.cmd release:artifact-matrix-check`
  - `pnpm.cmd release:ci-signal-check`
- Preflight note:
  - `pnpm.cmd release:preflight` fails by policy on existing remote tag `v0.9.0-beta` (no retagging).
  - Equivalent preflight validation passed with dry-run tag:
    - `pnpm.cmd release:preflight -- --allow-dirty 1 --tag v0.9.0-beta-phase0-dryrun-20260317`

## Risk Register

- Contract drift risk:
  - Mitigation: canonical format decision + test alignment.
- Hidden remote-only failure risk:
  - Mitigation: mandatory `ci:scan:pwa:head`.
- Premature tagging risk:
  - Mitigation: preflight gating and checklist enforcement.
