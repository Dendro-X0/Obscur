# Design — U4 Wave B dead-branch deletion

**Status:** Done · 2026-07-31  
**Parent:** [community-u4-membership-write-collapse-design-2026-07.md](./community-u4-membership-write-collapse-design-2026-07.md)

---

## Session gate

```text
HANDOFF ATOMIC STEP:  Optional: U4 Wave B dead-branch delete
PAUSED / CANCELLED:   Full community · COM-RUN-* · U5/U6 · Dev Lab as validation
CANONICAL OWNER:      workspace-kernel leave/membership ports
PROOF BEFORE DONE:    verify:workspace-kernel + U4 contract + SEC-V2 + leave-path-audit
OUT OF SCOPE:         Delete web non-kernel leaveGroup commit · L3 leave CDP · delete _settings-original.tsx whole file
```

---

## Facts

| Branch | Reachability | Wave B |
|--------|--------------|--------|
| Provider `addGroup` ledger write (`!kernel && relayConfirmed`) | Join dialog passes `relayConfirmed: workspaceKernelJoin` (false off-kernel); invite uses `applyCommunityMembershipRuntimeEvidence` off-kernel | **Delete** write block |
| Provider `leaveGroup` non-kernel commit | Web / ALLOW_LEGACY still needs it | **Keep** |
| `executeWorkspaceKernelLeave` | No callers | **Delete** |
| Leave/purge best-effort `publishWorkspaceKernelLeave` before forcePurge | Dual network-only then local nuclear | Prefer **`leaveManagedWorkspaceMembership`** (commit if network ok) then forcePurge |
| SEC-V2 expects provider `persistCommunityMembershipLedgerMutation` | False after delete | **Update** contract |

---

## Change

1. Remove provider join ledger upsert block + unused imports.  
2. Remove `executeWorkspaceKernelLeave`.  
3. Leave delete-local + purge page: call `leaveManagedWorkspaceMembership` (catch false) instead of publish-only.  
4. Update U4 / SEC-V2 / W1 exit contracts.  
5. Append Wave B closeout on parent U4 design.

---

## Proof

```bash
pnpm verify:workspace-kernel
pnpm -C apps/pwa exec vitest run \
  app/features/workspace-kernel/workspace-kernel-u4-membership-write.contract.test.ts \
  app/features/runtime/services/transport-gateway-boundary-sec-v2.contract.test.ts \
  app/features/groups/services/community-leave-path-audit.test.ts \
  app/features/workspace-kernel/workspace-kernel-w1-exit.contract.test.ts
```

---

## Claim language

| May say | When |
|---------|------|
| U4 Wave B Done | Contracts green; provider has no join ledger write |
| Leave fixed L3 | Never from Wave B alone |

---

## Closeout evidence (2026-07-31)

- Provider join ledger upsert deleted
- `executeWorkspaceKernelLeave` deleted
- Leave delete-local + purge use `leaveManagedWorkspaceMembership` before forcePurge
- `pnpm verify:workspace-kernel` Pass · U4/SEC-V2/W0/W1 contracts Pass
- **Kept:** non-kernel `leaveGroup` commit for web/ALLOW_LEGACY
- **Not claimed:** L3 leave CDP
