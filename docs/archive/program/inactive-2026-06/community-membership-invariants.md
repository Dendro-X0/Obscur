# Community membership invariants (MEM-001 guardrails)

**Status:** **Path B enforcement mode** — R0 specs landed; implementation R1+ per [community-relaunch-master-spec-2026-06.md](./community-relaunch-master-spec-2026-06.md)  
**Supersedes:** ad-hoc patch/debug on roster collapse (see [deletion-roster-limitations.md](../messaging/deletion-roster-limitations.md) § MEM-001).  
**Exit:** COM-MEM-2 **V** + single roster read owner when `isWorkspaceKernelAuthority()` — [community-roster-read-owner-spec-2026-06.md](./community-roster-read-owner-spec-2026-06.md)

---

## Product truth (non-negotiable)

| Evidence tier | Meaning | May remove from active roster? | May persist terminal cache? |
|---------------|---------|--------------------------------|-----------------------------|
| **Chat participation** | Sealed message author (live or persisted `groupMessages`) | No — does **not** override sealed `leftMembers` for membership/invite | No |
| **Relay warm-up** | 9021/9022/39002 before `steady_state` | **No** | **No** |
| **Relay steady** | `resolveRelayEvidenceConfidence === "steady_state"` | Yes, if no newer chat participation | Yes, only after participation filter |
| **Explicit local leave** | User leave / governance expel / ledger terminal | Yes | Yes (coordinator path) |

**UI bands:**

- **Discovery / participant modal session** — widen-only OR-set; `applyTerminalMembershipExclusions` must stay **`false`** on group home read model.
- **Excluded / terminal section** — may list left/expel **only** when not in active participation set.
- **Sendability / invite gates** — may consult terminal + ledger; must not be the same code path as discovery widen.

---

## Code owners (one writer per effect)

When `isWorkspaceKernelAuthority()` (Path B narrow):

| Effect | Canonical owner | Others must |
|--------|-----------------|-------------|
| Join / create | `joinManagedWorkspaceMembership` / `createManagedWorkspaceMembership` — [community-atomic-join-spec-2026-06.md](./community-atomic-join-spec-2026-06.md) | Not commit join success inline in invite card or group-home |
| Membership health | `resolveCommunityMembershipHealth` — [community-membership-health-spec-2026-06.md](./community-membership-health-spec-2026-06.md) | Not gate invite/chat on `roomKeyHex` alone |
| Roster display (participants) | Kernel roster index + coordination directory — [community-roster-read-owner-spec-2026-06.md](./community-roster-read-owner-spec-2026-06.md) | Not use `useCommunityParticipantRosterReadModel` on group-home |
| Relay bind at join | `community-workspace-activation` + port — [community-relay-transport-binding-spec-2026-06.md](./community-relay-transport-binding-spec-2026-06.md) | Not claim join success without pool evidence (full-stack) |

Legacy owners (when kernel authority **off** — web/dev only):

| Effect | Canonical owner | Others must |
|--------|-----------------|-------------|
| Terminal `localStorage` | `saveCommunityTerminalMembershipCache` callers gated by `canApplyRelayInferredMemberRemoval` | Not write terminal keys directly |
| Relay leave → CRDT | `use-sealed-community` `applyControlEvent` (relay source + steady gate) | Not call `crdt.removeMember` from snapshots |
| Active pubkey list for UI | `resolveActiveCommunityMemberPubkeysFromConversation` (terminal excludes) | Not filter roster only via thin `memberPubkeys` |
| Participant modal Online/Offline | `inviteEligibleMemberPubkeys` | Not `rosterDisplayPubkeys` / widen-only session |
| Participant display session | `community-participant-roster-read-model` | Not shrink session on relay `leftMembers` alone |
| Membership snapshot bus | `use-sealed-community` dispatch | `group-provider` ingest only; no parallel terminal writes |

---

## MUST NOT (regression triggers)

1. Import the same symbol twice in one file (build break) — run `pnpm exec tsc --noEmit` in `apps/pwa` after every groups touch.
2. Apply relay 9022 / sealed `leave` to CRDT or `leftMembers` before **`steady_state`**.
3. Call `saveCommunityTerminalMembershipCache` from snapshot handlers when confidence ≠ `steady_state`.
4. Use `publishedSnapshotMembers` alone as participation proof when filtering terminal (circular shrink).
5. Set `applyTerminalMembershipExclusions: true` on group-home discovery roster hook when kernel authority on.
6. Add a new roster “owner” (page-local merge, provider effect, modal state) without updating this doc and [community-relaunch-master-spec-2026-06.md](./community-relaunch-master-spec-2026-06.md).
7. Extend `community-participant-display-read-model` repair seeds (COM-RUN-10 policy).
8. Start R1+ implementation before R0 maintainer review of relaunch specs.

---

## MUST (before merge / handoff)

1. `pnpm exec tsc --noEmit` — `apps/pwa` (required; CI may not be the first run).
2. `pnpm test:run` on the membership invariant bundle:

   ```bash
   cd apps/pwa && pnpm test:run \
     app/features/groups/services/community-relay-evidence-policy.test.ts \
     app/features/groups/services/community-participant-roster-read-model.test.ts \
     app/features/groups/services/community-visible-members.test.ts \
     app/features/groups/utils/community-membership-participation-evidence.test.ts
   ```

3. If behavior changes, add or update a test that names the invariant (not a snapshot of accidental output).
4. One-line handoff note in `docs/handoffs/current-session.md` if owner/contract changed.

---

## Path B enforcement mode (replaces park mode)

**Allowed** only when mapped to a relaunch spec phase (R1–R6):

- Atomic join / rollback (R1)
- Membership health snapshot + banner (R2)
- Roster subtraction on kernel routes (R3)
- Relay binding at join (R4)
- COM-MEM-2 verification + dev-lab scenario (R6)
- Dev profile badge (R5)

**Not allowed** (regression triggers):

- New page-local roster merges in `group-home-page-client` / `group-management-dialog`
- New display repair layers in `community-participant-display-read-model`
- “Quick fix” without spec phase + test naming the invariant
- Claiming community **Verify (V)** without COM-MEM-2 Pass

**Allowed without spec phase:** P0 build breaks, SEC band work unrelated to community join path.

---

## Re-open criteria (end enforcement mode → ship claim)

1. COM-MEM-2 **Pass** on full-stack profile ([community-verification-com-mem-2-spec-2026-06.md](./community-verification-com-mem-2-spec-2026-06.md)).
2. R1–R4 contract tests green; group-home uses kernel roster only when authority on.
3. ACC-02 superseded in UV register when COM-MEM-2 **V** recorded.
4. This doc updated with retired legacy paths listed explicitly.
