# Community relaunch — master specification (Path B narrow)

**Status:** Active implementation spec (R0 documentation)  
**Last updated:** 2026-06-17  
**Decision:** [community-relaunch-decision-2026-06.md](./community-relaunch-decision-2026-06.md)  
**Issues:** [community-relay-technical-issues-register-2026-06.md](./community-relay-technical-issues-register-2026-06.md)  
**Kernel geometry:** [workspace-kernel-manifest.md](./workspace-kernel-manifest.md)

---

## 1. Problem statement

Managed-workspace communities fail in production-like A/B with **split success criteria**: membership UI, coordination directory, room keys, and relay publish evolve independently. Contract tests (`pnpm verify:workspace-kernel-w4`) pass while [`group-home-page-client.tsx`](../../apps/pwa/app/groups/[...id]/group-home-page-client.tsx) still mounts legacy roster and sealed-community parallel paths.

**Symptom class:** COM-RUN-01…08 in the issues register.

**Root cause class:** Multiple owners per lifecycle; no atomic join; no membership health read model; verify matrix rows at ◐ without COM-MEM-2 soak.

---

## 2. Target architecture

```text
┌─────────────────────────────────────────────────────────────┐
│ UI (group home, manage, composer)                             │
│  gates on CommunityMembershipHealth.ready                   │
└───────────────────────────┬─────────────────────────────────┘
                            │
┌───────────────────────────▼─────────────────────────────────┐
│ workspace-kernel/                                             │
│  membership-port (W1) — create/join/leave, room key, ledger   │
│  roster read (W3) — coordination projection only              │
│  write-port (W2) — sealed send                                │
│  membership-health (R2) — convergence snapshot                │
└───────────────────────────┬─────────────────────────────────┘
                            │
         ┌──────────────────┼──────────────────┐
         ▼                  ▼                  ▼
  apps/coordination   room-key-store    relay pool + activation
  (directory truth)   (profile scoped)  (chat transport)
```

When `isWorkspaceKernelAuthority()`:

- **Write** membership mutations only through `workspace-kernel-membership-port.ts`.
- **Read** roster/participants only through kernel roster index + coordination materialization.
- **Do not** merge page-local pubkey sets in group-home.

---

## 3. Specification index

| Spec | File | COM-RUN | Phase |
|------|------|---------|-------|
| Atomic join | [community-atomic-join-spec-2026-06.md](./community-atomic-join-spec-2026-06.md) | 02, 05 | R1 |
| Membership health | [community-membership-health-spec-2026-06.md](./community-membership-health-spec-2026-06.md) | 04, 06 | R2 |
| Roster read owner | [community-roster-read-owner-spec-2026-06.md](./community-roster-read-owner-spec-2026-06.md) | 01, 07, 10 | R3 |
| Relay transport binding | [community-relay-transport-binding-spec-2026-06.md](./community-relay-transport-binding-spec-2026-06.md) | 03 | R4 |
| Dev profiles | [community-dev-profiles-spec-2026-06.md](./community-dev-profiles-spec-2026-06.md) | 08 | R5 |
| Verification COM-MEM-2 | [community-verification-com-mem-2-spec-2026-06.md](./community-verification-com-mem-2-spec-2026-06.md) | 01–06 | R6 |

---

## 4. Issue → spec → phase map

| ID | Severity | Primary spec | Phase | Close criterion |
|----|----------|--------------|-------|-----------------|
| COM-RUN-01 | P0 | roster-read-owner | R3 | COM-MEM-2 step 5 Pass |
| COM-RUN-02 | P0 | atomic-join | R1 | COM-MEM-2 step 6 Pass |
| COM-RUN-03 | P0 | relay-transport-binding | R4 | COM-MEM-2 step 6 Pass |
| COM-RUN-04 | P1 | membership-health | R2 | Health banner + invite gate |
| COM-RUN-05 | P1 | atomic-join | R1 | No orphan group row on failed join |
| COM-RUN-06 | P1 | membership-health + verify | R2, R6 | Health snapshot + soak |
| COM-RUN-07 | P1 | roster-read-owner | R3 | W3 contract extended; ACC-02 superseded when V |
| COM-RUN-08 | P2 | dev-profiles | R5 | Docs + dev badge |
| COM-RUN-09 | P2 | — | — | **Closed** (build fix) |
| COM-RUN-10 | P2 | verify only | R6 | No further display repair; Pass or revert |

---

## 5. Phased execution

| Phase | Name | Code allowed | Gate before next |
|-------|------|--------------|------------------|
| **R0** | Documentation | None | Maintainer review of this suite |
| **R1** | Atomic join | `workspace-kernel-membership-port.ts`, invite accept, guest join subtraction | Join unit tests + rollback tests |
| **R2** | Membership health | `community-membership-health.ts`, group-home banner | Vitest + `groups.membership_health_snapshot` |
| **R4** | Relay binding | Join/create activation + relay list | Relay connected before join success (full-stack profile) |
| **R3** | Roster subtraction | group-home, group-management-dialog | W3 contract: no legacy roster hook when kernel on |
| **R6** | COM-MEM-2 | dev-lab scenario, matrix row, `verify:com-mem-2` | L4 Pass both profiles |
| **R5** | Dev profiles | Badge + docs | No production behavior change |

**Order note:** R4 before R3 matches plan — relay/chat prerequisites before roster-only subtraction. R6 validates end-to-end before R5 polish.

---

## 6. Verification commands (target)

| Phase | Minimum gate |
|-------|--------------|
| R0 | Docs cross-linked; handoff updated |
| R1 | `pnpm verify:workspace-kernel-w1` + new join rollback vitest |
| R2 | Targeted vitest on `community-membership-health` |
| R3 | `pnpm verify:workspace-kernel-w3` + extended contract |
| R4 | Targeted vitest on activation + relay binding |
| R6 | `pnpm verify:com-mem-2` (when stack up) + matrix COM-MEM-2 **Pass** |
| All | `pnpm verify:workspace-kernel` must stay green |

Process: [testing-and-issue-tracking-spec.md](./testing-and-issue-tracking-spec.md) L1→L4.

---

## 7. Out of scope

- Public-relay sovereign community fixes
- NIP-29 roster parity as product promise
- Further `community-participant-display-read-model` repair layers
- AUTH-SESSION-1 / desktop F5 restore
- v2.0 marketing until COM-MEM-2 **V**

---

## 8. Success criteria (R0)

- [x] Decision doc signed
- [x] Master spec + five module specs + verification spec exist
- [x] Issues register, invariants, handoff, UV register cross-linked
- [ ] Maintainer R0 review complete (manual)
- [ ] R1 implementation not started until review

---

## Revision history

| Date | Change |
|------|--------|
| 2026-06-17 | Initial master spec (Path B narrow relaunch) |
