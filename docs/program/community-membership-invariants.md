# Community membership invariants (MEM-001 guardrails)

**Status:** Active — any change under `apps/pwa/app/features/groups/**` must satisfy these rules.  
**Supersedes:** ad-hoc patch/debug on roster collapse (see [deletion-roster-limitations.md](../messaging/deletion-roster-limitations.md) § MEM-001).  
**Exit:** Single roster read owner (R2 in [v1.5.0-architecture-refactor-queue.md](./v1.5.0-architecture-refactor-queue.md)) — until then, **no new membership features**, only invariant-preserving fixes.

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
5. Set `applyTerminalMembershipExclusions: true` on group-home discovery roster hook.
6. Add a new roster “owner” (page-local merge, provider effect, modal state) without updating this doc.

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

## Park mode (keep the project moving)

When **any** of the following is true, treat community membership as **frozen** except P0 invariant breaks:

- Same roster bug reproduced after an invariant-preserving fix.
- Change requires touching more than **two** of: `group-provider`, `use-sealed-community`, `group-home-page-client`, `group-management-dialog`.
- Feature request is “more accurate live roster” or “cross-client roster parity” — defer to R2 extraction.

**Allowed while frozen:** chat, invites, governance UI, descriptor edits, relay publish, stealth restate — as long as invariants above hold.

**Not allowed while frozen:** new removal sources, new terminal caches, new page-local roster merges, “quick fix” without a test.

---

## Re-open criteria (end park mode)

1. `community-membership-read-model` (or R2 exit) owns display + active lists.
2. All surfaces read that projection only.
3. Manual matrix row: two members survive refresh + modal reopen without terminal flicker.
4. This doc updated with the new single owner and retired paths listed explicitly.
