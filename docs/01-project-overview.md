# Project Overview

_Last reviewed: 2026-03-03 (baseline commit 7f57b32)._


## Current Stage

Obscur is an experimental alpha (current line: `v0.7.x-alpha`).

- Product quality target: stability and correctness before broad rollout.
- Delivery model: iterative alpha releases with feature flags for risky changes.

## Product Scope

Obscur is a local-first Nostr messenger focused on private communication:

- Direct messaging.
- Invite-only group/community messaging.
- Media/file attachments (NIP-96 providers).
- Desktop/mobile runtime via Tauri v2.

## Primary Runtime Components

- `apps/pwa`: main app surface (Next.js + React).
- `apps/desktop`: native shell/runtime (Tauri v2).
- `packages/*`: shared protocol, crypto, storage, and UI primitives.

## Important Principles

- Privacy-first defaults.
- Feature-flagged rollout for performance and behavioral changes.
- Incremental refactoring over disruptive rewrites in hot code paths.
- Keep docs synchronized with code and changelog.

## Cross-Reference

- Version history: [`CHANGELOG.md`](../CHANGELOG.md)
- Workspace root scripts: [`package.json`](../package.json)
