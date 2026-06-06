# Unified verification — issues register

**Status:** v1.9.4 Phase B — **§0 + STAB-R + P4-5 + P5 + ACC-03/04 closed** @ `ab465e40`  
**Policy:** [concentrated-version-delivery.md](./concentrated-version-delivery.md) · [ui-render-loop-systemic-program.md](./ui-render-loop-systemic-program.md)

---

## Active pass (v1.9.4 — Phase B)

| Field | Value |
|-------|--------|
| Concentration unit | **v1.9.4** Phase B |
| Git SHA | `02f1cb1b` |
| Handoff | [current-session.md](../handoffs/current-session.md) |
| §0 + STAB-R + P4-5 | **Pass** — `pnpm verify:stability` + `release:test-pack` |
| Product manual | §1–§7 when needed — **not** render-loop hunting |

### Resolved (Phase A + STAB-R)

| ID | Matrix ref | Area | Severity | Status | Commit |
|----|------------|------|----------|--------|--------|
| STAB-1 | AUTO-5 | main-shell | P0 | **fixed** | `2a1badf7` |
| STAB-2 | AUTO-5 | messaging-provider tests | P0 | **fixed** | `2a1badf7` |
| STAB-3 | AUTO-5 | use-relay-list | P0 | **fixed** | `2a1badf7` |
| STAB-R | AUTO-5 | relay/window render loop | P0 | **fixed** | `2a1badf7` |

### Open issues (product — manual or automated row proof)

| ID | Matrix ref | Area | Severity | Status |
|----|------------|------|----------|--------|
| — | §1–§7 | product features | — | *No failures filed; ACC-01/02 accepted* |

---

## Pre-registered accepted limitations (unchanged)

| ID | Topic | Doc | Re-test matrix row |
|----|-------|-----|-------------------|
| ACC-01 | Delete for me not durable across refresh/restore | [deletion-roster-limitations.md](../messaging/deletion-roster-limitations.md) §1 | DM-4 |
| ACC-02 | Roster multi-owner / MEM-001 architecture | Same doc §2 | COM-8 |
| ACC-03 | ~~Relay sync checkpoints localStorage-only~~ **Resolved** — `relay-checkpoint-sqlite-store.ts` mirrors `dm:all` to SQLite on native | [obscur-native-sqlite-policy.md](./obscur-native-sqlite-policy.md) §Relay checkpoints | `relay-checkpoint-sqlite-store.test.ts` |
| ACC-04 | ~~Voice call records in-memory only~~ **Resolved** — terminal calls mirrored to SQLite via `call-record-sqlite-store.ts` | Same doc §Voice call records | `call-record-sqlite-store.test.ts` |

---

## Summary

| Severity | Open | Fixed | Accepted |
|----------|------|-------|----------|
| P0 | 0 | 4 (STAB*) | 0 |
| P1 | 0 | 0 | 4 (ACC-01–04) |

**Next:** Product matrix rows (DM/COM) when maintainer chooses — persistence and ancillary sqlite owners gated in CI; no open P1 ACC rows.

---

## Revision history

| Date | Change |
|------|--------|
| 2026-06-02 | P5 + ACC-03/04 shipped @ `ab465e40`; `verify:p5-persistence` 64 tests |
| 2026-06-02 | P4-5 subtraction + `release:test-pack` @ `02f1cb1b`; ACC-03/04 registered |
| 2026-06-02 | STAB-R closed @ `2a1badf7`; register synced |
| 2026-06-01 | v1.9.4 Phase B opened |
