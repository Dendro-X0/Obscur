# Runtime Architecture

_Last reviewed: 2026-03-03 (baseline commit 7f57b32)._


## PWA Runtime (`apps/pwa`)

- Framework: Next.js 16 + React 19.
- Architecture style: feature folders under `app/features/*`.
- Key composition: provider + hook based state orchestration.

Core providers include messaging, relays, identity/auth, groups, and network trust state.

## Desktop Runtime (`apps/desktop`)

- Host: Tauri v2.
- Uses native sidecars/tooling setup scripts before dev/build.
- Bridges web UI with native capabilities (networking, filesystem, OS integrations).

## Messaging Persistence Model

- IndexedDB-backed `messages` store (`packages/dweb-storage`).
- Composite index support for fast conversation-time paging.
- Message bus fan-out updates both persistence and UI paths.

## Performance Feature Flag Path

`chatPerformanceV2` in privacy settings gates batched behavior in hot messaging flows:

- batched persistence writes,
- RAF-batched UI state updates,
- adaptive message list behavior,
- group realtime batching.
