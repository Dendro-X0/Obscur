# Operations and Release Flow

_Last reviewed: 2026-03-16 (baseline commit ab08104)._


## Versioning

- Root version is maintained in `package.json`.
- Use the provided scripts for coordinated version updates.

```bash
pnpm version:sync
pnpm version:check
pnpm release:preflight
pnpm release:test-pack
pnpm release:verify-tag --tag vX.Y.Z
pnpm version:bump
pnpm security:audit
```

## Release Channels

Current distribution is GitHub Releases only.

## Authoritative Release Workflow

- Tag release publisher: `.github/workflows/release.yml`
  - Required release artifact lanes:
    - `build-web-pwa` (Web/PWA static export bundle)
    - `build-desktop` (Windows/macOS/Linux installers)
    - `build-android` (APK + AAB)
    - `build-ios` (optional IPA when signing secrets are present)
- Branch reliability gate: `.github/workflows/reliability-gates.yml`
  - Always runs on PR/main so required status check reporting is deterministic.
  - Runs `pnpm release:test-pack -- --skip-preflight` only when reliability-scope files changed (`apps`, `packages`, `scripts`, root manifests, workflows).
- Manual mobile-only helpers:
  - `.github/workflows/build-android.yml`
  - `.github/workflows/build-ios.yml`

Tag pushes should only publish through `release.yml`.

## Branch Protection (Beta Baseline)

Recommended required status checks for `main` during v0.9 beta recovery:

1. `release:test-pack` (from `reliability-gates.yml`).

Notes:

1. `docs-check` and `version-check` remain valuable signal workflows, but they are path-filtered; only require them in branch protection if your policy allows skipped/path-unmatched checks or you remove path filters.
2. Local release readiness still requires full `pnpm release:preflight` (clean tree + branch/tag guardrails). CI `--skip-preflight` in reliability gates is only for PR/main automation.

## Recommended Release Checklist

1. Freeze risky feature work.
2. Run `pnpm version:sync` and commit resulting manifest changes.
3. Run `pnpm release:test-pack` and ensure it passes before tagging.
4. Confirm branch CI reliability gate is green (`reliability-gates` workflow).
5. Confirm the P2P core pack is green (resolver + outbox + profile publish timeout tests included in `release:test-pack`).
6. Confirm R0 drift-control gate is green:
  - `docs/39-v0.9-r0-architectural-drift-control.md` is current.
  - `release:test-pack` includes messaging controller determinism tests (request guard, incoming routing, subscription churn).
7. Run `pnpm release:preflight` and ensure it passes before tagging.
  - Preflight enforces v0.9 rollout flag policy coherence and Tauri ACL parity for `protocol_*` + `mine_pow` commands.
8. Run full quality gates.
9. Validate app startup and core chat flows in PWA + desktop builds.
10. Confirm migration-free startup on existing local data.
11. For v0.8.8+, validate one-time profile migration and verify profile isolation (`default` + one extra profile) on local state.
12. Validate Web/PWA static release bundle boot (`index.html`) from artifact output before tagging.
13. Update `CHANGELOG.md` with dated release entry.
14. Tag and publish artifacts.
15. Run `pnpm release:verify-tag --tag vX.Y.Z` against published assets.
16. Never retag an existing version. If a tag already exists on remote, bump patch version and tag the new version.

## Artifact Matrix (v0.9.0-beta Gate)

Required:

1. Web/PWA static export bundle (`.tar.gz`)
2. Windows installer (`.exe`)
3. macOS installer (`.dmg`)
4. Linux desktop bundle (`.AppImage` or `.deb`)
5. Android APK (`.apk`)
6. Android AAB (`.aab`, signed or unsigned)

Optional (when signing inputs are present):

1. iOS IPA (`.ipa`)

`release.yml` now includes a required artifact verification step and supports workflow-dispatch dry-runs without publishing release assets.

## Mobile/Desktop Notes

Desktop build scripts prepare tor/native sidecars before dev/build.

- `apps/desktop/package.json` (`predev`, `prebuild`)

## Local Dev Endpoint Policy

- Dedicated Obscur dev endpoint: `http://127.0.0.1:3340`
- `apps/pwa/package.json` pins Next dev to `127.0.0.1:3340`.
- `apps/desktop/src-tauri/tauri.conf.json` pins both `beforeDevCommand` and `devUrl` to the same endpoint.
- This prevents Tauri from loading unrelated apps when another project occupies a common fallback port (for example `localhost:3000`).

## Per-app runbooks

Use the detailed app-specific operational guide:

- [Operational Runbooks Per App](./13-operational-runbooks-per-app.md)

## Release Planning References

Use these specs/checklists as the current release planning references:

1. [v0.8.0 Release Readiness Plan](./19-v0.8.0-release-readiness-plan.md)
2. [Threat Model and Security Checklist (v0.8.0)](./20-threat-model-and-security-checklist-v0.8.0.md)
3. [v0.8.1 Ticketized Roadmap](./22-v0.8.1-roadmap.md)
4. [v0.8.2 Ticketized Roadmap](./23-v0.8.2-roadmap.md)
5. [v0.8.3 Ticketized Roadmap](./24-v0.8.3-roadmap.md)
6. [v0.8.5 Ticketized Roadmap](./27-v0.8.5-roadmap.md)
7. [v0.8.6 Ticketized Roadmap](./28-v0.8.6-setup-and-configuration-roadmap.md)
8. [v0.8.7 Reliability Core Roadmap](./30-v0.8.7-reliability-core-roadmap.md)
9. [v0.8.6 Settings Maintainer Notes + QA Matrix](./29-v0.8.6-settings-maintainer-notes-and-qa-matrix.md)
10. [v0.8.8 Runtime Decoupling + Multi-Profile Roadmap](./31-v0.8.8-runtime-decoupling-and-multi-profile-roadmap.md)
11. [v0.8.9 Stability + Release Integrity Roadmap](./32-v0.8.9-stability-and-release-integrity-roadmap.md)
12. [v0.8.9 Known Failures Registry](./33-v0.8.9-known-failures-registry.md)
13. [v0.9 Security + Identity Restructure Roadmap](./36-v0.9-security-identity-restructure-roadmap.md)
14. [v0.9 Rescue Wave 0 API/Function Audit Matrix](./38-v0.9-rescue-wave0-api-function-audit-matrix.md)

