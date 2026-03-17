# Phase 4 Specs: Beta Release Hardening and Repeatability (v0.9.0-beta)

Status: In Progress (local gates passed; completion evidence pending) (2026-03-17)  
Roadmap linkage: `ROADMAP_v0.9.0-beta.md` -> Phase 4

## Locked Policy

1. Tag-triggered workflow runs preflight + build + verify only.
2. GitHub Release publication is manual-only from `workflow_dispatch` with `publish_release=true` on a tag ref.
3. Android unsigned fallback is allowed for beta, but signing state must be explicitly reported in workflow summary.
4. iOS remains optional for beta, and lane status must be explicit (`executed` or `skipped_missing_secrets`).
5. Phase 4 closes at release-ready evidence (not live tag publish).

## Spec P4.1: Release Workflow Hardening

Requirements:
- `release.yml` publish job no longer auto-runs on push tags.
- Push-tag runs still include preflight + build + artifact verification.
- Workflow summary includes `android_signing_state` and `ios_lane_state`.

Acceptance criteria:
- `publish-release` condition is manual-only (`workflow_dispatch` + `publish_release=true` + tag ref).
- Verify job emits release lane summary with Android/iOS status fields.

## Spec P4.2: Repeatability and Source-Integrity Guards

Requirements:
- Release integrity guard fails when `.gitmodules` exists or any gitlink (`mode 160000`) exists in `HEAD` or index.
- Artifact version parity is enforced in release verification:
  - Desktop installer filenames include current version marker.
  - Android `output-metadata.json` entries for APK/AAB match root version as `versionName`.
- Contract checks are required in preflight and release test-pack.

Acceptance criteria:
- New guard scripts are wired into `release:preflight` and `release:test-pack`.
- Release workflow verify stage runs artifact-version parity check on downloaded assets.

## Spec P4.3: Docs and Changelog Truth Sync

Requirements:
- Release docs and README reflect two-step release model (build/verify then manual publish).
- Changelog includes concise Phase 4 hardening note.
- Roadmap checkboxes update only after full Phase 4 acceptance gates are satisfied.

Acceptance criteria:
- `docs:check` passes with updated release docs.
- `CHANGELOG.md` documents Phase 4 release-contract changes.

## Validation Gates

```bash
pnpm version:check
pnpm docs:check
pnpm release:integrity-check
pnpm release:artifact-matrix-check
pnpm release:artifact-version-contract-check
pnpm release:ci-signal-check
pnpm release:test-pack -- --skip-preflight
pnpm ci:scan:pwa:head
pnpm release:preflight -- --allow-dirty 1
```

## Execution Evidence (2026-03-17)

Local gate results:
- `pnpm.cmd version:check` -> passed.
- `pnpm.cmd docs:check` -> passed.
- `pnpm.cmd release:integrity-check` -> passed.
- `pnpm.cmd release:artifact-matrix-check` -> passed.
- `pnpm.cmd release:artifact-version-contract-check` -> passed.
- `pnpm.cmd release:ci-signal-check` -> passed.
- `pnpm.cmd release:test-pack -- --skip-preflight` -> passed.
- `pnpm.cmd ci:scan:pwa:head` -> passed.
- `pnpm.cmd release:preflight -- --allow-dirty 1` -> failed as expected for existing remote tag `v0.9.0-beta` (anti-retag guard).
- `pnpm.cmd release:preflight -- --tag v0.9.0-beta-dryrun --allow-dirty 1` -> passed.
- `pnpm.cmd release:preflight` -> failed as expected in dirty working tree (strict clean-main requirement).

Remote/manual workflow evidence:
- Pending (`workflow_dispatch` non-publish run on a tag ref with summary capture).
- Required proof not yet attached:
  - publish job does not run unless `publish_release=true` on `workflow_dispatch`.
  - workflow summary explicitly reports `android_signing_state` and `ios_lane_state`.

## Completion Rule

Phase 4 can be marked complete only when:
1. All local gates above pass.
2. Manual non-publish workflow evidence is captured.
3. Strict `pnpm release:preflight` passes on clean `main` working tree.
