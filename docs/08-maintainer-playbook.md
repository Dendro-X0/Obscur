# Maintainer Playbook

_Last reviewed: 2026-03-03 (baseline commit 7f57b32)._


## Purpose

This document is optimized for long-term maintainers (human and AI).

## Change Strategy

- Prefer small, testable increments in core messaging paths.
- Add feature flags for behavior changes that can affect message correctness.
- Keep persistence, reducer logic, and rendering concerns separated.

## Where to Implement What

- New chat state behavior: `hooks/use-conversation-messages.ts`
- Persistence write strategy: `services/message-persistence-service.ts`
- Rendering/scroll behavior: `components/message-list.tsx`
- Group realtime/event shaping: `groups/hooks/use-sealed-community.ts`

## Documentation Rules

- Update docs in the same PR/commit as behavior changes.
- Include absolute file references when describing implementation details.
- Avoid speculative docs; only document behavior present in code.

## Regression Risk Areas

- Message ordering and dedupe.
- Delete/update race windows.
- Virtualized list rendering identity and rerenders.
- Group relay-scope filtering and event acceptance/rejection.
- Desktop vs PWA runtime differences.

## Deep References

- [Feature Change Maps (Deep References)](./10-feature-change-maps.md)


## Operational References

- [On-Call Quickstart (15-Minute Triage)](./15-on-call-quickstart.md)
- [Decision Log](./17-decision-log.md)
- [Docs Maintenance Standard](./18-docs-maintenance-standard.md)

