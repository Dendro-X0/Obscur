# Current Session Handoff

- Last Updated (UTC): 2026-05-22T02:12:00Z
- Session Status: **v1.8.3 active** — REL-004 T4-1/T4-3 implemented; matrix + tag pending
- Active Owner: Maintainer — [v1.8.3-scope.md](../program/v1.8.3-scope.md)

## Active Objective

1. **v1.8.3 REL-004 + MEM-002:** Leave outbox UX + observer roster honors sealed leave over chat history.
2. **Fix shipped:** participation filter no longer reverts `leftMembers`; invite uses eligible roster.
3. **Remaining:** re-test A leaves / B roster / re-invite (screenshot scenario), demo matrix, tag **v1.8.3**.

## Next Atomic Step

1. Manual matrix [v1.8.3](../assets/demo/v1.8.3/README.md) — leave with relay blocked, reload, retry.
2. `pnpm test:community-invariants` + `pnpm release:test-pack` on clean tree.
3. Tag **v1.8.3** → `pnpm version:bump patch` for **1.8.4**.

## Continuity references

- [v1.8.3-scope.md](../program/v1.8.3-scope.md)
- [v1.8.3-gate.md](../releases/v1.8.3-gate.md)
