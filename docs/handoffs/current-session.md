# Current Session Handoff

- Last Updated (UTC): 2026-05-21T21:40:00Z
- Session Status: **v1.7.0 shipped** (`v1.7.0` tag) — active **v1.7.1** patch band
- Active Owner: Maintainer — [v1.7.1-scope.md](../program/v1.7.1-scope.md)

## Active Objective

1. **v1.7.1:** Manual matrix Pass + regressions only ([demo matrix](../assets/demo/v1.7.0/README.md), A/B per [manual-verification-environment.md](../program/manual-verification-environment.md)).
2. **v1.8.x:** Blocked until v1.7.x band exit ([2.0 roadmap](../program/obscur-2.0-milestone-roadmap.md)).

## Next Atomic Step

1. Manual: matrix rows **P3-14/P3-15** + remainder ([demo matrix](../assets/demo/v1.7.0/README.md)) on Tester 1 (dark) + Tester 2 (light).
2. `pnpm release:workflow-status -- --tag v1.7.0` — wait for Full Release run **169** green.
3. Tag **v1.7.1** when matrix Pass + `release:test-pack` on clean `main` (mount fix on `main` pending push).

## Last shipped (v1.6.0)

- **G2.1–G2.4** — Governance projection owner, replay tests, ledger reasons, demo matrix.

## Continuity references

- [v1.7.1-scope.md](../program/v1.7.1-scope.md) (**active**)
- [v1.7.0-release.md](../releases/v1.7.0-release.md) · tag **v1.7.0**
- [obscur-2.0-milestone-roadmap.md](../program/obscur-2.0-milestone-roadmap.md)
- [v1.6.0-scope.md](../program/v1.6.0-scope.md) · [v1.6.0-gate.md](../releases/v1.6.0-gate.md)
