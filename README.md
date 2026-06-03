# Obscur

> **Active (2026-05).** Obscur development has resumed in this repository. Greenfield has been discontinued as a separate execution track; its archived design goals remain available for reference in [docs/archive/greenfield/README.md](docs/archive/greenfield/README.md).

[![Version](https://img.shields.io/badge/version-1.8.14-blue)](https://github.com/Dendro-X0/Obscur/blob/main/version.json)
[![Platform](https://img.shields.io/badge/platform-PWA%20%7C%20Desktop%20%7C%20Mobile-0ea5e9)](#platform-coverage)
[![Architecture](https://img.shields.io/badge/architecture-decentralized-22c55e)](#core-positioning)
[![Security](https://img.shields.io/badge/security-E2EE-ef4444)](#core-positioning)
![License](https://img.shields.io/github/license/Dendro-X0/Obscur)

Obscur is a cross-platform, decentralized, end-to-end encrypted (E2EE) communication app focused on user privacy, ownership, and self-custody identity.

Project phase: **v1.9.x — Lane K** (kernel + features on `main`)

**Current version:** [`version.json`](version.json) on **`main`**. GitHub **Releases is disabled** for this repo (Settings → Features) — do not use `/releases` or **Latest**.

**Get Obscur:**

| Path | Command / link |
|------|----------------|
| **Dev** | `pnpm dev:desktop:online` |
| **Local installer** | `pnpm desktop:package` → install from `release-assets/` |
| **Download page** | Website `/download` reads repo [update channel](apps/desktop/release/channel/stable/) |
| **Source** | Clone or [Download ZIP](https://github.com/Dendro-X0/Obscur/archive/refs/heads/main.zip) |

Changelog: [CHANGELOG.md](CHANGELOG.md) · Program: [v1.9.0 kernel roadmap](docs/program/v1.9.0-kernel-backend-roadmap.md) · Packaging: [local-desktop-packaging.md](docs/program/local-desktop-packaging.md)

The project remains independently developed, community-maintained, privacy-first, and local-first.

## Core Positioning

- Decentralized by design (relay-based transport, no required central server).
- Privacy-first messaging and community interactions.
- End-to-end encryption for private communications.
- User sovereignty through key-based identity and local-first ownership.
- Independently developed and community-maintained in public (not operated by a corporation or government agency).

## Trust and Transparency

- Public repository with auditable source code and open release history.
- Project policy guarantee: no intentional malicious code, hidden telemetry backdoors, or closed-source runtime logic in this repository.
- Security/privacy model and implementation history are documented in `/docs`, [`CHANGELOG.md`](CHANGELOG.md), and [`docs/releases/`](docs/releases/). For v1.8.x+, **`/docs` is the authoritative release record** where inline changelog updates were missed during fast patch lanes; entries are backfilled at tag time from program docs.
- Release artifacts are published via GitHub Releases with reproducible version contracts.

## Key Capabilities

- Direct messaging and community/group messaging.
- Rich media messaging (image/video/audio/file).
- Voice notes and realtime voice call flow.
- Local vault/media workflows.
- Message deletion: **Delete for me** (local). Cooperative “remove for everyone” on DMs is **planned for v1.6+**, not v1.5.0 — see [docs/messaging/cooperative-redaction-future.md](docs/messaging/cooperative-redaction-future.md).
- Light/dark themes, multilingual UI, and cross-platform UX parity improvements.
- Runtime diagnostics and triage tooling for long-term maintainability.

## Feature GIF Previews

Current production captures live in `docs/assets/gifs/` and are intended to be reused in the upcoming website surface.

### Login and onboarding

![Login demo](docs/assets/gifs/obscur_login_1.gif)

### Chat UI

![Chat UI demo](docs/assets/gifs/obscur_chat_ui_1.gif)

### Settings and configuration

![Settings demo](docs/assets/gifs/obscur_settings_panel_1.gif)

### Multi-profile management

![Multi-profile demo](docs/assets/gifs/multi_profile_management_1.gif)

### Multimedia upload and transfer

![Multimedia upload demo](docs/assets/gifs/multimedia_files_upload_and_transfer_1.gif)

### Voice notes and calls

![Voice notes and calls demo](docs/assets/gifs/voice_notes_and_calls_1.gif)

### Communities

Community/discovery production GIF capture is the next demo asset to add under `docs/assets/gifs/`.

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

- Official website (`apps/website`, under active planning), including:
  - changelog and release notes,
  - feature and architecture summaries,
  - short GIF demonstrations for production-build features,
  - downloadable release artifacts mirrored from GitHub Releases.

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

The `/docs` tree is the project encyclopedia. **Only** [docs/README.md](docs/README.md) lives at the docs root (navigation).

| Shelf | Entry |
|-------|--------|
| Navigation | [docs/README.md](docs/README.md) |
| **Current release** | [docs/releases/v1.8.9-release.md](docs/releases/v1.8.9-release.md) · [v1.8.9 gate](docs/releases/v1.8.9-gate.md) |
| **Active patch** | [docs/program/v1.8.10-scope.md](docs/program/v1.8.10-scope.md) · [v1.8.10 gate](docs/releases/v1.8.10-gate.md) |
| Release train | [docs/program/v1.8.x-release-train.md](docs/program/v1.8.x-release-train.md) |
| Post–v1.8.9 roadmap (v1.8.10+) | [docs/program/v1.8.9-plus-managed-workspace-roadmap.md](docs/program/v1.8.9-plus-managed-workspace-roadmap.md) |
| Program | [docs/program/PROGRAM.md](docs/program/PROGRAM.md) |
| Changelog | [CHANGELOG.md](CHANGELOG.md) |
| Maintainer | [docs/encyclopedia/08-maintainer-playbook.md](docs/encyclopedia/08-maintainer-playbook.md) |
| Architecture owners | [docs/encyclopedia/12-core-architecture-truth-map.md](docs/encyclopedia/12-core-architecture-truth-map.md) |
| ClientGateway | [docs/gateway/client-unified-gateway.md](docs/gateway/client-unified-gateway.md) |
| Handoff | [docs/handoffs/current-session.md](docs/handoffs/current-session.md) |
| Issues | [ISSUES.md](ISSUES.md) |

## Repository Layout

- `apps/pwa`: web/PWA runtime
- `apps/desktop`: Tauri desktop runtime
- `apps/website`: official website and release surface (in progress)
- `packages/dweb-*`: shared core/crypto/nostr/storage/UI packages
- `docs`: canonical architecture, operations, and roadmap docs
