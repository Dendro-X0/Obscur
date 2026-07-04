# Community atomic join specification (2026-06)

**Status:** R1 implementation spec  
**Phase:** R1 — [community-relaunch-master-spec-2026-06.md](./community-relaunch-master-spec-2026-06.md)  
**Resolves:** COM-RUN-02, COM-RUN-05  
**Owner:** `apps/pwa/app/features/workspace-kernel/workspace-kernel-membership-port.ts`

---

## 1. Problem

Join and materialize paths can persist **group list rows** and **membership status** without:

- `roomKeyStore.getRoomKey(groupId)`
- Coordination directory row for the actor
- Relay activation evidence (full-stack profile)

Result: member chrome, grey invite, send failures — split success (COM-RUN-05).

---

## 2. Canonical owner

| Operation | Function | File |
|-----------|----------|------|
| Create managed workspace | `createManagedWorkspaceMembership` | `workspace-kernel-membership-port.ts` |
| Join managed workspace | `joinManagedWorkspaceMembership` | same |
| Ledger mutation | `persistCommunityMembershipLedgerMutation` | `community-membership-mutation-owner.ts` |
| Room key persist | `roomKeyStore.saveRoomKey` | `room-key-store.ts` |

When `isWorkspaceKernelAuthority()` is true, **no other module** may commit join success.

Protocol reference: [23-private-direct-envelope-and-community-room-key-contract.md](../protocols/23-private-direct-envelope-and-community-room-key-contract.md)

---

## 3. Join success predicate

`JoinOutcome.status === "joined"` requires **all** of:

| # | Predicate | Evidence |
|---|-----------|----------|
| 1 | Room key | `roomKeyStore.getRoomKey(groupId)` non-empty after save |
| 2 | Coordination | Directory contains actor pubkey **or** explicit `pendingCoordination` with recovery UI (no silent partial) |
| 3 | Relay (full-stack) | `hasWritableCommunityRelayTransport(relayUrl)` and pool connected **or** coordination-only dev mode with chat explicitly disabled |
| 4 | Ledger | `persistCommunityMembershipLedgerMutation` only after 1–3 succeed |
| 5 | UI materialization | `createdGroups` / non-guest group-home only when [membership health](./community-membership-health-spec-2026-06.md) `ready === true` |

---

## 4. Rollback contract

If step *N* fails, steps *1…N−1* must not leave durable product state:

| Failed after | Roll back |
|--------------|-----------|
| Room key save | No ledger write; no `addGroup` |
| Coordination delta | Delete room key for this join attempt; no ledger |
| Relay publish (full-stack) | No ledger; optional `activation_pending` record with retry — not `joined` |
| Ledger | Remove group row if added in same transaction |

Return typed error to UI; do not toast generic success.

---

## 5. Route subtraction

When `isWorkspaceKernelAuthority()`:

| Current path | Action |
|--------------|--------|
| [`community-invite-card.tsx`](../../apps/pwa/app/features/groups/components/community-invite-card.tsx) `handleAccept` inline activation | Delegate to `joinManagedWorkspaceMembership` with invite `roomKeyHex` |
| [`group-home-page-client.tsx`](../../apps/pwa/app/groups/[...id]/group-home-page-client.tsx) `handleGuestJoin` / `requestJoinNip29` | Block or route through port with room-key requirement |
| Guest materialize effect (lines ~636–739) | Do not `addGroup` unless port join succeeded |
| [`group-join-dialog.tsx`](../../apps/pwa/app/features/groups/components/group-join-dialog.tsx) | Already routes to port (W1 contract) — keep as canonical |

---

## 6. Deliverables (R1)

| ID | Deliverable | Location |
|----|-------------|----------|
| J-1 | `JoinManagedWorkspaceResult` includes `health` snapshot | `workspace-kernel-membership-port.ts` |
| J-2 | Rollback helper for failed join | same or `community-membership-join-transaction.ts` |
| J-3 | Invite accept uses port only | `community-invite-card.tsx` |
| J-4 | Guest/materialize gated on port | `group-home-page-client.tsx` |
| J-5 | Vitest: join fails without room key → no ledger row | `workspace-kernel-w1-membership.test.ts` |
| J-6 | Vitest: join fails mid-coordination → no room key orphan | same |

---

## 7. Acceptance

- [ ] Tester2 accept-invite path saves room key before ledger
- [ ] Failed join does not add group to sidebar
- [ ] `groups.room_key_missing_send_blocked` rate drops to zero after successful port join
- [ ] COM-MEM-2 steps 4–6 pass (see verification spec)

---

## 8. Verification

```bash
pnpm verify:workspace-kernel-w1
pnpm -C apps/pwa exec vitest run app/features/workspace-kernel/workspace-kernel-w1-membership.test.ts
```

Runtime: COM-MEM-2 steps 3–6 ([community-verification-com-mem-2-spec-2026-06.md](./community-verification-com-mem-2-spec-2026-06.md)).

---

## Revision history

| Date | Change |
|------|--------|
| 2026-06-17 | Initial atomic join spec |
