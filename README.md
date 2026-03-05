# Obscur

Experimental alpha software. Not production-ready.

Obscur is a local-first, decentralized, end-to-end encrypted communication app for private one-on-one and small community/group messaging over Nostr relays.

## What This Project Is

- A privacy-first messenger with no central server requirement.
- A cross-platform app suite:
  - `apps/pwa`: web/PWA client.
  - `apps/desktop`: Tauri desktop client (native networking, updater, Tor support).
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

## Quick Start

Prerequisites:

- Node.js `>=20.11.0`
- `pnpm`

Install and run:

```bash
pnpm install
pnpm dev:pwa
```

For desktop:

```bash
pnpm dev:desktop
```

## Documentation (Primary Navigation)

Use `/docs` as the source of truth for maintainers and contributors.

- Docs index: [`docs/README.md`](docs/README.md)
- Architecture and runtime: [`docs/03-runtime-architecture.md`](docs/03-runtime-architecture.md)
- Messaging and groups: [`docs/04-messaging-and-groups.md`](docs/04-messaging-and-groups.md)
- Testing and quality gates: [`docs/06-testing-and-quality-gates.md`](docs/06-testing-and-quality-gates.md)
- Operations and release flow: [`docs/07-operations-and-release-flow.md`](docs/07-operations-and-release-flow.md)
- v0.8.2 roadmap: [`docs/23-v0.8.2-roadmap.md`](docs/23-v0.8.2-roadmap.md)

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

## Release Preparation (v0.8.2)

Before tagging:

```bash
pnpm version:sync
pnpm version:check
pnpm docs:check
pnpm security:audit
```

Release references:

- [`docs/07-operations-and-release-flow.md`](docs/07-operations-and-release-flow.md)
- [`docs/23-v0.8.2-roadmap.md`](docs/23-v0.8.2-roadmap.md)
