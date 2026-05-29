# Obscur

> **Active (2026-05).** Obscur development has resumed in this repository. Greenfield has been discontinued as a separate execution track; its archived design goals remain available for reference in [docs/archive/greenfield/README.md](docs/archive/greenfield/README.md).

[![Release](https://img.shields.io/github/v/release/Dendro-X0/Obscur?display_name=tag&logo=github)](https://github.com/Dendro-X0/Obscur/releases)
[![Platform](https://img.shields.io/badge/platform-PWA%20%7C%20Desktop%20%7C%20Mobile-0ea5e9)](#platform-coverage)
[![Architecture](https://img.shields.io/badge/architecture-decentralized-22c55e)](#core-positioning)
[![Security](https://img.shields.io/badge/security-E2EE-ef4444)](#core-positioning)
![License](https://img.shields.io/github/license/Dendro-X0/Obscur)

Obscur is a cross-platform, decentralized, end-to-end encrypted (E2EE) communication app focused on user privacy, ownership, and self-custody identity.

Project phase: **v1.8.x Lane T — Managed workspace (release candidate `v1.8.8`)**

**Latest release (`v1.8.8`):**

- **Managed workspace (Test 8):** Coordination + operator relay + two-client **create → invite → accept → sealed group chat** on local infra
- **Group chat header:** Member count, online count, last activity under title
- **Group history:** Hydrate sealed messages from local store on open (SQLite on Tauri, scoped chat-state on web)
- **Relay / leave hardening:** Open dev relay whitelist, loopback publish path, terminal membership cache, CRDT-first header count
- **Roadmap (post-tag):** [Operator-relay deletion + group bots](docs/program/v1.8.9-plus-managed-workspace-roadmap.md)

Full notes: [docs/releases/v1.8.8-release.md](docs/releases/v1.8.8-release.md) · Gate: [docs/releases/v1.8.8-gate.md](docs/releases/v1.8.8-gate.md) · Program: [docs/program/v1.8.x-release-train.md](docs/program/v1.8.x-release-train.md) · Changelog: [CHANGELOG.md](CHANGELOG.md)

**Previous release (`v1.8.7`):**

- Transport-hard relay-join tests; membership surface consistency across header, network, invite modal

**Earlier v1.8.x (`v1.8.5`–`v1.8.6`):**

- REL-004 leave durability, community invite DM, relay join after accept, `CommunityMembershipReadModel` owner path, relay runtime smoke CI

**Earlier (`v1.5.0`):**

- ClientGateway (R0–R2), profile runtime, relay-first community membership, account projection

Full v1.5 notes: [docs/releases/v1.5.0-release.md](docs/releases/v1.5.0-release.md)

**Previous release (`v1.4.11`):**

- DM operation ledger (shadow), send retry queue, relay resilience incremental work

**Earlier (`v1.4.7`):**

- M0–M3 stabilization, security integration, CAS media recovery, relay capability badges

**Previous release (`v1.4.6`):**

- **Security Hardening Suite**: Comprehensive identity and transport security improvements:
  - **Visual Identity Verification**: Deterministic identicon generation from public keys for cross-device identity confirmation,
  - **Key Change Detection**: Automated monitoring and alerts for unexpected contact identity changes,
  - **Relay Trust Scoring**: Dynamic health metrics and trust levels for relay selection (high/medium/low/untrusted),
  - **Encrypted Security Audit Log**: Local AES-GCM encrypted append-only security event logging.
- **Community UX Enhancements**: Relay capability badges, loading states, empty states, improved invite flows.
- **Theme Compatibility**: Full light/dark theme support across all security components.

**Earlier release (`v1.4.0`):**

- **CRDT Protocol Suite**: Complete implementation of 5-phase CRDT integration:
  - LWW-Registers for profile and presence state,
  - G-Counters for unread message counts and presence heartbeats,
  - OR-Sets for community membership with proper merge semantics,
  - Content-Addressed Media (CAS) for deduplicated blob storage,
  - Call State CRDT with TTL-based expiration to eliminate ghost calls.
- **Sync Protocol**: Full account-sync CRDT merge pipeline with namespace isolation, handler registration, and conflict resolution.
- **Infrastructure improvements**:
  - IndexedDB upgrade compatibility fixes for test environments,
  - All 1858 tests passing across 309 test files,
  - Type-safe CRDT operations with runtime validation.

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
| **Current release** | [docs/releases/v1.8.8-release.md](docs/releases/v1.8.8-release.md) · [v1.8.8 gate](docs/releases/v1.8.8-gate.md) |
| Release train | [docs/program/v1.8.x-release-train.md](docs/program/v1.8.x-release-train.md) |
| Post–v1.8.8 roadmap | [docs/program/v1.8.9-plus-managed-workspace-roadmap.md](docs/program/v1.8.9-plus-managed-workspace-roadmap.md) |
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
