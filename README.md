# Obscur

[![Release](https://img.shields.io/github/v/release/Dendro-X0/Obscur?display_name=tag&logo=github)](https://github.com/Dendro-X0/Obscur/releases)
[![Platform](https://img.shields.io/badge/platform-PWA%20%7C%20Desktop%20%7C%20Mobile-0ea5e9)](#platform-coverage)
[![Architecture](https://img.shields.io/badge/architecture-decentralized-22c55e)](#core-positioning)
[![Security](https://img.shields.io/badge/security-E2EE-ef4444)](#core-positioning)
![License](https://img.shields.io/github/license/Dendro-X0/Obscur)

Obscur is a cross-platform, decentralized, end-to-end encrypted (E2EE) communication app focused on user privacy, ownership, and self-custody identity.

Project phase: community-maintained release hardening.

Release prep status (`v1.3.14`):

- Community recovery and cross-device durability are the main focus of this cut:
  - fresh-device restore now avoids fabricating phantom one-member private groups from bare sender-local invite-accept history,
  - legitimate joined communities still restore when matching invite room-key evidence exists,
  - sealed community membership now converges faster after leave through direct `9022` relay-leave evidence and newer roster omission handling,
  - empty-state recovery paths in Discovery and Network now route through the canonical community preview and join flow.
- Fresh-device DM history restore remains a privacy-first release lane:
  - account-sync mutation replay is hardened against stale mount-time publish triggers,
  - restored chat-state is re-materialized into indexed message storage so post-restore reads do not fall back to a thinner owner path,
  - DM reads stay on legacy chat-state when it is richer than projection,
  - durable delete tombstones and canonical removal events remain the non-resurrection contract for deleted DM history.
- Vault and media workflows are more release-ready:
  - Vault tiles now preserve source-conversation ownership with DM/community-specific copy and actions,
  - transient media upload failures retry through a bounded second attempt instead of failing immediately on the first provider/network hiccup,
  - existing large-upload safety budgets remain in place.
- Release-facing documentation is now aligned for the next public lane:
  - production GIF captures live under `docs/assets/gifs/`,
  - the website lane is documented as the future home for demos, changelogs, and downloadable artifacts,
  - the project remains independently developed and community-maintained.

## Core Positioning

- Decentralized by design (relay-based transport, no required central server).
- Privacy-first messaging and community interactions.
- End-to-end encryption for private communications.
- User sovereignty through key-based identity and local-first ownership.
- Independently developed and community-maintained in public (not operated by a corporation or government agency).

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
- `apps/website`: official website and release surface (in progress)
- `packages/dweb-*`: shared core/crypto/nostr/storage/UI packages
- `docs`: canonical architecture, operations, and roadmap docs
