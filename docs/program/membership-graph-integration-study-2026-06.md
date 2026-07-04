# Membership graph — integration study (2026-06)

**Status:** Active research — **no community reconcile/roster patches** until this study drives R6 or maintainer un-pauses  
**Last updated:** 2026-07-03 (UTC)  
**Maintainer cancellation (2026-07-03):** **COM-RUN-02 room-key restore / UX gates — CANCELLED.** Do not patch restore, repair, or reintroduce room-key-as-gate. Redesign charter: [community-membership-redesign-charter-2026-07.md](./community-membership-redesign-charter-2026-07.md). **COM-RUN-01 roster parity remains cancelled** (§2.1).
**Trigger:** Resume membership research across DMs (connection requests, re-add), community invite DMs, and managed workspace join — **new lens: unified graph**, not isolated group patches  
**Related:** [community-relay-technical-issues-register-2026-06.md](./community-relay-technical-issues-register-2026-06.md) · [community-verification-com-mem-2-spec-2026-06.md](../archive/program/inactive-2026-06/community-verification-com-mem-2-spec-2026-06.md) · [modular-iteration-contract.md](./modular-iteration-contract.md) · exploration [M1](../exploration/modules/01-community-groups.md) · [M2](../exploration/modules/02-messaging-dm.md)

---

## 1. Why a new approach

Previous iterations patched **symptoms inside `groups/**`** (roster display, reconcile, self-heal) while COM-RUN failures span **three product layers** that share no single evidence chain.

| Old loop | New loop |
|----------|----------|
| Fix participant modal | Instrument **edges** of the membership graph |
| Manual NewTest 2 soak | **COM-MEM-2** walks the graph with probes at each transition |
| Add reconcile owner | **Subtraction** only after graph shows which owner lied |
| "Fix communities" | Preserve goal; **silo + redesign + integration study** |

Community band remains **PAUSED** for feature churn. This document is the **integration study** required before re-integration ([modular-iteration-contract.md](./modular-iteration-contract.md) § Integration study).

---

## 2. Unified membership graph (three layers)

One user journey — "Tester 2 joins NewTest 2 and can chat" — crosses **three layers**. Each layer has its own truth owner and evidence.

```text
Layer 0 — SOCIAL EDGE (1:1 trust)
  sendRequest / accept  →  request-transport-service
  peerTrust.isAccepted    →  dm-kernel / network profile
  evidence                →  request-flow-evidence-store, account-sync contact events

        │  (must be accepted or invite-eligible)

Layer 1 — INVITE CHANNEL (DM payload)
  community invite DM     →  community-dm-invite-pipeline (canonical)
  ledger / thread bus     →  community-dm-invite-ledger
  accept in thread        →  community-invite-card → kernel port (when authority)

        │  (invite accepted → join intent)

Layer 2 — WORKSPACE MEMBERSHIP (managed_workspace)
  create / join / leave   →  workspace-kernel-membership-port (when kernel authority)
  directory truth         →  coordination membership directory (Path B)
  crypto                  →  room-key-store (profile scoped)
  transport               →  workspace-relay-calibrator + activation publisher
  health gate             →  community-membership-health
```

**Insight:** COM-RUN-02 (no room key) and COM-RUN-03 (no writable relay) are **Layer 2** failures. COM-RUN-01 (roster divergence) is often **Layer 2 read projection** while Layer 1 invite succeeded. Treating them as one "membership bug" hid which **edge** broke.

---

## 2.1 Product constraint — live roster sync (2026-06, maintainer)

**Cancelled goal:** Real-time, cross-profile **member list parity** (every participant sees the same live roster with matching relationship labels).

| Claim | Rationale |
|-------|-----------|
| **Not achievable honestly** on this stack | Decentralized relay + coordination directory + per-profile local state cannot provide centralized “who is in the room right now” without monitored infrastructure |
| **“Fixing” parity with repair/reconcile UI is deception** | Display repair, stale-directory widen, and self-heal patches imply synchronized truth the product cannot evidence |
| **Chat can work without list parity** | Sealed group messaging depends on room key + relay transport — **not** on two profiles agreeing on participant modal contents |
| **Original UX intent** | Help users **find other members in the list** (interactive participants, not address-book contacts) — **discoverability**, not roster-as-authority |

**Implication for agents:** Do not treat COM-RUN-01 as “make roster sync work.” Treat it as **remove or redesign** participant UI that promises live membership relationships. Path B coordination directory remains **membership authority for join/leave/crypto** — not a promise of identical visual roster across clients.

