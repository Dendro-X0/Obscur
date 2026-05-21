# Current Session Handoff

- Last Updated (UTC): 2026-05-22T02:00:00Z
- Session Status: **v1.8.3 active** — Lane T **REL-004** leave durability
- Active Owner: Maintainer — [v1.8.3-scope.md](../program/v1.8.3-scope.md)

## Active Objective

1. **Shipped:** **v1.8.2** on `main` (`0358f3d7`) — Phase 4.2 manage hub + intelligent warm-up (tag when ready).
2. **v1.8.3:** **REL-004** — durable leave intent + honest pending-relay UX + outbox retry evidence.
3. **MEM-001 park** — no new roster features; honesty fixes only inside REL/MEM Lane T scope.

## Next Atomic Step

1. Audit leave paths (**T4-1**): confirm every path enqueues outbox before relay publish.
2. Add **pending leave publish** UI (**T4-3**) on Network or group home when outbox item exists.
3. Run leave outbox vitest slice + `pnpm test:community-invariants` → desktop matrix **T4-1–T4-5** → tag **v1.8.3**.

## Continuity references

- [v1.8.3-scope.md](../program/v1.8.3-scope.md) (**active**)
- [v1.8.2-release.md](../releases/v1.8.2-release.md)
- [v1.5.0-known-issues-and-investigation-queue.md](../program/v1.5.0-known-issues-and-investigation-queue.md) — REL-004 row
- [obscur-2.0-milestone-roadmap.md](../program/obscur-2.0-milestone-roadmap.md)
