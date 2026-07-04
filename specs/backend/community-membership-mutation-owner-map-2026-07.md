# REL-005 — Community membership ledger mutation owner map

**Status:** Accepted architecture (Phase 1A exit)  
**Date:** 2026-07-03 (UTC)  
**Maps to:** REL-005 · COM-RUN-07 (write slice only) · Lane T in [version-roadmap-scope.md](../../docs/program/version-roadmap-scope.md)  
**Proof:** `community-rel-005-mutation-owner.test.ts` · `transport-gateway-boundary-sec-v2.contract.test.ts`

---

## Summary

**One canonical live write funnel** for membership ledger mutations: `persistCommunityMembershipLedgerMutation` in `community-membership-mutation-owner.ts`. All user-intent and runtime-evidence ledger changes must pass through this module (or a typed facade that delegates to it).

**Out of scope for REL-005:** roster/membership **read** convergence (COM-RUN-07 / MEM-001) remains **accepted architecture** — multiple read surfaces until charter slice 1B and a future R2 read owner. This spec closes the **write** band only.

---

## Write owner hierarchy

```
┌─────────────────────────────────────────────────────────────────┐
│  UI / kernel / relay ingress / hydrate repair                   │
│  (group-provider, workspace-kernel-membership-port, leave, etc.) │
└────────────────────────────┬────────────────────────────────────┘
                             │
         ┌───────────────────┼───────────────────┐
         ▼                   ▼                   ▼
  descriptor-mutation   governance-mutation   coordinator evidence
  -owner                -owner                → applyCommunityMembershipRuntimeEvidence
         │                   │                   │
         └───────────────────┴───────────────────┘
                             │
                             ▼
              persistCommunityMembershipLedgerMutation  ← REL-005 canonical
                             │
                             ▼
              upsertCommunityMembershipLedgerEntry / replaceCommunityMembershipLedger
                             │
                             ▼
                    localStorage (profile-scoped + legacy default)
```

---

## Canonical owner

| ID | Module | Responsibility |
|----|--------|----------------|
| `community-membership-mutation-owner` | `community-membership-mutation-owner.ts` | Sole **live** mutation committer; logs `groups.membership_mutation_owner_committed` with `reason` |

**Entry points:**

| Function | When |
|----------|------|
| `persistCommunityMembershipLedgerMutation` | Single mutation commit |
| `applyCommunityMembershipLedgerMutations` | Batch from coordinator |
| `applyCommunityMembershipRuntimeEvidence` | Runtime evidence → coordinator → mutations |
| `persistExplicitCommunityMembershipLeave` | User leave (relay-confirmed or policy override) |
| `persistCommunityMembershipRosterTerminal` | Relay roster terminal snapshot |
| `persistCommunityMembershipDisband` | Community disband |

**Coordinator** (`community-membership-coordinator.ts`) decides *what* to write; mutation owner decides *how* to persist (including `explicit_rejoin` replace semantics).

---

## Typed facades (delegate only)

| ID | Module | Ledger `reason` values |
|----|--------|------------------------|
| `community-descriptor-mutation-owner` | `community-descriptor-mutation-owner.ts` | `descriptor_updated`, `governance_descriptor_accepted` |
| `community-governance-mutation-owner` | `community-governance-mutation-owner.ts` | `governance_member_expelled` |

No facade may call `upsertCommunityMembershipLedgerEntry` directly in production paths.

---

## Callers (production)

| Caller | Path |
|--------|------|
| `workspace-kernel-membership-port.ts` | Create/join managed workspace → `persistCommunityMembershipLedgerMutation` |
| `group-provider-legacy.tsx` | Relay-confirmed join/rejoin under workspace kernel authority |
| `community-relay-confirmed-leave.ts` | `persistExplicitCommunityMembershipLeave` |
| `community-membership-hydrate-repair.ts` | `applyCommunityMembershipRuntimeEvidence` |
| `community-leave-recovery.ts` | `applyCommunityMembershipRuntimeEvidence` |

