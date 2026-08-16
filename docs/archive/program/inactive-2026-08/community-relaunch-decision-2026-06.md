# Community relaunch decision — Path B narrow (2026-06)

**Status:** **Signed** — maintainer decision (2026-06-17)  
**Supersedes for community work:** incremental roster/display patches, parallel join paths, “fix NewTest 2” without spec phase  
**Issues register:** [community-relay-technical-issues-register-2026-06.md](./community-relay-technical-issues-register-2026-06.md)  
**Implementation specs:** [community-relaunch-master-spec-2026-06.md](../archive/program/inactive-2026-06/community-relaunch-master-spec-2026-06.md)  
**Prior fork doc:** [community-fork-decision-2026-05.md](./community-fork-decision-2026-05.md) (Path B signed there; this doc narrows execution)

---

## Decision

| Choice | Status |
|--------|--------|
| **Path B — narrow workspace communities** | **Active** — team rooms on operator coordination + trusted relay |
| Path A — DM-only cut | **Deferred** — not the 2026–2027 primary track |
| Path C — defer communities to post-v2 | **Deferred** |

**Path B narrow** means: use existing workspace-kernel ports (W1–W4) as **runtime authority**, subtract legacy parallel owners, and gate ship on **COM-MEM-2** two-profile soak — not a fourth architectural redesign of Nostr/community layers.

---

## Product promise (honest)

What Obscur **will** claim for managed-workspace communities:

- Membership truth comes from the **coordination directory** (signed head/deltas), not public-relay roster hints.
- Sealed chat requires a **local room key**, **writable community relay**, and **coordination membership** — all three, or explicit degraded copy.
- Join is **invite-first** when workspace kernel authority is on; no silent “member UI” without crypto/transport evidence.
- Leave/expel on peer devices requires **evidence delivery** (coordination delta and/or sealed gossip); not instant global delete.

What Obscur **will not** claim:

- Live roster parity across all clients on arbitrary public relays.
- Sovereign rooms on `nos.lol` / public-default hosts as a **supported** workspace mode.
- “Delete for everyone” or server-like roster mutation on the open Nostr graph.

Refs: [design-goals-and-constraints.md](./design-goals-and-constraints.md) · [community-membership-relay-feasibility.md](../archive/program/inactive-2026-06/community-membership-relay-feasibility.md)

---

## Stop list (effective immediately)

Do **not** resume until the matching spec phase lands:

1. New roster merge logic in `group-home-page-client.tsx` or `group-management-dialog.tsx`.
2. New `joinEvidence` / display repair layers in `community-participant-display-read-model.ts` (COM-RUN-10 patch is **verify-only**, not extended).
3. Guest/open join paths that bypass `joinManagedWorkspaceMembership` when `isWorkspaceKernelAuthority()`.
4. Marking community rows **Verify (V)** without **COM-MEM-2 Pass** on native two-profile.
5. Treating `pnpm verify:workspace-kernel-w4` alone as “communities work in runtime.”

---

## Relationship to landed work

| Layer | Status | Relaunch action |
|-------|--------|-----------------|
| Path B B0–B5 programmatic bands | Landed | Keep; do not re-litigate |
| Workspace kernel W0–W4 contract tests | Landed | **Enforce subtraction** in UI routes |
| `features/groups/` parallel paths | Still active at runtime | **Subtract** per master spec R1–R4 |
| Issues register COM-RUN-01…08 | Open | Close only via spec phases + COM-MEM-2 |

Relaunch = **subtraction + atomic join + health gate + soak**, not new coordination schema.

---

## 2027 exit bar (community slice)

Public promotion of **team communities** requires **Verify (V)**, not Implement (I) alone:

| Gate | Requirement |
|------|-------------|
| **COM-MEM-2** | Two-profile managed workspace: create → invite → join → chat → restart → leave/re-invite — [community-verification-com-mem-2-spec-2026-06.md](../archive/program/inactive-2026-06/community-verification-com-mem-2-spec-2026-06.md) |
| **COM-MSG** | Two-profile sealed send/read after cold restart (workspace kernel W2) |
| **K3–K5** | Matrix rows move from ◐ to **V** only after COM-MEM-2 + COM-MSG Pass |

Until COM-MEM-2 **Pass**: community UX may remain in maintainer/dev builds; **no consumer marketing** of reliable group chat.

---

## Working method (post-decision)

1. **R0** — Spec suite landed (this decision + master + module specs). **No feature code** until maintainer reviews R0.
2. **R1→R6** — Strict order in [community-relaunch-master-spec-2026-06.md](../archive/program/inactive-2026-06/community-relaunch-master-spec-2026-06.md).
3. Each phase: L1/L2 tests + handoff checkpoint; community ship claims require L4 COM-MEM-2.
4. Feasibility gate ([rules/11-feasibility-and-modular-safety.md](../../rules/11-feasibility-and-modular-safety.md)): third failed iteration on same symptom → stop and revisit spec, not patch.

---

## Revision history

| Date | Change |
|------|--------|
| 2026-06-17 | Path B narrow signed; stop list and 2027 exit bar recorded |
