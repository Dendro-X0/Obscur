# Community roster read owner specification (2026-06)

**Status:** R3 implementation spec  
**Phase:** R3 — [community-relaunch-master-spec-2026-06.md](./community-relaunch-master-spec-2026-06.md)  
**Resolves:** COM-RUN-01, COM-RUN-07, COM-RUN-10 (verify-only policy)

---

## 1. Problem

Participant lists read from **different pubkey sets** on the same page:

- Coordination directory (Path B authority)
- Monotonic roster session (`useCommunityParticipantRosterReadModel`)
- Display repair merges (`resolveCommunityParticipantDisplayPubkeys`)
- Gateway conversation roster

W3 contract tests require kernel roster on group-home but **legacy hooks still run**, causing COM-RUN-01 drift.

ACC-02 (multi-owner roster) remains accepted until COM-MEM-2 **V** closes this spec.

---

## 2. Target (when `isWorkspaceKernelAuthority()`)

| Surface | Read from | Stop using |
|---------|-----------|------------|
| Participants modal Online/Offline | Membership-eligible pubkeys from kernel roster index + coordination `activeMemberPubkeys` | `useCommunityParticipantRosterReadModel` on group-home |
| Home “Active membership evidence” chips | Same | `resolveCommunityParticipantDisplayPubkeys` page merge |
| Invite blocklist | Kernel active − terminal | Page-local `joinEvidence` repair merges |
| Reconcile display | Coordination refresh via port | Parallel truth snapshot merges in page |

Canonical helpers (existing):

- `resolveWorkspaceKernelActiveMemberPubkeys` — group-home partial wiring
- `useWorkspaceKernelRosterIndex` — group-provider
- `communityRosterByConversationId` — WorkspaceKernelProvider

---

## 3. COM-RUN-10 policy

The 2026-06 display repair patch (`knownParticipantPubkeys`, `participationAuthorPubkeys` in display read model) is **not** extended.

| Outcome | Action |
|---------|--------|
| COM-MEM-2 Pass after R3 | Keep patch only if redundant; prefer deletion |
| COM-MEM-2 Fail after R3 | Revert display repair; fix coordination/join upstream |

Do not add further seeds to `community-participant-display-read-model.ts`.

---

## 4. Subtraction manifest (group-home)

When kernel authority on, [`group-home-page-client.tsx`](../../apps/pwa/app/groups/[...id]/group-home-page-client.tsx) must **not**:

- Import or call `useCommunityParticipantRosterReadModel`
- Call `resolveCommunityParticipantDisplayPubkeys` for participant modal
- Build parallel `participantDisplayPubkeys` useMemo from legacy merges

Same subtraction applies to [`group-management-dialog.tsx`](../../apps/pwa/app/features/groups/components/group-management-dialog.tsx) for participant registry.

**Second `useSealedCommunity` on group-home** remains quarantined per [workspace-kernel-subtraction-manifest.ts](../../apps/pwa/app/features/workspace-kernel/workspace-kernel-subtraction-manifest.ts) — long-term removal when shell owns controller.

---

## 5. Participant modal bands

Per [community-membership-invariants.md](./community-membership-invariants.md) (updated):

- **Online/Offline columns:** membership-eligible pubkeys only (kernel active − terminal)
- **Excluded / terminal band:** left/expel with signed evidence
- **Discovery widen-only session:** not used for modal columns when kernel on

---

## 6. Deliverables (R3)

| ID | Deliverable |
|----|-------------|
| R-1 | Remove legacy roster hooks from group-home when kernel on |
| R-2 | Remove legacy roster hooks from group-management-dialog when kernel on |
| R-3 | Extend `workspace-kernel-w3-exit.contract.test.ts`: forbid legacy imports on group-home |
| R-4 | Single `useWorkspaceKernelParticipantPubkeys(conversationId)` hook if needed |
| R-5 | Update COM-8 dev-lab probe to read kernel roster |

---

## 7. Acceptance

- [ ] Tester1 and Tester2 participant modal both list two members after COM-MEM-2 step 5
- [ ] `groups.page.participant_projection_state` warn rate → 0 on soak
- [ ] W3 contract extended and green

---

## 8. Verification

```bash
pnpm verify:workspace-kernel-w3
pnpm -C apps/pwa exec vitest run app/features/workspace-kernel/workspace-kernel-w3-exit.contract.test.ts
```

Runtime: COM-MEM-2 step 5.

---

## Revision history

| Date | Change |
|------|--------|
| 2026-06-17 | Initial roster read owner spec |
