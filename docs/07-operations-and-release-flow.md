# 07 Operations and Release Flow

_Last reviewed: 2026-03-17 (baseline commit 1f075aa)._

## Version Source of Truth

- Root `package.json` is the canonical product version.
- Sync all release-tracked manifests before tagging:

```bash
pnpm version:sync
pnpm version:check
```

Tracked sync targets include:

- `apps/pwa/package.json`
- `apps/desktop/package.json`
- `apps/desktop/src-tauri/tauri.conf.json`
- `version.json`
- release-tracked package manifests

## Pre-Tag Checklist

```bash
pnpm docs:check
pnpm release:ci-signal-check
pnpm release:artifact-matrix-check
pnpm release:test-pack -- --skip-preflight
pnpm release:preflight
```

## Tagging Model

- Release workflow triggers on `v*` tags.
- Do not tag until `main` contains exactly the intended release tree.
- If tag rerun is required, retag only after fixing root cause on `main`.

## Release Workflow Outputs

From `.github/workflows/release.yml`:

- Desktop bundles (Windows/macOS/Linux)
- Android APK + AAB
- Web/PWA static artifact
- Optional iOS IPA lane when signing prerequisites exist
- GitHub Release publication and artifact verification

## Known Pitfalls and Fixes

- Accidental gitlink/submodule in repo root
: causes clone failures such as "error occurred while updating repository submodules".
  - Validate with: `git ls-tree -r --full-tree HEAD | rg "^160000"`

- Temp worktree artifacts committed accidentally
: ensure `.tmp-ci-head`, `.tmp-ci-fix`, `.artifacts` are ignored.

- Remote-only type/build drift
: run `pnpm ci:scan:pwa:head` before pushing release changes.

## Minimal Incident Response

1. Capture failing workflow + step + first hard error line.
2. Reproduce locally in clean-head mode where possible.
3. Patch canonical owner module.
4. Re-run gate locally.
5. Push and retag only if tag-triggered workflow is required.
