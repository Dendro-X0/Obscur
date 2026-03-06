# Operations and Release Flow

_Last reviewed: 2026-03-05 (baseline commit ad788a4)._


## Versioning

- Root version is maintained in `package.json`.
- Use the provided scripts for coordinated version updates.

```bash
pnpm version:sync
pnpm version:check
pnpm release:preflight
pnpm version:bump
pnpm security:audit
```

## Release Channels

Current alpha distribution is via GitHub releases and internal/dev deployment workflows.

## Authoritative Release Workflow

- Tag release publisher: `.github/workflows/release.yml`
- Manual mobile-only helpers:
  - `.github/workflows/build-android.yml`
  - `.github/workflows/build-ios.yml`

Tag pushes should only publish through `release.yml`.

## Recommended Release Checklist

1. Freeze risky feature work.
2. Run `pnpm version:sync` and commit resulting manifest changes.
3. Run `pnpm release:preflight` and ensure it passes before tagging.
4. Run full quality gates.
5. Validate app startup and core chat flows in PWA + desktop builds.
6. Confirm migration-free startup on existing local data.
7. Update `CHANGELOG.md` with dated release entry.
8. Tag and publish artifacts.
9. Never retag an existing version. If a tag already exists on remote, bump patch version and tag the new version.

## Artifact Matrix (v0.8.3 Gate)

Required:

1. Windows installer (`.exe`)
2. macOS installer (`.dmg`)
3. Linux desktop bundle (`.AppImage` or `.deb`)
4. Android APK (`.apk`)
5. Android AAB (`.aab`, signed or unsigned)

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
8. [v0.8.6 Settings Maintainer Notes + QA Matrix](./29-v0.8.6-settings-maintainer-notes-and-qa-matrix.md)