**COM-MEM-2 step 5 (participants):** Deprioritize or rewrite — passing “both pubkeys visible Online/Offline” as ship gate encodes the cancelled goal.

---

## 2.2 Replacement UX — find someone in a large community (2026-06)

**Problem the modal tried to solve:** User needs to **locate a specific person** in a group (possibly hundreds/thousands) to open profile, send a DM, invite, etc.

**Wrong solution (current modal):** Browse a **synchronized member roster** with Online/Offline bands + “Reconcile membership” — implies centralized, live membership truth (§2.1).

**Right solution:** **Search-first discoverability** from **local, evidence-backed sets** — never claim completeness or cross-client parity.

### A. Primary flows (no full roster required)

| Flow | Mechanism | Honest scope |
|------|-----------|--------------|
| **Tap message author** | Avatar/name in group chat → profile actions | Person participated in **this** thread (strongest evidence) |
| **@ / compose mention** | Search within thread co-participants while typing | Local author index + cached display names |
| **“Message someone…”** | Action sheet → search, not browse | Opens picker (B), not roster modal |
| **Paste pubkey / npub / nip05** | Direct lookup via profile resolution | User-supplied identifier; no list needed |

Most DM/actions in large groups should start from **chat** or **search**, not scrolling a member list.

### B. “Find in community” picker (replaces participant modal)

Rename and reframe: e.g. **Find in this community** — subtitle: *“People visible to you here (from chat, your connections, and local directory hints). Not a complete member list.”*

**Sections (ordered, paginated — no Online/Offline columns):**

1. **Recent in chat** — `participationAuthorPubkeys` / message authors (already in `community-participant-roster-read-model.ts`). Paginate; scales to large threads.
2. **Your connections here** — `peerTrust.acceptedPeers` ∩ people seen in this community (directory hint ∪ chat authors). Solves “find someone I know in this group.”
3. **Search results** — filter local index by name, pubkey prefix, nip05; optional relay profile query with loading + “partial results” copy.
4. **Optional footer** — “Directory snapshot (last fetched)” — read-only, timestamped, **not** “synced roster.” No Reconcile button; at most **Refresh directory snapshot** for operators.

**Remove:** `RECONCILE MEMBERSHIP`, Online/Offline split as structure, subtitle promising directory sync.

### C. Scale (100s–1000s of members)

- **Do not render full roster** — search-only surface; recent/authors page capped (e.g. 50).
- **Do not promise** “all members” or matching lists across profiles.
- **Do** promise: “You can always reach someone if you have their pubkey, nip05, or they spoke in chat.”

### D. Code alignment (subtraction + picker)

| Keep (discoverability) | Retire (sync theater) |
|------------------------|------------------------|
| `resolveCommunityParticipantRosterEvidence` / author evidence | `reconcileWorkspaceMembershipEvidence` in group-home picker |
| Search input + pagination | Online/offline presence bands in modal |
| `MemberProfileRow` → profile/DM actions | Display repair widen to fake parity |
| Monotonic **local** session OR-set for “seen here” | Cross-profile roster equality as success metric |

**Owner:** One read model (`community-participant-roster-read-model`) feeding picker only — no parallel merges in `group-home-page-client.tsx`.

---

## 2.3 Header metrics — member count & online (2026-06)

**User need:** Chat header / community hero should show **useful** member and online figures — “as accurate as possible” **without** resurrecting the full roster modal or cross-client sync theater (§2.1).

**Principle:** One number, one **labeled source**, no implied global truth.

| Metric | Best honest source | UI copy pattern |
|--------|-------------------|-----------------|
| **Member count** | Path B: **coordination directory** active count when fetched (timestamp in tooltip). Else: **local “known in this community”** count (directory hint ∪ chat authors ∪ self) — same OR-set as §2.2, not modal roster. | `12 members` + tooltip: “From membership directory, fetched 2m ago” or “Known on this device (not a full list)” |
| **Online count** | **Presence among directory members (or known-here set) that this client subscribes to** — `presence.isPeerOnline` capped to that set. Never “N online in the community” globally. | `2 online here` or `2 of 12 visible online` — not “2 online” alone |

**Do not:** Drive header counts from `activeVisibleMembers` + reconcile widen + provisional repair stacks (current `group-home-page-client` / `chat-header` drift). **Do:** feed `chat-header` from the same narrow read model as §2.2 picker.

**Accuracy vs honesty:** “As accurate as possible” means **best local evidence**, not matching the other profile’s header. Two users may legitimately see different counts if directory fetch or presence subscription differs — copy must say so.