**Contract pin:** `transport-gateway-boundary-sec-v2.contract.test.ts` asserts `group-provider` and `workspace-kernel-membership-port` import mutation owner, not raw `upsertCommunityMembershipLedgerEntry`.

---

## Bulk restore exceptions (not live mutations)

These paths **replace or merge full ledger snapshots** from backup/restore — not incremental user actions. Allowed; must not be used for join/leave/chat-time updates.

| Module | API | Trigger |
|--------|-----|---------|
| `restore-materialization.ts` | `saveCommunityMembershipLedger` | Account backup restore |
| `encrypted-account-backup-service.ts` | `saveCommunityMembershipLedger` | Backup merge apply |
| `encrypted-workspace-bundle-service.ts` | `replaceCommunityMembershipLedger` | Workspace bundle import |
| `data-root-group-metadata-repair.ts` | `saveCommunityMembershipLedger` | Maintainer metadata repair |

Restore does **not** bypass load-path repair/migration (`applyLedgerVersionMigrationOnLoad`, `repairIncompleteJoinedLedgerEntriesOnLoad`).

---

## Load-path maintenance (read → repair, not mutation owner)

| Step | Owner | Purpose |
|------|-------|---------|
| v1→v2 migration on load | `community-membership-ledger.ts` | `applyLedgerVersionMigrationOnLoad` |
| Field repair on load | `community-membership-ledger.ts` | `repairIncompleteJoinedLedgerEntriesOnLoad` (RIW-1) |
| Validation telemetry | `community-membership-ledger.ts` | `validateLedgerEntries` on load; log `invalidEntries` |

Maintenance runs inside `loadCommunityMembershipLedger` only — not from UI.

---

## Forbidden patterns

| Pattern | Why |
|---------|-----|
| Direct `upsertCommunityMembershipLedgerEntry` from UI/providers | Bypasses coordinator + `reason` diagnostics |
| `setCommunityMembershipStatus` in production (internals export) | Test-only; use mutation owner APIs |
| New parallel ledger writers for join/leave/descriptor | Violates REL-005; extend coordinator reasons instead |
| COM-RUN-02 room-key restore repair loops | **Cancelled** — see subtraction register |

---

## Mutation reasons (complete set)

From `CommunityMembershipLedgerMutationReason`:

`persisted_fallback_backfill` · `historical_restore_backfill` · `explicit_rejoin` · `explicit_leave` · `relay_roster_terminal` · `relay_disbanded` · `runtime_join_confirmed` · `descriptor_updated` · `governance_descriptor_accepted` · `governance_member_expelled`

New reasons require coordinator + mutation-owner test coverage.

---

## COM-RUN-07 boundary (read — deferred)

REL-005 **does not** merge these read surfaces (unchanged, **A** until R2):

- Coordination membership directory / materializer  
- Monotonic participant roster session  
- Known-participants localStorage OR-set  
- Page-local merges (`group-home-page-client`, `group-management-dialog`)  
- Sealed-community CRDT projection  

**PAUSED:** COM-RUN-01 roster parity patches. **Next product band:** Phase 1B charter crypto slice — may add crypto owners but must not add ledger write paths.

---

## Proof plan

| Layer | Command / artifact |
|-------|-------------------|
| L1 | `pnpm -C apps/pwa test:run community-rel-005-mutation-owner.test.ts` |
| L1 | `transport-gateway-boundary-sec-v2.contract.test.ts` |
| L2 | Grep: no production `upsertCommunityMembershipLedgerEntry` outside mutation-owner + ledger internals |
| L3 | Digest: `groups.membership_mutation_owner_committed` on join/leave actions (optional matrix row) |

---

## Phase 1A exit

With RIW-1 L3 pass (`invalidEntries=0`) and this owner map **accepted**, Phase 1A deliverable #4 is complete. Phase 1B may proceed only after maintainer picks charter slice A–D.
