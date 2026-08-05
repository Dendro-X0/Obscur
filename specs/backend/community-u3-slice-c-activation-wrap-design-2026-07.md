# Design — U3 closeout: activation self-wrap wire (Slice C residual)

**Status:** Done · 2026-07-31  
**Proof:** coordination **10** + pwa **39** Pass · **L3 CDP Pass** 2026-07-31 (`test-results/phase1b-slice-c-l3-2026-07-03.json`).

---

## Session gate

```text
HANDOFF ATOMIC STEP:  U3 Slice C
PAUSED / CANCELLED:   Full community except U-slices · COM-RUN-01/02
CANONICAL OWNER:      community-coordination-room-key-owner via publishWorkspaceCoordinationJoinEvidence
PROOF BEFORE DONE:    L1 activation + room-key-owner + membership-join contracts
OUT OF SCOPE:         L3 CDP · C5 invite L4 · R1 · roster
```

---

## Finding

C1–C5 owners/tests largely **already landed**. Residual gap: `publishWorkspaceCoordinationJoinEvidence` synced join **without** self-wrap — dialog create path never published wraps (kernel path double-published after).

## Change

1. Optional `roomKeyWrap: { groupId, roomKeyHex }` on `publishWorkspaceCoordinationJoinEvidence` → `publishSelfCoordinationRoomKeyWrapAfterJoin` on sync success.  
2. Pass wrap from workspace-kernel create/join + `global-dialog-manager` create.  
3. Remove duplicate post-refresh wrap publishes in membership-port (activation is sole join-sync wrap owner).  
4. Mark Slice C design **L1 Done**; L3 still not claimed.

---

## Proof

```bash
pnpm -C apps/coordination exec vitest run src/membership-room-key-wrap.test.ts
pnpm -C apps/pwa exec vitest run \
  app/features/groups/services/community-coordination-room-key-owner.test.ts \
  app/features/groups/services/community-workspace-activation.test.ts \
  app/features/workspace-kernel/workspace-kernel-membership-join.test.ts \
  app/features/workspace-kernel/workspace-kernel-w1-exit.contract.test.ts
```