**Separate concern — session on refresh (auth band):** Losing unlock on page refresh (device password / key import) is **not** a community membership issue. Native reload restore exists (`native-session-reload-restore.ts`) but is brittle on static shell and when device-trust is off. Improving **persistent device unlock** (native secure session, “trust this device”, fewer re-auth steps) is **AUTH/session work** — must not be blocked on roster subtraction; track as parallel band in handoff.

---

## 3. Canonical owners (by layer)

### Layer 0 — Connection / re-add contact

| Concern | Canonical owner | Notes |
|---------|-----------------|-------|
| Outbound connection request | `request-transport-service.ts` → `sendConnectionRequest` / `sendRequest` | Evidence-backed convergence; Path B economics gate |
| Inbound anti-abuse | `incoming-request-anti-abuse.ts` | Rate limits; blocks re-add spam |
| Accept / trust edge | `request-transport-service` + `peerTrust.acceptPeer` | Must not mark accepted without evidence |
| Invite redemption (profile link) | `main-shell/hooks/use-invite-redemption.ts` | Uses same transport |
| Network UI send | `network-profile-view.tsx`, `send-request-dialog.tsx` | Thin; delegates to transport |

**Re-add contact:** After remove/block, flow is again Layer 0 → must pass transport + trust before Layer 1 community invite is meaningful.

### Layer 1 — Community invite over DM

| Concern | Canonical owner | Notes |
|---------|-----------------|-------|
| Invite send/persist/ledger | `community-dm-invite-pipeline.ts` | `commitOutboundCommunityDmInvite`; orchestrator is deprecated adapter |
| Invite wire contract | `community-dm-invite-contract.ts` | Payload parse/normalize |
| Accept/decline UI | `community-invite-card.tsx` | Should call kernel join when `isWorkspaceKernelAuthority()` |
| Outbound from network | `network-profile-view.tsx` → `commitOutgoingCommunityInviteDm` | Builds DM + pipeline |

### Layer 2 — Managed workspace membership

| Concern | Canonical owner | Notes |
|---------|-----------------|-------|
| Create/join/leave (kernel) | `workspace-kernel-membership-port.ts` | Atomic join transaction; health resolver |
| Coordination directory | `community-coordination-membership-directory-store` | Path B membership authority |
| Ledger mutation | `community-membership-mutation-owner.ts` | Single writer target |
| Roster **read** (target) | workspace-kernel W3 + coordination projection | **Discoverability UI only** — not live cross-client roster sync (§2.1) |
| Sealed send | kernel write-port + `GroupService` | Requires room key + writable relay |
| Legacy parallel paths | `use-sealed-community.ts`, `group-provider.tsx`, display repair | **Subtraction targets** — do not extend |

---

## 4. Cross-layer failure matrix

| User-visible symptom | Likely layer | First probe | COM-RUN |
|---------------------|--------------|-------------|---------|
| "Can't send connection request" | 0 | `request-flow-evidence`, relay writable for DM | — |
| Invite DM never arrives | 0→1 | DM send pipeline + recipient subscription | — |
| Invite card shows; join fails | 1→2 | invite ledger status + join port rollback | COM-RUN-05 |
| Join UI ok; no room key | 2 | `roomKeyStore`, join transaction | COM-RUN-02 |
| Room key ok; send fails relay | 2 | `hasWritableCommunityRelayTransport`, activation | COM-RUN-03 |
| Chat works; roster shows self only | 2 read | coordination directory vs display repair | COM-RUN-01 — **redesign UI**, do not “sync” |
| Chat works; lists disagree | 2 read | **Expected under §2.1** — not a ship blocker if chat + join evidence ok | — |
| OK for days then silent decay | 2 convergence | health banner + digest gates | COM-RUN-06 |
| Leave then re-invite broken | 1→2 | leave durability + invite eligibility read model | COM-MEM-2 step 8 |

---

## 5. COM-MEM-2 as graph walk (R6)

Manual procedure ([community-verification-com-mem-2-spec-2026-06.md](../archive/program/inactive-2026-06/community-verification-com-mem-2-spec-2026-06.md)) maps to graph edges:

| Step | Graph edge | Pass = evidence at layer |
|------|------------|---------------------------|
| 1 | Stack up | coordination + relay |
| 2 | Create workspace | Layer 2 local + directory seed |
| 3 | Invite via **connection DM** | Layer 0 edge ok + Layer 1 outbound |
| 4 | Accept in DM | Layer 1 accept + Layer 2 join atomic |
| 5 | Participants | Layer 2 read (both pubkeys) |
| 6 | Sealed message | Layer 2 crypto + transport |
| 7 | Restart | persistence across layers |
| 8 | Leave / re-invite | Layer 2 terminal + Layer 1 re-open |

**Current automation gap:** `scripts/lib/dev-lab-membership-join-leave.mjs` probes shell, M8 capture, and digest gates on two browsers — it does **not** yet execute steps 2–8 (header comment: join/leave publish stubbed). R6 work = extend scenario to walk edges with **per-edge assertions**, not more roster UI patches.

**Script:** `pnpm verify:com-mem-2` chains L1/L2 contracts + CLI scenario (see root `package.json`).

---

## 6. Integration risks (working neighbors)

Before expanding COM-MEM-2 automation or un-pausing community code:

| Neighbor module | Must not regress | Conflict surface |
|-----------------|------------------|------------------|
| DM v2 send/receive | Connection invite DMs use same pipeline | Relay scope, profileId |
| `request-transport-service` | Layer 0 evidence | Duplicate accept paths |
| `account-sync` | Contact events, backup restore | Re-add after removal |
| `workspace-kernel` W1–W3 | Join atomicity | Legacy group-provider join |
| `apps/coordination` | Directory ACL | Stale directory vs ledger |

---

## 7. Subtraction queue (when un-paused)

**Charter:** Subtract parallel owners and **roster-as-truth UI** — not reconcile/repair toward live parity (§2.1).

1. Retire page-local roster merges in `group-home-page-client.tsx` when kernel authority.
2. **Remove or quarantine** display-only repair in `community-participant-display-read-model.ts` (COM-RUN-10) — repair stacks simulate sync.
3. Route all invite accept join through `workspace-kernel-membership-port` only.
4. Collapse sealed send to kernel write-port (M1 finding: dual send stacks).
5. **Redesign participant panel** → **§2.2 “Find in community” picker** (search-first, recent authors, connections-here); remove Reconcile + Online/Offline roster.

---

## 8. Next atomic steps (ordered)

| # | Step | Type | Proof |
|---|------|------|-------|
| 1 | Land `verify:com-mem-2` script (L1/L2 + dual-browser probes) | **Done (2026-06-18)** | `pnpm verify:com-mem-2` |
| 2 | Graph edge probes (`probeMembershipGraph` → L0/L1/L2 steps) | **Done (2026-06-18)** | `dev-lab-membership-graph-probe.ts` |
| 3 | Extend scenario: create NewTest fixture + accept invite (Playwright) | **Infeasible (2026-06-24)** — static shell + dual browser cannot verify invite→join; 2h+ hang on accept | Use `verify:com-mem-2:scenario` only as experiment |
| 4 | Pass COM-MEM-2 manual once with graph worksheet filled | **Settled Fail** — mismatched memberships every run (maintainer, hundreds of reps); **no re-test** | COM-RUN-01 / COM-RUN-07 |
| 5 | Un-pause community band; execute subtraction queue from §7 | **Next** — subtract owners + redesign participant UI (§2.1) | No roster sync goal |

---

## 9. Agent rules for this band

- **Allowed:** This study, R6 automation, DM Layer 0 investigation specs, dev-lab probes, register updates.
- **Forbidden:** New reconcile/repair/self-heal in `groups/**`, roster display patches, "quick fix join" without edge evidence.
- **Vague requests:** Run explore → spec → simulate ([obscur-modular-iteration](../../.agent/skills/obscur-modular-iteration/SKILL.md)).

---

## 10. References (code entry points)

| Path | Role |
|------|------|
| `apps/pwa/app/features/messaging/services/request-transport-service.ts` | Layer 0 |
| `apps/pwa/app/features/groups/services/community-dm-invite-pipeline.ts` | Layer 1 |
| `apps/pwa/app/features/workspace-kernel/workspace-kernel-membership-port.ts` | Layer 2 join/create |
| `apps/pwa/app/features/groups/services/community-membership-health.ts` | Layer 2 gate |
| `apps/pwa/app/features/dev-lab/dev-lab-membership-graph-probe.ts` | R6 L0/L1/L2 probes |
| `scripts/lib/dev-lab-com-mem-2-phase-b.mjs` | R6 phase B UI automation (steps 2–4) |
| `scripts/lib/dev-lab-membership-join-leave.mjs` | R6 CLI scenario orchestrator |
