# Community verification — COM-MEM-2 specification (2026-06)

**Status:** R6 verification spec  
**Phase:** R6 — [community-relaunch-master-spec-2026-06.md](./community-relaunch-master-spec-2026-06.md)  
**Resolves:** COM-RUN-01…06 (runtime proof)  
**Matrix row:** **COM-MEM-2** (new)

---

## 1. Purpose

Single **L4** gate that proves managed-workspace communities work for **two profiles** on native desktop — closing the gap between `verify:workspace-kernel-w4` (L1/L2) and maintainer pain (COM-RUN).

Until COM-MEM-2 **Pass**, community rows in [version-roadmap-scope.md](./version-roadmap-scope.md) remain **◐**, not **V**.

---

## 2. Fixture

Same as [community-relay-technical-issues-register-2026-06.md](./community-relay-technical-issues-register-2026-06.md):

| Field | Value |
|-------|--------|
| Community name | NewTest 2 (or purge-safe name) |
| Relay | `ws://localhost:7000` |
| Mode | `managed_workspace` |
| Actors | Tester 1 (creator), Tester 2 (joiner) |
| Profile | **full-stack** ([community-dev-profiles-spec-2026-06.md](./community-dev-profiles-spec-2026-06.md)) |

**Purge before run:** `node scripts/purge-workspace-communities.mjs --match NewTest` (quit Obscur first).

---

## 3. Manual procedure (L4)

| Step | Actor | Action | Pass criterion |
|------|-------|--------|----------------|
| 1 | — | Purge + start stack | Coordination `/health` ok; relay :7000 listening |
| 2 | Tester 1 | Create managed workspace “NewTest 2” | Health banner clear; invite enabled |
| 3 | Tester 1 | Invite Tester 2 via **connection DM** | Invite delivered |
| 4 | Tester 2 | Accept invite in DM | Join succeeds; health banner clear |
| 5 | Both | Open participants | Both pubkeys visible (Online or Offline) |
| 6 | Both | Send sealed message in community chat | No room-key or writable-relay toast |
| 7 | Both | Quit app, relaunch, reopen community | Message + roster persist |
| 8 | Tester 1 | Leave community | Tester 2 reconcile: Tester 1 in terminal band; re-invite enabled |

Record: date, git SHA, profile ids, pass/fail per step, first failing layer if any.

---

## 4. Automated procedure (target)

| Item | Location |
|------|----------|
| Scenario id | `community-com-mem-2-soak` |
| CLI runner | Extend [`scripts/lib/dev-lab-membership-join-leave.mjs`](../../scripts/lib/dev-lab-membership-join-leave.mjs) |
| Dev-lab catalog | [`dev-lab-scenario-catalog.ts`](../../apps/pwa/app/features/dev-lab/dev-lab-scenario-catalog.ts) |
| Package script | `pnpm verify:com-mem-2` (chains W1–W3 contracts + scenario when stack up) |

**Prerequisites:** `pnpm dev:desktop:online` or equivalent; coordination external; full-stack env.

**Digest gates** ([dev-lab-spec.md](./dev-lab-spec.md)):

- `membershipSendability` ≤ watch on both actors
- `communityLifecycleConvergence` ≤ watch on both actors

---

## 5. Matrix row (draft)

Add to [unified-verification-matrix.md](./unified-verification-matrix.md) § Community:

| ID | Requirement | Layer | Pass |
|----|-------------|-------|------|
| COM-MEM-2 | Two-profile managed workspace: create → invite → join → chat → restart → leave/re-invite | L4 | Manual + automated scenario |

**Depends on:** R1 atomic join, R2 health, R3 roster, R4 relay binding.

---

## 6. Issue closure mapping

| COM-RUN | Closed when |
|---------|-------------|
| 01 | Step 5 Pass |
| 02 | Step 6 Pass |
| 03 | Step 6 Pass |
| 04 | Step 2–4 health banner behavior |
| 05 | Step 4 no partial join |
| 06 | Steps 5–7 + health snapshot logs |
| 10 | Step 5 Pass without further display repair |

Update [community-relay-technical-issues-register-2026-06.md](./community-relay-technical-issues-register-2026-06.md) statuses after Pass.

---

## 7. Verification commands

```bash
# Programmatic (when implemented)
pnpm verify:com-mem-2

# Minimum during R1–R5 development
pnpm verify:workspace-kernel

# Manual
# Follow §3 table; record in docs/handoffs/current-session.md
```

---

## 8. Acceptance (R6 complete)

- [ ] Matrix row COM-MEM-2 added
- [x] `verify:com-mem-2` script exists — **L1/L2 gate (2026-06-24):** `pnpm verify:com-mem-2` = contracts only; `verify:com-mem-2:scenario` experimental non-gating
- [x] Dev-lab scenario registered — graph probes + optional Playwright scaffold
- [x] Maintainer manual Pass recorded with SHA — **Partial Pass (2026-06-25):** maintainer sign-off; SHA `4d000257` + uncommitted community slice; steps **6** (send), **delete e2e**, home/chat entry **Pass**; steps 3–4, 7–8 not re-recorded; prior **Fail (2026-06-24)** superseded for chat/send/delete band only
- [ ] UV register COM-RUN rows updated — **partial (2026-06-25):** COM-RUN-03 → Verified Pass; COM-RUN-04 → Mitigated (UX subtraction)

**L4 automation (2026-06-24):** Dual-browser Playwright against static `out/` cannot verify create→invite→join (session loss on navigation, invite delivery not observable; 2h+ hang on accept). **L4 proof remains manual** on native desktop full-stack until a CDP-native or single-process harness exists.

---

## Revision history

| Date | Change |
|------|--------|
| 2026-06-17 | Initial COM-MEM-2 verification spec |
| 2026-06-24 | L4 automation declared infeasible on static shell; manual L4 fail recorded; `verify:com-mem-2` = contracts only |
| 2026-06-25 | Maintainer partial L4 Pass — send, e2e delete, home/chat (room key); steps 3–4/7–8 open |
