# Obscur v2 — Phase 2 documentation structure charter

**Status:** **EXIT 2026-07-04**  
**Prerequisite:** Phase 1 product verification **EXIT** (2026-07-04)  
**Pipeline source:** [v2.0-release-pipeline.md](../archive/program/inactive-2026-06/v2.0-release-pipeline.md) § Phase 2  
**Roadmap:** [obscur-v2-roadmap-2026-07.md](./obscur-v2-roadmap-2026-07.md)

---

## Exit criterion

Maintainer can answer **what works, what does not, and how to build** in **≤3 hops** from [docs/README.md](../README.md). `pnpm docs:check` green. No Phase 3–5 work required to understand product limits.

---

## Task rows

| ID | Task | Exit | Status |
|----|------|------|--------|
| **D2-1** | **Canonical index** — single entry from `docs/README.md` → v2 roadmap + scope + limitations | No competing “start here” paths | **Done** 2026-07-04 |
| **D2-2** | **Retire redundancy** — archive superseded queues; fix broken relative links | `pnpm docs:check` green | **Done** 2026-07-04 |
| **D2-3** | **Limitations sheet** — Phase 1 **A** bands + ACC rows in one presenter doc | [obscur-v2-known-limitations.md](./obscur-v2-known-limitations.md) linked from README | **Done** 2026-07-04 |
| **D2-4** | **SQLite / platform honesty** — P3 gap owners per native policy | Gap list closed or **A** in register | **Done** (Phase 1D) |
| **D2-5** | **Install/build docs** — desktop packaging + Android runbook aligned with Phase 3 | No contradictory install stories | **Done** 2026-07-04 — [obscur-v2-install-build-guide.md](./obscur-v2-install-build-guide.md) |

Work **one row at a time**. Handoff names active row.

---

## Canonical navigation (≤3 hops)

```text
docs/README.md
  → docs/CURRENT.md          (what is true today)
  → docs/handoffs/current-session.md   (next atomic step)
  → docs/program/obscur-v2-known-limitations.md   (honest limits)
  → docs/program/version-roadmap-scope.md         (I/V/A register)
  → docs/program/obscur-v2-roadmap-2026-07.md     (phase queue)
```

**Do not boot from:** `docs/archive/**` except via explicit links from active docs.

---

## Historical docs (do not treat as active queue)

| Doc | Note |
|-----|------|
| [v1.5.0-known-issues-and-investigation-queue.md](../archive/program/inactive-2026-06/v1.5.0-known-issues-and-investigation-queue.md) | Status column **stale (2026-05-15)** — use [version-roadmap-scope.md](./version-roadmap-scope.md) |
| [v2.0-release-pipeline.md](../archive/program/inactive-2026-06/v2.0-release-pipeline.md) | Phase definitions — active queue is [obscur-v2-roadmap-2026-07.md](./obscur-v2-roadmap-2026-07.md) |

---

## Proof

| Layer | Command |
|-------|---------|
| L1 | `pnpm docs:check` |
| Maintainer | Spot-check 3-hop paths from README for build, limits, and phase status |

---

## Revision history

| Date | Change |
|------|--------|
| 2026-07-04 | **Phase 2 EXIT** — D2-5 install/build guide; all rows complete |
| 2026-07-04 | Phase 2 opened — D2-1/D2-2/D2-3 started after Phase 1 EXIT |
