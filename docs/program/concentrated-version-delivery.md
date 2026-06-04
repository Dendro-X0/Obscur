# Concentrated version delivery (accelerated path to v2.0.0)

**Status:** Active maintainer policy (2026-06-01)  
**Supersedes for day-to-day gates:** per-slice manual Pass columns and “prove flawless before next feature” iteration.  
**Still required:** automated CI (`pnpm release:test-pack`, Vitest, typecheck) on every push.  
**North star:** [obscur-2.0-milestone-roadmap.md](./obscur-2.0-milestone-roadmap.md)

---

## Problem statement

Obscur has **many** open objectives before **v2.0.0**. Incremental “fix + manual prove perfect” loops are too slow when **most features are not yet reliably flawless**. Chasing perfection per slice blocks throughput without improving honest product truth.

**New contract:** Ship **one version band’s objectives** in a concentrated implementation push, then run **one unified verification round**, then record **everything that fails** in a single issues register — no pretense that untested areas are release-grade.

---

## Three phases (repeat per concentration unit)

| Phase | Name | Goal | Gate |
|-------|------|------|------|
| **A** | **Concentrated implementation** | Land **all in-scope objectives** for the active version | Vitest + typecheck + `pnpm release:test-pack` |
| **B** | **Unified verification** | Execute every row in [unified-verification-matrix.md](./unified-verification-matrix.md) once | Pass / Fail / Blocked / Skipped recorded per row |
| **C** | **Issues documentation** | File outcomes in [unified-verification-issues-register.md](./unified-verification-issues-register.md) | No silent failures; accepted limitations explicit |

**Do not** re-enter Phase A for unrelated polish until Phase B–C complete for the current unit (except P0 CI break/fix).

---

## Concentration unit (active)

| Field | Value |
|-------|--------|
| **Active band** | **v1.9.x** (Lane K — kernel + coordination backend) |
| **Predecessor** | v1.8.14 batch on `main` (implementation largely complete) |
| **Blocks v2.0 until** | Lane K exit K1–K6 ([v1.9.0-kernel-backend-roadmap.md](./v1.9.0-kernel-backend-roadmap.md)) |
| **After v1.9.x exit** | Next concentration unit = **v2.0.0 platform lane (P)** — same three phases |

### v1.9.x — Phase A backlog (engineering only)

Complete remaining scope rows; **do not** block on manual matrix during Phase A.

| Patch | Scope doc | Phase A remaining (if any) |
|-------|-----------|----------------------------|
| v1.9.0 B0 | [v1.9.0-scope.md](./v1.9.0-scope.md) | **Done** |
| v1.9.1 B1 | [v1.9.1-scope.md](./v1.9.1-scope.md) | **Done** |
| v1.9.2 B2 | [v1.9.2-scope.md](./v1.9.2-scope.md) | Code **done** — manual deferred to Phase B |
| v1.9.3 B3 | [v1.9.3-scope.md](./v1.9.3-scope.md) | Copy audit + automated tests — close in Phase A |
| v1.9.4 B4b | [v1.9.4-scope.md](./v1.9.4-scope.md) | R2 UI convergence — close optional follow-ups in Phase A |
| v1.9.5 B4a | [v1.9.5-scope.md](./v1.9.5-scope.md) | R1 port facade — close optional follow-ups in Phase A |

**Phase A exit:** All K-B* scope tables marked Done + `pnpm release:test-pack` green on `main`.

---

## What changes vs old process

| Old habit | New rule |
|-----------|----------|
| Manual demo matrix Pass after each patch | **One** Phase B pass per concentration unit |
| Fix REL/MEM row then prove in UI before next row | Land fixes in Phase A; prove in Phase B matrix row |
| Android APK loop during desktop work | **Postponed** — desktop primary ([stability-first-delivery.md](./stability-first-delivery.md)) |
| Known-issues queue “Open → fixed” per commit | Update register in **Phase C** after unified pass; engineering queue stays backlog-only during Phase A |
| Tag for CI-only or partial manual | Tag when concentration unit exits Phase A (+ maintainer choice); **v2.0.0** only after full 2.0 gate |

---

## Honest quality bar

| Statement | Policy |
|-----------|--------|
| “Feature works” | Requires Phase B row **Pass** (or explicit **Accepted limitation** in register) |
| “Implemented” | Phase A complete — may still Fail in Phase B |
| “Release-ready” | Concentration unit Phase B–C complete + 2.0 gate rows ([obscur-2.0-milestone-roadmap.md](./obscur-2.0-milestone-roadmap.md)) |
| DM-001 / MEM-001 | Remain **accepted limitations** unless unified pass proves otherwise — document in register, do not re-litigate in Phase A |

---

## Primary dev surface (Phase A)

```bash
pnpm dev:desktop:online
pnpm release:test-pack -- --skip-preflight   # local confidence
```

Mobile: **postponed** for Phase B Tier M until wrap-up ([android-p1-smoke-checklist.md](./android-p1-smoke-checklist.md)).

---

## Agent / maintainer default

1. Read **active concentration unit** in [current-session.md](../handoffs/current-session.md).
2. Phase A: implement scope doc rows only; automated gates green.
3. When Phase A exits: run [unified-verification-matrix.md](./unified-verification-matrix.md) top to bottom (desktop A/B minimum).
4. Phase C: every Fail → row in [unified-verification-issues-register.md](./unified-verification-issues-register.md); triage P0/P1 for next concentration unit.
5. Do **not** claim v2.0.0 readiness until 2.0 roadmap § gate is satisfied.

---

## Revision history

| Date | Change |
|------|--------|
| 2026-06-01 | Initial policy — v1.9.x concentration; unified matrix + issues register |
