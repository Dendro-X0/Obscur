# Unified verification — issues register

**Status:** v1.9.x pass closed — **2026-06-01**  
**Policy:** [concentrated-version-delivery.md](./concentrated-version-delivery.md)

This register is the **honest inventory of what does not work** (or what is accepted as a limitation) after a unified test round.

---

## Active pass (v1.9.x — closed)

| Field | Value |
|-------|--------|
| Concentration unit | `v1.9.x` (Lane K) |
| Matrix session date | 2026-06-01 (UTC) |
| Git SHA | `37320382` |
| Tester setup | Maintainer desktop client-side unified pass |
| Outcome | **Pass** — no new `UV-*` failures filed |

---

## Issue register

| ID | Matrix ref | Area | Severity | Steps (short) | Expected | Observed | Resolution | Status | Notes / commit |
|----|------------|------|----------|---------------|----------|----------|------------|--------|----------------|
| — | — | — | — | — | — | — | — | — | *No new failures this pass* |

**Severity:** `P0` blocks trustworthy use · `P1` severe UX/truth · `P2` polish/ops · `doc` copy/docs only  

**Resolution:** `open` · `fixed` · `accepted_limitation` · `wontfix` · `blocked_env`

---

## Pre-registered accepted limitations (unchanged)

| ID | Topic | Doc | Re-test matrix row |
|----|-------|-----|-------------------|
| ACC-01 | Delete for me not durable across refresh/restore | [deletion-roster-limitations.md](../messaging/deletion-roster-limitations.md) §1 | DM-4 |
| ACC-02 | Roster multi-owner / MEM-001 architecture | Same doc §2 | COM-8 |

Maintainer pass did not promote these to **fixed** — limitations remain documented product truth until a future pass proves otherwise.

---

## Summary (v1.9.x pass)

| Severity | Open | Fixed | Accepted | Blocked env |
|----------|------|-------|----------|-------------|
| P0 | 0 | 0 | 0 | 0 |
| P1 | 0 | 0 | 2 (ACC-01, ACC-02) | 0 |
| P2 | 0 | 0 | 0 | 0 |

**Next concentration backlog (v2.0 Lane P — Phase A):** SQLite convergence owners, Android install path (wrap-up), platform parity documentation per [obscur-2.0-milestone-roadmap.md](./obscur-2.0-milestone-roadmap.md).

---

## Revision history

| Date | Change |
|------|--------|
| 2026-06-01 | v1.9.x maintainer desktop pass — register closed with zero new failures |
| 2026-06-01 | Initial register template — Phase C for v1.9.x |
