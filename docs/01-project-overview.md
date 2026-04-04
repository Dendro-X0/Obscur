# 01 Project Overview

_Last reviewed: 2026-03-29 (baseline commit cad5779e)._

Obscur is a privacy-first, local-first messenger built on relay transport and self-custody identity.  
It ships as Web/PWA and Tauri Desktop, with mobile builds produced from the desktop/Tauri stack.

## Product Intent

1. End-to-end encrypted communication with user-controlled identity material.
2. Relay-based delivery without a single mandatory backend.
3. Cross-runtime behavior consistency across PWA and native shells.
4. Deterministic runtime behavior:
: explicit owners,
: explicit scope,
: evidence-backed sync and delivery states.

## Current Health Snapshot

As of 2026-03-29:
1. project health is stable,
2. no unresolved severe blocker is currently identified in active tracking,
3. architecture remains fragile under uncontrolled changes, so owner and evidence contracts stay mandatory.

Update (2026-04-04, v1.3.4 release prep):
1. realtime DM convergence hardening is landed (canonical delete-for-everyone IDs, transport safety-sync watchdog, outgoing send auto-scroll),
2. active release posture has no unresolved severe blocker recorded for the v1.3.4 lane,
3. two-user runtime replay evidence remains mandatory before tag publication claims.

## Platform Surfaces

1. `apps/pwa`: primary product surface and most feature logic.
2. `apps/desktop`: Tauri shell, native runtime bridge, updater, and mobile build path.
3. `apps/website`: web-facing product/landing surface.
4. `apps/relay-gateway`: optional relay edge proxy (PoW gate + upstream forwarder).
5. `apps/coordination`: Cloudflare Worker for invite coordination and upload endpoints.

## Active Engineering Focus

1. Runtime and transport determinism (single owner per window, no duplicate lifecycle owners).
2. Account-sync convergence with explicit profile scope.
3. Relay resilience and scoped publish/subscribe correctness.
4. Community and realtime-voice reliability without introducing parallel owner paths.
5. Documentation as architecture contract.

## Non-Goals

1. Treating optimistic local UI state as network truth.
2. Mixing legacy and modern execution paths for the same user action.
3. Keeping version-specific planning in canonical docs.

## Quick Start

```bash
pnpm install
pnpm dev:pwa
```

Desktop shell:

```bash
pnpm dev:desktop
```

## Key Runtime Entry Points

1. Web app shell:
: `apps/pwa/app/layout.tsx`
: `apps/pwa/app/components/providers.tsx`
2. Runtime supervisor:
: `apps/pwa/app/features/runtime/services/window-runtime-supervisor.ts`
3. Auth gateway:
: `apps/pwa/app/features/auth/components/auth-gateway.tsx`
4. Desktop native runtime bridge:
: `apps/desktop/src-tauri/src/lib.rs`
