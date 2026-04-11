# Obscur

[![Release](https://img.shields.io/github/v/release/Dendro-X0/Obscur?display_name=tag&logo=github)](https://github.com/Dendro-X0/Obscur/releases)
[![Platform](https://img.shields.io/badge/platform-PWA%20%7C%20Desktop%20%7C%20Mobile-0ea5e9)](#platform-coverage)
[![Architecture](https://img.shields.io/badge/architecture-decentralized-22c55e)](#core-positioning)
[![Security](https://img.shields.io/badge/security-E2EE-ef4444)](#core-positioning)
![License](https://img.shields.io/github/license/Dendro-X0/Obscur)

Obscur is a cross-platform, decentralized, end-to-end encrypted (E2EE) communication app focused on user privacy, ownership, and self-custody identity.

Project phase: pre-launch stabilization.

Release prep status (`v1.3.12`):

- Cross-device DM history restore is significantly hardened for fresh-device login:
  - encrypted account backup now carries durable DM delete tombstones,
  - local delete actions remove stale rows from the canonical chat-state blob,
  - canonical account-event replay now records sticky local DM removals so deleted rows are not re-added by later restore/projection replay,
  - incoming relay catch-up now suppresses tombstoned message ids before persistence/apply.
- Fresh-device history restore now better preserves legitimate recent incoming DM history while still honoring tombstones for deleted rows.
- Chat surfaces now update profile metadata more responsively after restore:
  - DM sidebar rows and sender labels no longer wait for a full page refresh before resolving usernames/avatars when live metadata becomes available.
- The release remains a privacy-first hardening cut:
  - relay-side physical erasure is still not claimable on third-party append-only relays,
  - the client-side guarantee strengthened in this release is non-resurrection of deleted DM history across restore/replay owners.

## Core Positioning

- Decentralized by design (relay-based transport, no required central server).
- Privacy-first messaging and community interactions.
- End-to-end encryption for private communications.
- User sovereignty through key-based identity and local-first ownership.
- Independently developed and publicly maintained (not operated by a corporation or government agency).

## Trust and Transparency

- Public repository with auditable source code and open release history.
- Project policy guarantee: no intentional malicious code, hidden telemetry backdoors, or closed-source runtime logic in this repository.
- Security/privacy model and implementation history are documented in `/docs` and `CHANGELOG.md`.
- Release artifacts are published via GitHub Releases with reproducible version contracts.

## Key Capabilities

- Direct messaging and community/group messaging.
- Rich media messaging (image/video/audio/file).
- Voice notes and realtime voice call flow.
- Local vault/media workflows.
- Message deletion controls (`Delete for me` and `Delete for everyone` where supported by protocol flow).
- Light/dark themes, multilingual UI, and cross-platform UX parity improvements.
- Runtime diagnostics and triage tooling for long-term maintainability.

## Feature GIF Previews (Placeholders)

The following placeholders are reserved for production-build feature demonstrations:

- Settings and configuration:
  ![Settings and configuration demo placeholder](docs/assets/demo/placeholders/settings-configuration.gif)
- UI and navigation:
  ![UI and navigation demo placeholder](docs/assets/demo/placeholders/ui-navigation.gif)
- Multimedia upload and playback:
  ![Multimedia upload demo placeholder](docs/assets/demo/placeholders/multimedia-upload.gif)
- Groups and communities:
  ![Groups and communities demo placeholder](docs/assets/demo/placeholders/groups-communities.gif)

## Platform Coverage

- Web/PWA: `apps/pwa`
- Desktop (Tauri): `apps/desktop`
- Mobile targets via desktop runtime/tooling lane (Android/iOS support paths in repository workflows)

## Quick Start

Prerequisites:

- Node.js `>=20.11.0`
- `pnpm`

Install and run PWA:

```bash
pnpm install
pnpm dev:pwa
```

Default local endpoint: `http://127.0.0.1:3340`

Run desktop:

```bash
pnpm dev:desktop
```

## Deployment and Release

Current public distribution:

- GitHub Releases (primary channel)

Planned distribution:

- Official website (under construction), including:
  - changelog and release notes,
  - feature descriptions,
  - short GIF demonstrations for key production-build features.

Release guard commands:

```bash
pnpm version:sync
pnpm version:check
pnpm docs:check
pnpm release:integrity-check
pnpm release:artifact-version-contract-check
pnpm release:ci-signal-check
pnpm release:test-pack
pnpm release:preflight -- --tag vX.Y.Z
```

## Documentation Map

- Docs index: `docs/README.md`
- Project overview: `docs/01-project-overview.md`
- Runtime architecture: `docs/03-runtime-architecture.md`
- Messaging/groups architecture: `docs/04-messaging-and-groups.md`
- Quality gates: `docs/06-testing-and-quality-gates.md`
- Release operations: `docs/07-operations-and-release-flow.md`
- Maintainer playbook: `docs/08-maintainer-playbook.md`
- Roadmap: `docs/roadmap/current-roadmap.md`
- Active issue ledger: `ISSUES.md`

## Repository Layout

- `apps/pwa`: web/PWA runtime
- `apps/desktop`: Tauri desktop runtime
- `apps/website`: official website (in progress)
- `packages/dweb-*`: shared core/crypto/nostr/storage/UI packages
- `docs`: canonical architecture, operations, and roadmap docs
