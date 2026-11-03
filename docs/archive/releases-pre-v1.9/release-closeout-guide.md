# Release Closeout Guide

This is the canonical release closeout runbook for all release trains.

## Closeout Packet Model

Every release closeout packet must include:

1. automated gate evidence,
2. focused owner-suite test evidence,
3. manual replay evidence for user-visible fragile flows,
4. concise runtime diagnostics bundle for triage continuity.

## Canonical Closeout Flow

1. Initialize/update release evidence packet for the current train.
2. Run release-candidate evidence materialization checks (if applicable).
3. Run closeout gate checks.
4. Run strict manual gate checks.
5. Tag only after all closeout gates are green.

If the current release train provides dedicated closeout scripts, run those scripts in this same order.  
If not, use the generic validation pack below.

## Generic Validation Pack

Run on clean `main`:

1. `pnpm version:check`
2. `pnpm docs:check`
3. focused touched-owner `vitest` suites
4. `pnpm --dir apps/pwa exec -- tsc --noEmit --pretty false`
5. `pnpm release:test-pack -- --skip-preflight`
6. `pnpm release:preflight -- --tag <tag>`

## Tag and Publish

1. `git tag <tag>`
2. `git push origin <tag>`
3. Monitor workflow status and artifact verification
: `pnpm release:workflow-status -- --tag <tag>`

## Evidence Storage Rules

1. Keep current release packet assets under `docs/assets/demo/` in a release-specific subfolder.
2. Keep final manual verification checklist in the corresponding release asset folder.
3. Keep old versioned matrices/runbooks in `docs/archive/versioned/` for audit only.
4. Record only durable outcomes in canonical docs (`roadmap`, `operations`, `playbook`, `history`).
