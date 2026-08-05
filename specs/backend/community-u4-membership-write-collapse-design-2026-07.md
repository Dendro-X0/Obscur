# Design — U4 Membership write collapse

**Status:** Done (Wave A L1 + Wave B + L3 leave) · 2026-07-31  
**Parent:** [community-unpause-integration-study-2026-07.md](./community-unpause-integration-study-2026-07.md) §6 U4  
**Depends:** [community-membership-mutation-owner-map-2026-07.md](./community-membership-mutation-owner-map-2026-07.md) (REL-005 ledger funnel — keep)

---

## Session gate

```text
HANDOFF ATOMIC STEP:  U4 Membership write collapse (maintainer pick)
PAUSED / CANCELLED:   Full community · COM-RUN-* · O-2/O-4 · RIW-8 · Dev Lab as validation · U5/U6
CANONICAL OWNER:      workspace-kernel-membership-port (+ leave port) for user join/leave orchestration
PROOF BEFORE DONE:    verify:workspace-kernel + U4 contract (L1) · L3 leave CDP (Done 2026-07-31)
OUT OF SCOPE:         Roster read merge (COM-RUN-01/07) · U5 UI · U2 group persist engine · bulk restore writers
```

---

## Goal

Under workspace-kernel authority, **one orchestration owner** for user **join** and **leave** lifecycle:

| Layer | Owner |
|-------|--------|
| User join/create orchestration | `workspace-kernel-membership-port` (`createManagedWorkspaceMembership` / `joinManagedWorkspaceMembership`) |
| User leave orchestration | Extend leave into membership/leave port — **network + local commit** in one API |
| Ledger byte commit | Unchanged: `community-membership-mutation-owner` (REL-005) |
| Bulk restore / load repair | Unchanged exceptions from REL-005 map |

**Not** “delete mutation-owner.” Collapse means **subtract parallel UI/provider orchestration**, not invent a second ledger writer.

---

## Facts (current)

| Path | Role today | U4 problem |
|------|------------|------------|
| `joinManagedWorkspaceMembership` / `createManagedWorkspaceMembership` | Join/create → activation + `persistCommunityMembershipLedgerMutation` | Keep |
| `group-provider-legacy` join/rejoin block | Also calls `persistCommunityMembershipLedgerMutation` (`runtime_join_confirmed` / `explicit_rejoin`) | **Parallel join write** under kernel |
| `publishWorkspaceKernelLeave` | Network leave only | Local commit still via provider |
| `GroupProvider.leaveGroup` → `commitCommunityLeaveAfterRelayConfirmation` | Local ledger + tombstone + sidebar | **Leave split** across leave-port + provider |
| `groups/leave/page.tsx` | Calls leave-port then `leaveGroup(relayConfirmed)` | Couples UI to provider commit |
| Settings destructive actions | Imports `persistExplicitCommunityMembershipLeave` (re-export) | **Bypass** membership/leave port |
| `use-sealed-community-legacy.leaveGroup` | Network publish only | OK if product leave always goes through port |
| Evidence/hydrate/relationship-sync | `applyCommunityMembershipRuntimeEvidence` | Keep — not user join/leave orchestration |

---

## Mental simulation (one leave)

1. User confirms leave on `/groups/leave`.  
2. Port publishes coordination/relay leave evidence (`publishRelayConfirmedCommunityLeave`).  
3. On success, **same port** commits local leave via mutation-owner (`persistExplicitCommunityMembershipLeave` / commit helper) + tombstone/sidebar removal API.  
4. Provider `leaveGroup` under kernel authority **refuses** or becomes a thin delegate to the port — no independent ledger write.  
5. Neighbor: backup restore still uses `saveCommunityMembershipLedger` bulk path (not this slice).

One join (invite accept): UI → `joinManagedWorkspaceMembership` only; provider must not also upsert joined under kernel.

---

## Change plan (subtraction)

### Wave A — Contracts + refuse (smallest)

1. Add `leaveManagedWorkspaceMembership` (name TBD) on membership-port **or** expand `workspace-kernel-leave-port` to:
   - call `publishRelayConfirmedCommunityLeave`
   - on success call `commitCommunityLeaveAfterRelayConfirmation` (+ sidebar removal callback or kernel metadata remove)
2. Under `isWorkspaceKernelAuthority()`:
   - `GroupProvider.leaveGroup` → delegate to port **or** no-op with diagnostic if called without going through port (prefer: leave page calls port only; provider refuse independent leave writes)
   - Provider join/rejoin ledger upsert → **refuse** when kernel authority (join already confirmed via membership-port)
3. Settings destructive leave → call leave port, not raw `persistExplicitCommunityMembershipLeave`
4. Contract test `workspace-kernel-u4-membership-write.contract.test.ts`:
   - product leave/join UI imports port APIs
   - under kernel, provider source does not call `persistCommunityMembershipLedgerMutation` for join/rejoin (or gated refuse)
   - no settings path importing mutation leave without port

### Wave B — Delete dead branches (only after Wave A green)

Remove unreachable provider join-write / dual leave commit once contracts prove sole path.

---

## Proof

```bash
# L1
pnpm verify:workspace-kernel
pnpm -C apps/pwa exec vitest run \
  app/features/workspace-kernel/workspace-kernel-u4-membership-write.contract.test.ts \
  app/features/workspace-kernel/workspace-kernel-membership-join.test.ts \
  app/features/groups/services/community-rel-005-mutation-owner.test.ts \
  app/features/groups/services/community-leave-path-audit.test.ts \
  app/features/runtime/services/transport-gateway-boundary-sec-v2.contract.test.ts

# L3 (optional this charter — do not claim leave fixed without it)
# CDP: leave NewTest 2 → ledger status left + coordination leave delta
```

---

## Claim language

| May say | When |
|---------|------|
| U4 L1 Done | Wave A contracts + `verify:workspace-kernel` Pass |
| U4 leave fixed (runtime) | L3 CDP leave Pass |
| Community un-paused / roster fixed | **Never** from U4 alone |
| REL-005 replaced | **Never** — mutation-owner stays ledger committer |

---

## Closeout evidence — Wave A (2026-07-31)

- `leaveManagedWorkspaceMembership` on leave-port: network → `commitCommunityLeaveAfterRelayConfirmation` → metadata remove
- Provider: no join ledger write under kernel; `leaveGroup` sidebar-only under kernel
- Leave page + settings bulk leave route through leave port under kernel
- `pnpm verify:workspace-kernel` Pass · U4 contract + REL-005 + leave-path-audit + SEC-V2 Pass
- **Claimed:** L3 leave CDP Pass — `test-results/u4-l3-leave-2026-07-31.json`
- **Not claimed:** community un-pause · Slice C without NewTest 2 rejoin

### Wave B (2026-07-31)

- Provider join ledger write removed · leave/purge best-effort via `leaveManagedWorkspaceMembership`
- Spec: [community-u4-wave-b-deletion-design-2026-07.md](./community-u4-wave-b-deletion-design-2026-07.md)
- Proof: `pnpm verify:workspace-kernel` Pass

---

## Neighbor risk

| Neighbor | Must not regress |
|----------|------------------|
| REL-005 | All live ledger writes still via mutation-owner |
| Slice C / U3 | Join still publishes room-key wrap via activation |
| Backup restore | Bulk `saveCommunityMembershipLedger` unchanged |
| COM-RUN-01 | No roster UI parity work |
