# Unified verification — issues register

**Status:** v1.9.5 Phase A open — v1.9.4 Phase C closed · **SEC band blocks v2.0 prep**  
**Policy:** [testing-and-issue-tracking-spec.md](./testing-and-issue-tracking-spec.md) · [concentrated-version-delivery.md](./concentrated-version-delivery.md) · [ui-render-loop-systemic-program.md](./ui-render-loop-systemic-program.md)

---

## Active pass (v1.9.5 — Phase A)

| Field | Value |
|-------|--------|
| Concentration unit | **v1.9.5** — trust, anti-fraud/bot, security validation |
| Git SHA | `015fc3b3` |
| Handoff | [current-session.md](../handoffs/current-session.md) |
| v1.9.4 exit | **Pass** — programmatic + maintainer client community verification |
| SEC implementation | **Phase A programmatic complete** — `pnpm verify:sec-v1.9.5` (SEC-V1–V5 + SEC-F/B/R gates); maintainer manual rows Phase B–C |
| v2.0 pipeline | **Blocked** until v1.9.5 Phase B–C maintainer sign-off |

### SEC band programmatic exit (v1.9.5 Phase A)

| Band | Gate | Status | Notes |
|------|------|--------|-------|
| SEC-F / SEC-B | `pnpm verify:trust-v1.9.5` | **Pass (programmatic)** | Recipient-local trust + bot triggers |
| SEC-R | `pnpm verify:relay-v1.9.5` | **Pass (programmatic)** | Operator bundle, relay scorer, stack doc, publish honesty |
| SEC-V1 | `pnpm verify:sec-v1-v1.9.5` | **Pass (programmatic)** | E2EE boundary grep + contracts |
| SEC-V2 | `pnpm verify:sec-v2-v1.9.5` | **Pass (programmatic)** | Transport + gateway boundaries |
| SEC-V3 | `pnpm verify:sec-v3-v1.9.5` | **Pass (programmatic)** | AUTH-4 / REL-003 isolation |
| SEC-V4 | `pnpm verify:sec-v4-v1.9.5` | **Pass (programmatic)** | AB-15 / COM-10 restore leak |
| SEC-V5 | `pnpm verify:sec-v1.9.5` | **Pass (programmatic)** | Umbrella + exit contract; maintainer checklist §1–§5 manual |

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
| 2026-06-11 | Phase B programmatic: platform-kernels + community-invariants 97/97; runtime membership-join-leave blocked on coordination startup |
| 2026-06-11 | v1.9.4 Phase C closed; v1.9.5 SEC band active — blocks v2.0 prep |
| 2026-06-11 | `verify:phase-b-full` Pass; Path B contract tests updated for join-evidence + W2 delegate |
| 2026-06-08 | SEC-V1–V5 programmatic gates wired — `pnpm verify:sec-v1.9.5`; maintainer manual checklist §1–§5 + Phase B matrix remain |
