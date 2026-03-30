# 07 Operations and Release Flow

_Last reviewed: 2026-03-29 (baseline commit cad5779e)._

This document is the canonical, version-agnostic release and operations flow.

## Version Source of Truth

1. Root `package.json` is the canonical product version.
2. Sync all release-tracked manifests before tagging:

```bash
pnpm version:sync
pnpm version:check
```

Tracked sync surfaces include:
1. `apps/pwa/package.json`
2. `apps/desktop/package.json`
3. `apps/desktop/src-tauri/tauri.conf.json`
4. `version.json`
5. release-tracked package manifests

## Canonical Release Sequence

1. Scope freeze:
: blocker-only changes after freeze.
2. Automated gate replay:
: run full pre-tag gate set on clean `main`.
3. Manual replay:
: execute maintained matrix from `docs/08-maintainer-playbook.md`.
4. Version sync and strict preflight:
: verify tag payload is reproducible.
5. Tag and publish:
: push tag, monitor workflow, verify artifacts.
6. Post-release watch window:
: patch-only policy for production-impacting regressions.

## Pre-Tag Gate Set

```bash
pnpm version:check
pnpm docs:check
pnpm release:integrity-check
pnpm release:ci-signal-check
pnpm release:artifact-matrix-check
pnpm release:artifact-version-contract-check
pnpm release:test-pack -- --skip-preflight
pnpm release:preflight -- --tag <tag>
```

If a temporary dirty-tree preflight is needed for diagnostics:

```bash
pnpm release:preflight -- --tag <tag> --allow-dirty 1
```

Do not tag until strict clean-tree preflight passes.

## Tagging and Publish Policy

1. Release workflow triggers on `v*` tags.
2. Do not tag until `main` matches intended release tree exactly.
3. If a workflow rerun is required, prefer fixing on `main` and shipping a new version tag.
4. Do not rely on destructive retagging as a primary recovery path.

## Release Workflow Outputs

From `.github/workflows/release.yml`:
1. Desktop bundles (Windows/macOS/Linux)
2. Android APK/AAB + metadata
3. Web/PWA static artifact
4. Optional iOS lane (when signing prerequisites exist)
5. Artifact verification + release publication

Release summary signals include:
1. `android_job_result`
2. `android_signing_state`
3. `ios_lane_state`

Policy:
1. desktop + web verification lanes are canonical blockers,
2. Android lane may be non-blocking when configured as degraded,
3. if Android lane succeeds, Android artifacts remain required.

## Operational Pitfalls

1. Accidental gitlinks/submodules in repo root:
: validate with `git ls-tree -r --full-tree HEAD | rg "^160000"`.
2. Remote-only build drift:
: run `pnpm ci:scan:pwa:head` before release pushes.
3. Local/CI Android mismatch:
: reproduce with JDK 17 to match CI.
4. Version drift in artifacts:
: enforce `release:artifact-version-contract-check`.

## Incident Response (Release Lane)

1. Capture failing workflow/job/step and first hard error.
2. Reproduce locally on clean head where possible.
3. Patch canonical owner module (not scattered callsites).
4. Re-run relevant gates.
5. Tag only after clean gate replay and updated release evidence.
