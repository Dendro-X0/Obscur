# 01 Project Overview

_Last reviewed: 2026-03-17 (baseline commit 1f075aa)._

Obscur is a privacy-first, local-first messenger built on Nostr relays. The project ships as Web/PWA and Tauri Desktop, with mobile builds produced from the desktop/Tauri stack.

## Product Intent

- End-to-end encrypted messaging with self-custody identity.
- Relay-based transport with no single backend dependency.
- Cross-platform behavior consistency across PWA and native shells.
- Deterministic runtime behavior: explicit ownership, explicit scope, evidence-backed sync and delivery states.

## Platform Surfaces

- `apps/pwa`: primary product surface and most feature logic.
- `apps/desktop`: Tauri shell, native runtime bridge, updater, mobile build path.
- `apps/website`: marketing/docs site surface.
- `apps/relay-gateway`: relay-facing service surface.
- `apps/coordination`: auxiliary app surface.

## Current Engineering Priorities

- Runtime/transport determinism (single owner per window, no duplicate lifecycle owners).
- Account sync convergence and profile-scoped persistence.
- Relay resilience and scoped publish/subscribe correctness.
- Cross-device identity/session consistency.

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

- Web app shell: `apps/pwa/app/components/app-shell.tsx`
- Runtime supervisor: `apps/pwa/app/features/runtime/services/window-runtime-supervisor.ts`
- Auth gateway: `apps/pwa/app/features/auth/components/auth-gateway.tsx`
- Desktop runtime bridge: `apps/desktop/src-tauri/src/lib.rs`
