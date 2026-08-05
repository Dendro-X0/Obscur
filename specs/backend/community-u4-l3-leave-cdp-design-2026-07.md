# Design — U4 L3 leave CDP proof

**Status:** Done · L3 Pass · 2026-07-31  
**Parent:** [community-u4-membership-write-collapse-design-2026-07.md](./community-u4-membership-write-collapse-design-2026-07.md)

---

## Session gate

```text
HANDOFF ATOMIC STEP:  Optional: U4 L3 leave CDP
PAUSED / CANCELLED:   Full community · COM-RUN-* · U5/U6 · Dev Lab as validation
CANONICAL OWNER:      leaveManagedWorkspaceMembership (workspace-kernel-leave-port)
PROOF BEFORE DONE:    pnpm verify:u4-l3 → test-results/u4-l3-leave-*.json l3.pass=true
OUT OF SCOPE:         U5/U6 · community un-pause · rejoin automation · claim Slice C still valid without rejoin
```

---

## Pass criteria

1. Tester1 unlocked on desktop CDP (`:9230`) with NewTest 2 joined.  
2. Navigate `/groups/leave` for NewTest 2 → click **Leave Community**.  
3. Toast / navigation success (network path).  
4. Membership ledger entry for groupId `b93f53e23d8c4456835afd3f4d3a627b` has `status: "left"`.  
5. App-event buffer shows `workspace.leave.committed` for that groupId (`obscurAppEvents.findByName` — leave events also registered in cross-device digest config after this run).

**Side effect:** NewTest 2 leave invalidates Slice C send fixture until re-joined.

---

## Evidence (2026-07-31)

| Layer | Result |
|-------|--------|
| UI | Toast **Left community.** → `/network` |
| Ledger | `status: "left"` |
| Leave port | `workspace.leave.committed` groupId=`b93f53…627b` tombstone=true |
| Report | `test-results/u4-l3-leave-2026-07-31.json` · `l3.pass=true` |

Harness: `apps/pwa/tests/e2e/u4-l3-leave-cdp.spec.ts` · `pnpm verify:u4-l3`

---

## Proof

```bash
# Stack: pnpm dev:desktop:online · Tester1 unlocked · NewTest 2 joined
pnpm verify:u4-l3
# Evidence: test-results/u4-l3-leave-2026-07-31.json
```

---

## Claim language

| May say | When |
|---------|------|
| U4 L3 Pass | Fresh JSON `l3.pass=true` this session |
| Community un-paused | **Never** |
| Slice C still Pass without rejoin | **Never** after leave |
