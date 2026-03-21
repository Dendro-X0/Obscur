# 01 Project Overview

_Last reviewed: 2026-03-19 (baseline commit 0a799f5)._

Obscur is a privacy-first, local-first messenger built on Nostr relays. The project ships as Web/PWA and Tauri Desktop, with mobile builds produced from the desktop/Tauri stack.

## Product Intent

- End-to-end encrypted messaging with self-custody identity.
- Relay-based transport with no single backend dependency.
- Cross-platform behavior consistency across PWA and native shells.
- Deterministic runtime behavior: explicit ownership, explicit scope, evidence-backed sync and delivery states.

## Platform Surfaces

- `apps/pwa`: primary product surface and most feature logic.
- `apps/desktop`: Tauri shell, native runtime bridge, updater, mobile build path.
- `apps/website`: web-facing product/landing surface.
- `apps/relay-gateway`: optional relay edge proxy (PoW gate + upstream forwarder) used in some local/dev topologies.
- `apps/coordination`: Cloudflare Worker for invite coordination (`/invites/create`, `/invites/redeem`) and NIP-98/96 upload endpoints.

## Current Engineering Priorities

- Runtime/transport determinism (single owner per window, no duplicate lifecycle owners).
- Account sync convergence and profile-scoped persistence.
- Relay resilience and scoped publish/subscribe correctness.
- Cross-device identity/session consistency.
- Docs as architecture contract: one canonical owner per lifecycle and explicit diagnostics for every degraded boundary.

## Non-Goals

- Maintaining old roadmap narratives inside active docs.
- Treating optimistic local state as network truth.
- Mixing legacy and modern execution paths for the same user action.

## Quick Start

```bash
pnpm install
pnpm dev:pwa
```

Desktop shell:

```bash
pnpm dev:desktop
```

## Entry Points

- Web app shell: `apps/pwa/app/layout.tsx`, `apps/pwa/app/components/providers.tsx`
- Runtime supervisor: `apps/pwa/app/features/runtime/services/window-runtime-supervisor.ts`
- Auth gateway: `apps/pwa/app/features/auth/components/auth-gateway.tsx`
- Desktop runtime bridge: `apps/desktop/src-tauri/src/lib.rs`
- Relay gateway runtime: `apps/relay-gateway/src/index.ts`
- Coordination worker runtime: `apps/coordination/src/index.ts`
