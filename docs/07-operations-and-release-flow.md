# 07 Operations and Release Flow

_Last reviewed: 2026-03-18 (baseline commit 11f5602)._

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
pnpm release:integrity-check
pnpm docs:check
pnpm release:ci-signal-check
pnpm release:artifact-matrix-check
pnpm release:artifact-version-contract-check
pnpm release:test-pack -- --skip-preflight
pnpm release:preflight
```

## Tagging Model

- Release workflow triggers on `v*` tags.
- Tag pushes run preflight + build + artifact verification.
- GitHub Release publication is manual-only (`workflow_dispatch` with `publish_release=true`) and must be run on a tag ref.
- Do not tag until `main` contains exactly the intended release tree.
- If tag rerun is required, fix root cause on `main`, then use a new version tag (do not rely on retagging).

## Release Workflow Outputs

From `.github/workflows/release.yml`:

- Desktop bundles (Windows/macOS/Linux)
- Android APK + AAB
- Android metadata (`output-metadata.json`) for version parity checks
- Web/PWA static artifact
- Optional iOS IPA lane when signing prerequisites exist
- GitHub Release publication and artifact verification
- Release summary signals:
  - `android_job_result` (`success` / `failure` / `cancelled`),
  - `android_signing_state` (`signed` / `unsigned` / `unavailable`),
  - `ios_lane_state` (`executed` / `skipped_missing_secrets`).

Dynamic publish policy:
- desktop + web verification/publish lanes are canonical release blockers,
- Android lane is non-blocking for tag verification/publication when Android job fails,
- if Android job succeeds, APK/AAB artifacts remain required.

## Known Pitfalls and Fixes

- Accidental gitlink/submodule in repo root
: causes clone failures such as "error occurred while updating repository submodules".
  - Validate with: `git ls-tree -r --full-tree HEAD | rg "^160000"`

- Temp worktree artifacts committed accidentally
: ensure `.tmp-ci-head`, `.tmp-ci-fix`, `.artifacts` are ignored.

- Remote-only type/build drift
: run `pnpm ci:scan:pwa:head` before pushing release changes.

- Local Android mismatch against CI
: CI Android lane uses Java 17 (`actions/setup-java@v3`); local runs on newer Java (for example 25.x) may fail Gradle/Kotlin config before app code is compiled.
  - Repro parity command:
    - `pnpm -C apps/desktop tauri android build --apk --aab` under JDK 17
    - or run `./apps/desktop/src-tauri/gen/android/gradlew` with `--project-dir apps/desktop/src-tauri/gen/android :app:compileUniversalReleaseKotlin --no-daemon` under JDK 17

- Installer/version drift across lanes
: artifact verification now enforces desktop filename version markers and Android `versionName` parity from metadata.

## Minimal Incident Response

1. Capture failing workflow + step + first hard error line.
2. Reproduce locally in clean-head mode where possible.
3. Patch canonical owner module.
4. Re-run gate locally.
5. Push and retag only if tag-triggered workflow is required.
