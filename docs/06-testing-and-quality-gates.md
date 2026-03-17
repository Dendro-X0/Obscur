# 06 Testing and Quality Gates

_Last reviewed: 2026-03-17 (baseline commit 1f075aa)._

## Test Pyramid (Practical)

1. Unit tests for pure modules/contracts.
2. Focused integration tests for transport/runtime boundaries.
3. Typecheck and build parity checks.
4. Manual runtime validation for cross-device and relay-sensitive behavior.

## Core Commands

```bash
pnpm -C apps/pwa exec tsc --noEmit
pnpm -C apps/pwa test:run
pnpm docs:check
pnpm ci:scan:pwa:head
```

## Release-Critical Commands

```bash
pnpm version:check
pnpm release:artifact-matrix-check
pnpm release:ci-signal-check
pnpm release:test-pack -- --skip-preflight
pnpm release:preflight
```

## CI Workflows to Watch

- Full release: `.github/workflows/release.yml`
- Reliability gate: `.github/workflows/reliability-gates.yml`
- Docs gate: `.github/workflows/docs-check.yml`

## Fast Failure Triage

1. If Vercel/remote build fails but local appears green, run `pnpm ci:scan:pwa:head`.
2. Fix contract drift by owner module, not by scattered callsite patches.
3. Re-run clean-head scan before pushing.

## Required Validation for Core Flow Changes

For auth, account sync, relay, request, and DM changes, leave at least one of:

- new test,
- tightened typed contract,
- new diagnostics surface,
- docs update describing invariant/gate.
