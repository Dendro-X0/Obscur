# Obscur

Pre-release beta software. Not production-ready.

Obscur is a local-first, decentralized, end-to-end encrypted communication app for private one-on-one and small community/group messaging over Nostr relays.

## What This Project Is

- A privacy-first messenger with no central server requirement.
- A cross-platform app suite:
  - `apps/pwa`: web/PWA client.
  - `apps/desktop`: Tauri desktop client (native networking, updater, Tor support).
  - Mobile runtime via Tauri targets (Android and iOS) from `apps/desktop`.
- A shared protocol/runtime workspace:
  - `packages/dweb-*`: core, crypto, nostr, storage, and UI primitives.

## Why Obscur

- Decentralized transport: relay-based architecture, no single backend dependency.
- Strong privacy model: encrypted messaging with local-first data handling.
- Self-custody identity: key-based identity instead of account/password silos.
- Cross-platform consistency: same core messaging model across PWA and desktop.
- Release discipline: version sync/check automation and docs-backed release runbooks.

## Core Features

- Direct messaging and group/community messaging.
- End-to-end encrypted message flows.
- Rich media messaging (images, audio, video, documents).
- Local media caching and vault workflows.
- Relay and storage configuration controls.
- Light and dark theme support.
- Multi-language UI (English, Chinese, Spanish).
- Desktop updater and release-tag awareness.
- Performance mode improvements for large timelines and burst traffic.

## Current Status (v1.1.2 Active)

- Latest released tag: `v1.1.1` (`2026-03-24`).
- Active execution lane: `v1.1.2-v1.2.0` (`M9` secure voice communication rollout) with one-milestone-per-version discipline.
- Post-v1 roadmap and milestone status are tracked in:
  - [`docs/21-post-v1-value-roadmap.md`](docs/21-post-v1-value-roadmap.md).
- Active major-phase sequence (`v1.1.2-v1.2.0`) is tracked in:
  - [`docs/29-versioned-major-phase-plan-v1.0.10-v1.3.0.md`](docs/29-versioned-major-phase-plan-v1.0.10-v1.3.0.md).
- Previous sequence (`v1.0.4-v1.0.6`) remains documented as historical execution context:
  - [`docs/23-versioned-phase-plan-v1.0.4-v1.0.6.md`](docs/23-versioned-phase-plan-v1.0.4-v1.0.6.md).
- Canonical runtime monitoring baseline:
  - [`ISSUES.md`](ISSUES.md)
  - [`docs/08-maintainer-playbook.md`](docs/08-maintainer-playbook.md)

## Quick Start

Prerequisites:

- Node.js `>=20.11.0`
- `pnpm`

Install and run:

```bash
pnpm install
pnpm dev:pwa
```

Default local endpoint: `http://127.0.0.1:3340` (reserved for Obscur to avoid `localhost:3000` collisions with other projects).

For desktop:

```bash
pnpm dev:desktop
```

## Documentation (Primary Navigation)

Use `/docs` as the source of truth for maintainers and contributors.

Root `PHASE0-4` and `ROADMAP_*` planning files were retired in `v0.9.2`; keep planning and handoff context in `/docs` + `ISSUES.md`.

- Docs index: [`docs/README.md`](docs/README.md)
- Project overview: [`docs/01-project-overview.md`](docs/01-project-overview.md)
- Repository map: [`docs/02-repository-map.md`](docs/02-repository-map.md)
- Runtime architecture: [`docs/03-runtime-architecture.md`](docs/03-runtime-architecture.md)
- Feature module map: [`docs/04-messaging-and-groups.md`](docs/04-messaging-and-groups.md)
- Data and sync flows: [`docs/05-performance-and-load-testing.md`](docs/05-performance-and-load-testing.md)
- Testing and quality gates: [`docs/06-testing-and-quality-gates.md`](docs/06-testing-and-quality-gates.md)
- Operations and release flow: [`docs/07-operations-and-release-flow.md`](docs/07-operations-and-release-flow.md)
- Maintainer handoff: [`docs/08-maintainer-playbook.md`](docs/08-maintainer-playbook.md)

## Demo Placeholders (To Be Replaced)

These placeholders are for future GIF demos in README and the future official website.

1. `docs/assets/demo-auth-and-onboarding.gif`  
   Placeholder: account creation/import, remember-login flow, lock/unlock.
2. `docs/assets/demo-dm-and-groups.gif`  
   Placeholder: DM chat, group timeline, invite/join/leave actions.
3. `docs/assets/demo-media-and-vault.gif`  
   Placeholder: media uploads, previews, volume controls, vault behavior.
4. `docs/assets/demo-relay-and-settings.gif`  
   Placeholder: relay/storage config, performance toggle, update check flow.
5. `docs/assets/demo-desktop-updater.gif`  
   Placeholder: current vs latest version state and install prompt.

## Release Preparation (Current Tag Lane)

Before tagging:

```bash
pnpm version:sync
pnpm version:check
pnpm release:integrity-check
pnpm docs:check
pnpm release:ci-signal-check
pnpm release:artifact-matrix-check
pnpm release:artifact-version-contract-check
pnpm release:test-pack
pnpm release:preflight -- --tag vX.Y.Z
pnpm release:verify-tag --tag vX.Y.Z
```

Release execution model:

- Step 1: push tag to run preflight/build/artifact verification and auto-publish GitHub Release assets.
- Step 2 (fallback only): manual `.github/workflows/release.yml` dispatch with `publish_release=true` on the tag ref if a rerun/publish repair is needed.
- Android lane is reported explicitly in release evidence (`android_job_result`, `android_signing_state`) and does not block desktop/web artifact verification or publication when Android fails.

Release references:

- [`docs/07-operations-and-release-flow.md`](docs/07-operations-and-release-flow.md)
- [`docs/08-maintainer-playbook.md`](docs/08-maintainer-playbook.md)
- [`ISSUES.md`](ISSUES.md)

Current distribution channel:

- GitHub Releases only (`.github/workflows/release.yml`), with required artifact lanes for:
  - Web/PWA static bundle (`.tar.gz`)
  - Desktop installers (Windows/macOS/Linux)
  - Android (`.apk` + `.aab`) when Android lane succeeds; lane status is surfaced in release summary
  - iOS (`.ipa`) when signing secrets are available
