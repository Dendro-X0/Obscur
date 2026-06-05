# Unified verification — issues register

**Status:** v1.9.x pass closed — **2026-06-01**  
**Policy:** [concentrated-version-delivery.md](./concentrated-version-delivery.md)

This register is the **honest inventory of what does not work** (or what is accepted as a limitation) after a unified test round.

---

## Active pass (v1.9.4 — Phase B open)

| Field | Value |
|-------|--------|
| Concentration unit | **v1.9.4** Phase B |
| Session start | 2026-06-01 (UTC) |
| Git SHA | `0105f406` + uncommitted STAB-1–3 + P4-5 docs |
| Handoff | [current-session.md](../handoffs/current-session.md) — **Active — Phase B** |
| §0 automated | **All Pass** (2026-06-01) |
| Manual | §1–§7 pending maintainer A/B desktop pass |

### Phase A resolutions (carried into Phase B)

| ID | Matrix ref | Area | Severity | Observed | Status |
|----|------------|------|----------|----------|--------|
| STAB-1 | AUTO-5 | main-shell | P0 | `groupState.messages` undefined | **fixed** (uncommitted) |
| STAB-2 | AUTO-5 | messaging-provider tests | P0 | `getProfileScopeOverride` mock missing | **fixed** (uncommitted) |
| STAB-3 | AUTO-5 | use-relay-list | P0 | Legacy 127.0.0.1:7001 test drift | **fixed** (uncommitted) |

### Open issues (Phase B manual — none filed yet)

| ID | Matrix ref | Area | Severity | Observed | Status |
|----|------------|------|----------|----------|--------|
| — | — | — | — | — | *Awaiting §1–§7 maintainer pass* |

---

## Previous pass (v1.9.x — closed 2026-06-01)

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
| P0 | 0 | 3 | 0 | 0 |
| P1 | 0 | 0 | 2 (ACC-01, ACC-02) | 0 |
| P2 | 0 | 0 | 0 | 0 |

**Next concentration unit:** **v1.9.4** Phase B manual pass — [unified-verification-matrix.md](./unified-verification-matrix.md) §1–§7.

---

## Revision history

| Date | Change |
|------|--------|
| 2026-06-01 | v1.9.4 Phase B opened — §0 all Pass; manual §1–§7 pending |
| 2026-06-01 | v1.9.4 Phase A opened — STAB-1 filed; handoff Active @ `0105f406` |
| 2026-06-01 | v1.9.x maintainer desktop pass — register closed with zero new failures |
| 2026-06-01 | Initial register template — Phase C for v1.9.x |
