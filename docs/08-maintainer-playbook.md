# 08 Maintainer Playbook and Continuation Handoff

_Last reviewed: 2026-03-17 (baseline commit 1f075aa)._

This file is the minimal context needed to resume the project after a pause.

## Current State Snapshot

- Cross-platform beta release pipeline is wired through GitHub Releases.
- Runtime architecture has moved toward explicit ownership and contract-first behavior.
- Docs were intentionally compacted to reduce maintenance overhead and token cost.

## Confirmed Ongoing Problem Areas

See `ISSUES.md` for user-facing language. Engineering focus remains:

1. Cross-device account/session consistency (password/session restore behavior).
2. Direct-message history consistency after device/account synchronization.
3. Relay instability handling under partial outages.

## Default Recovery Heuristic

When a core flow breaks:

1. Identify canonical owner module.
2. List all parallel code paths mutating the same state.
3. Remove or isolate non-canonical mutations.
4. Add diagnostics at the canonical boundary.
5. Repair behavior only after ownership is clear.

## High-Value Debug Surfaces

- Runtime and app events: `apps/pwa/app/shared/log-app-event.ts`
- Reliability metrics: `apps/pwa/app/shared/reliability-observability.ts`
- Relay observability: `apps/pwa/app/features/relays/services/relay-resilience-observability.ts`
- Messaging diagnostics: `apps/pwa/app/features/messaging/services/delivery-diagnostics-store.ts`

## Change Discipline

- Prefer subtraction over compatibility layering.
- Avoid hidden singleton assumptions for profile/account scope.
- Treat sender-local optimistic state as provisional only.
- Keep release claims tied to runtime evidence, not just passing tests.

## Resume Checklist

1. Pull latest `main` and run `pnpm install`.
2. Run `pnpm docs:check`.
3. Run `pnpm ci:scan:pwa:head` before major pushes.
4. Validate target flow in two-user reasoning terms (sender and receiver state).
5. Update `ISSUES.md` and these docs when architecture truth changes.
