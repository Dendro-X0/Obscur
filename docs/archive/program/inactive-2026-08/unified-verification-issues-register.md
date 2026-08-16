# Unified verification — issues register

**Status:** v1.9.5 Phase A open — v1.9.4 Phase C closed · **SEC band blocks v2.0 prep**  
**Policy:** [testing-and-issue-tracking-spec.md](../archive/program/inactive-2026-06/testing-and-issue-tracking-spec.md) · [concentrated-version-delivery.md](./concentrated-version-delivery.md) · [ui-render-loop-systemic-program.md](../archive/program/inactive-2026-06/ui-render-loop-systemic-program.md)

---

## Active pass (v1.9.5 — Phase A)

| Field | Value |
|-------|--------|
| Concentration unit | **v1.9.5** — trust, anti-fraud/bot, security validation |
| Git SHA | `6fa015fd` |
| Handoff | [current-session.md](../handoffs/current-session.md) |
| v1.9.4 exit | **Pass** — programmatic + maintainer client community verification |
| SEC implementation | **Phase A programmatic complete** — SEC-V1/V2/V3/relay/trust/V5 **Pass** @ `4d000257`; SEC-V4 **Accepted** @ REL-002 (AB-15 restore contract drift) |
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

| ID | Matrix ref | Area | Severity | Status | Spec |
|----|------------|------|----------|--------|------|
| COM-RUN-01 | COM-MEM-2 | community roster | P0 | **Accepted** | [roster-read-owner](../archive/program/inactive-2026-06/community-roster-read-owner-spec-2026-06.md) · Phase 1D row 1 **A** @ ACC-02 (2026-07-04) |
| COM-RUN-02 | COM-MEM-2 | room key / join | P0 | Open | [atomic-join](../archive/program/inactive-2026-06/community-atomic-join-spec-2026-06.md) |
| COM-RUN-03 | COM-MEM-2 | relay publish | P0 | **Verified Pass** (2026-06-25) | [relay-transport-binding](../archive/program/inactive-2026-06/community-relay-transport-binding-spec-2026-06.md) |
| COM-RUN-04 | COM-MEM-2 | membership UX | P1 | **Mitigated** (2026-06-25) | [membership-health](../archive/program/inactive-2026-06/community-membership-health-spec-2026-06.md) |
| COM-RUN-05 | COM-MEM-2 | partial join | P1 | Open | [atomic-join](../archive/program/inactive-2026-06/community-atomic-join-spec-2026-06.md) |
| COM-RUN-06 | COM-MEM-2 | drift detection | P1 | Open | [membership-health](../archive/program/inactive-2026-06/community-membership-health-spec-2026-06.md) |
| COM-RUN-07 | COM-8 / ACC-02 | multi-owner | P1 | Open | [roster-read-owner](../archive/program/inactive-2026-06/community-roster-read-owner-spec-2026-06.md) |
| COM-RUN-08 | — | dev env | P2 | Open | [dev-profiles](../archive/program/inactive-2026-06/community-dev-profiles-spec-2026-06.md) |
| COM-RUN-10 | COM-MEM-2 | display repair | P2 | Verify pending | [COM-MEM-2](../archive/program/inactive-2026-06/community-verification-com-mem-2-spec-2026-06.md) |

Register: [community-relay-technical-issues-register-2026-06.md](./community-relay-technical-issues-register-2026-06.md)

---

## Pre-registered accepted limitations (unchanged)

Presenter sheet: [obscur-v2-known-limitations.md](./obscur-v2-known-limitations.md)

| ID | Topic | Doc | Re-test matrix row |
|----|-------|-----|-------------------|
| ACC-01 | Delete for me not durable across refresh/restore | [deletion-roster-limitations.md](../messaging/deletion-roster-limitations.md) §1 | DM-4 |
| ACC-02 | Roster multi-owner / MEM-001 architecture | Same doc §2 · [community-roster-read-owner-spec-2026-06.md](../archive/program/inactive-2026-06/community-roster-read-owner-spec-2026-06.md) | COM-8 · **COM-MEM-2** |
| ACC-03 | ~~Relay sync checkpoints localStorage-only~~ **Resolved** — `relay-checkpoint-sqlite-store.ts` mirrors `dm:all` to SQLite on native | [obscur-native-sqlite-policy.md](./obscur-native-sqlite-policy.md) §Relay checkpoints | `relay-checkpoint-sqlite-store.test.ts` |
| ACC-04 | ~~Voice call records in-memory only~~ **Resolved** — terminal calls mirrored to SQLite via `call-record-sqlite-store.ts` | Same doc §Voice call records | `call-record-sqlite-store.test.ts` |

---

## Summary

| Severity | Open | Fixed | Accepted |
|----------|------|-------|----------|
| P0 | 0 | 4 (STAB*) | 0 |
| P1 | 7 (COM-RUN) | 0 | 5 (ACC-01–04 + COM-RUN-01) |

**Next:** Product matrix rows (DM/COM) when maintainer chooses — persistence and ancillary sqlite owners gated in CI; no open P1 ACC rows.

---

## Revision history

| Date | Change |
|------|--------|
| 2026-07-04 | Phase 1D row 2 SEC sign-off; e2ee + transport allowlist fixes |
| 2026-07-04 | Phase 1D row 1 — COM-RUN-01 **Accepted** @ ACC-02; lane K/C/T closure |
| 2026-06-02 | P5 + ACC-03/04 shipped @ `ab465e40`; `verify:p5-persistence` 64 tests |
| 2026-06-02 | P4-5 subtraction + `release:test-pack` @ `02f1cb1b`; ACC-03/04 registered |
| 2026-06-02 | STAB-R closed @ `2a1badf7`; register synced |
| 2026-06-11 | Phase B programmatic: platform-kernels + community-invariants 97/97; runtime membership-join-leave blocked on coordination startup |
| 2026-06-11 | v1.9.4 Phase C closed; v1.9.5 SEC band active — blocks v2.0 prep |
| 2026-06-11 | `verify:phase-b-full` Pass; Path B contract tests updated for join-evidence + W2 delegate |
| 2026-06-17 | Path B relaunch R0 specs; COM-RUN-01…08 filed with spec links |
| 2026-06-08 | SEC-V1–V5 programmatic gates wired — `pnpm verify:sec-v1.9.5`; maintainer manual checklist §1–§5 + Phase B matrix remain |
