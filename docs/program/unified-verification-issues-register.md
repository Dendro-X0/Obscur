# Unified verification — issues register

**Status:** Active — populate in **Phase C** after [unified-verification-matrix.md](./unified-verification-matrix.md)  
**Policy:** [concentrated-version-delivery.md](./concentrated-version-delivery.md)

This register is the **honest inventory of what does not work** (or what is accepted as a limitation) after a unified test round. It replaces ad-hoc “we fixed it” claims for rows that were never exercised.

---

## How to use

1. Run Phase B matrix; mark each row `[P]` `[F]` `[B]` `[S]` `[A]`.
2. For every `[F]`: add one row below (next `UV-###` ID).
3. For every `[A]`: add row with **Resolution = accepted_limitation** and link to limitation doc.
4. Triage **Severity** → next concentration unit backlog (do not block Phase A of the *next* unit on fixing every P2).

**Do not** delete rows — set **Status** to `fixed` or `wontfix` with commit/notes.

---

## Active pass (fill on first unified run)

| Field | Value |
|-------|--------|
| Concentration unit | `v1.9.x` |
| Matrix session date | |
| Git SHA | |
| Tester setup | Tester1 dark + Tester2 light / other |

---

## Issue register

| ID | Matrix ref | Area | Severity | Steps (short) | Expected | Observed | Resolution | Status | Notes / commit |
|----|------------|------|----------|---------------|----------|----------|------------|--------|----------------|
| *(add rows below)* | | | | | | | | `open` | |

**Severity:** `P0` blocks trustworthy use · `P1` severe UX/truth · `P2` polish/ops · `doc` copy/docs only  

**Resolution:** `open` · `fixed` · `accepted_limitation` · `wontfix` · `blocked_env`

---

## Pre-registered accepted limitations (do not re-open without evidence)

| ID | Topic | Doc | Re-test matrix row |
|----|-------|-----|-------------------|
| ACC-01 | Delete for me not durable across refresh/restore | [deletion-roster-limitations.md](../messaging/deletion-roster-limitations.md) §1 | DM-4 |
| ACC-02 | Roster multi-owner / MEM-001 architecture | Same doc §2 | COM-8 |

If unified pass shows **Pass** on these rows, change to `fixed` and update limitation doc — rare.

---

## Summary (after pass)

| Severity | Open | Fixed | Accepted | Blocked env |
|----------|------|-------|----------|-------------|
| P0 | | | | |
| P1 | | | | |
| P2 | | | | |

**Next concentration backlog:** *(top 3 IDs to address in Phase A of next unit)*

---

## Revision history

| Date | Change |
|------|--------|
| 2026-06-01 | Initial register template — Phase C for v1.9.x |
