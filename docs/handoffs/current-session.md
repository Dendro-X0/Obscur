# Current Session Handoff

- Last Updated (UTC): 2026-05-21T21:40:00Z
- Session Status: **v1.7.0 shipped** (`v1.7.0` tag) — active **v1.7.1** patch band
- Active Owner: Maintainer — [v1.7.1-scope.md](../program/v1.7.1-scope.md)

## Active Objective

1. **v1.7.1:** Manual matrix Pass + regressions only ([demo matrix](../assets/demo/v1.7.0/README.md), A/B per [manual-verification-environment.md](../program/manual-verification-environment.md)).
2. **v1.8.x:** Blocked until v1.7.x band exit ([2.0 roadmap](../program/obscur-2.0-milestone-roadmap.md)).

## Next Atomic Step

1. Execute v1.7.0 demo matrix on desktop Tester 1 (dark) + Tester 2 (light).
2. Fix failures → patch tag `v1.7.2` if needed; else close v1.7.x when all rows Pass.
3. Gates per patch: typecheck, lint, `test:community-invariants`, `release:test-pack`.

## Last shipped (v1.6.0)

- **G2.1–G2.4** — Governance projection owner, replay tests, ledger reasons, demo matrix.

## Continuity references

- [v1.7.1-scope.md](../program/v1.7.1-scope.md) (**active**)
- [v1.7.0-release.md](../releases/v1.7.0-release.md) · tag **v1.7.0**
- [obscur-2.0-milestone-roadmap.md](../program/obscur-2.0-milestone-roadmap.md)
- [v1.6.0-scope.md](../program/v1.6.0-scope.md) · [v1.6.0-gate.md](../releases/v1.6.0-gate.md)
