# Operations and Release Flow

_Last reviewed: 2026-03-03 (baseline commit 7f57b32)._


## Versioning

- Root version is maintained in `package.json`.
- Use the provided scripts for coordinated version updates.

```bash
pnpm version:sync
pnpm version:check
pnpm version:bump
pnpm security:audit
```

## Release Channels

Current alpha distribution is via GitHub releases and internal/dev deployment workflows.

## Recommended Release Checklist

1. Freeze risky feature work.
2. Run `pnpm version:sync` and commit resulting manifest changes.
3. Run `pnpm version:check` and ensure it passes before tagging.
4. Run full quality gates.
5. Validate app startup and core chat flows in PWA + desktop builds.
6. Confirm migration-free startup on existing local data.
7. Update `CHANGELOG.md` with dated release entry.
8. Tag and publish artifacts.

## Mobile/Desktop Notes

Desktop build scripts prepare tor/native sidecars before dev/build.

- `apps/desktop/package.json` (`predev`, `prebuild`)

## Per-app runbooks

Use the detailed app-specific operational guide:

- [Operational Runbooks Per App](./13-operational-runbooks-per-app.md)

## v0.8.0 Hardening Execution

Use these as required release artifacts for the `v0.8.0` cycle:

1. [v0.8.0 Release Readiness Plan](./19-v0.8.0-release-readiness-plan.md)
2. [Threat Model and Security Checklist (v0.8.0)](./20-threat-model-and-security-checklist-v0.8.0.md)

