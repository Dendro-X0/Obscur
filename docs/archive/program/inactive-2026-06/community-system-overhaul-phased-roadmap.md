# Community system overhaul — phased roadmap (by version)

**Status:** planning baseline (2026-05-19).  
**Canonical product/architecture:** [community-system-implementation-and-ui-plan.md](./community-system-implementation-and-ui-plan.md) (modes, planes, internal **P0–P4** backlog).  
**Operating owners:** [10 Community and groups operating model](../encyclopedia/10-community-and-groups-overhaul.md).

This document maps that backlog to **release phases**: each **phase** targets a **version band** (one or more tags). Phases ship through **milestones** (verifiable outcomes). Version numbers are **targets**—if a milestone slips, move it; do not split owners or add parallel mutation paths to hit a date.

---

## Principles

1. **One canonical path** per lifecycle (descriptor, membership, governance, room key) — see protocol [25](../protocols/25-community-ledger-and-projection-architecture-spec.md) / [26](../protocols/26-community-projection-contract.md) / [27](../protocols/27-community-control-and-governance-event-family.md).
2. **Evidence before UI success** — projections and ledgers, not optimistic banners alone.
3. **Desktop-first iteration** is allowed in early phases (aligned with [v1.5.x feature roadmap](./v1.5.x-feature-roadmap.md)); mobile matrix expands when Lane M unblocks.
4. **Each phase has a named exit** so the initiative can pause between versions without “half a mode.”

---

## Phase overview

| Phase | Version target | Theme | Primary map (implementation plan) |
|-------|----------------|-------|-----------------------------------|
| **1** | **v1.5.x** (e.g. 1.5.6+) | Descriptor truth + sovereign governance MVP + roster/display honesty | P0 + P1 (core) |
| **2** | **v1.6.x** | Governance + projection maturity; convergence hardening | P1 (complete) + contract 26 alignment |
| **3** | **v1.7.x** | Managed workspace / stewards / relay-tier honesty | P2 |
| **4** | **v1.8.x** patches → **v2.0.0** gate | Tabbed create/manage shell + UX + platform (no v1.9 line) | P3 (+ P4 optional) — [obscur-2.0-milestone-roadmap.md](./obscur-2.0-milestone-roadmap.md) |

Cross-cutting work (tests, demo matrix rows, handoff updates) attaches to the milestone that introduces the behavior—not to a vague “ongoing” bucket.

---

## Phase 1 — v1.5.x: trustworthy basics + governance MVP

**Goal:** Users are not stuck with hex names or stale rosters; **solo** descriptor edits apply immediately; **multi-member** sensitive edits go through **vote → resolve → apply** with visible status.

### Milestones

| ID | Milestone | Exit criteria (evidence) |
|----|-----------|----------------------------|
| **1.1** | **Descriptor write path** | Rename (and related metadata) publishes sealed + relay hint; survives refresh; Network/home use human names where ledger/metadata allow. |
| **1.2** | **Membership / roster honesty** | Leave/expel reflected in **active** roster for invite, participant UI, and invite gates; widen-only discovery does not resurrect leavers for membership-sensitive actions. |
| **1.3** | **Governance events (sealed)** | Propose / vote / resolve events flow on wire; reducer applies **accepted** only with explicit resolution; **rejected** closes without applying; **expired** after `proposalExpiresAtUnixMs` (sealed `resolved` + reducer, periodic tick when unlocked). |
| **1.4** | **Governance UX (minimal)** | Management: Governance tab + proposal list + vote actions; community home: pending banner when proposals are open; solo vs multi-member paths documented in UI copy. |
| **1.5** | **Local resilience (non-authoritative)** | Best-effort persistence (e.g. session cache) so reload does not erase in-flight proposals **for UX only**; relay replay remains source of truth. |
| **1.5b** | **Ledger audit (descriptor)** | Descriptor persistence uses a dedicated membership-ledger mutation reason (`descriptor_updated`), distinct from join/runtime confirm. |
| **1.6** | **Release hygiene** | Targeted tests green (`pnpm release:test-pack` when slicing); demo doc row for “rename + second member approves” when 1.3–1.4 verified. |

**Phase 1 exit (initiative checkpoint):** P0 exit satisfied; P1 **sovereign** exit satisfied for rename + expel on **desktop-verifiable** paths; no new parallel owners.

**Explicitly not required in Phase 1:** Full `governanceByCommunityId` projection module split; tabbed create/manage shell (P3); managed workspace (P2).

---

## Phase 2 — v1.6.x: projection maturity + governance completeness

**Goal:** Community governance state is **first-class** in the read model story (contract 26), not only inside the sealed-community hook.

### Milestones

| ID | Milestone | Exit criteria |
|----|-----------|----------------|
| **2.1** | **`governanceByCommunityId` owner** | Single reducer/projection surface (or adapter) feeding UI; document invariants vs hook-local state. |
| **2.2** | **Lifecycle completeness** | Tie votes and **dedupe** duplicate `resolved` from multiple clients; extend `expired` policy if needed beyond v1.5.x MVP. |
| **2.3** | **Ledger / mutation reasons** | Governance-driven membership/descriptor mutations fully tagged; extend beyond `descriptor_updated` + join reasons where the ledger schema allows. |
| **2.4** | **Regression suite** | Replay tests for governance + membership interaction; extend manual matrix for multi-device quorum. |

**Phase 2 exit:** Protocol 27 semantics reflected in projection; no “hidden” governance truth only in component state.

**Coordination with other v1.6 work:** [v1.5.x feature roadmap](./v1.5.x-feature-roadmap.md) may schedule unrelated **v1.6.0** items (e.g. recall/redaction). Keep **community track** milestones independent unless a shared owner forces sequencing.

---

## Phase 3 — v1.7.x: managed workspace (P2)

**Goal:** **Managed workspace** mode is honest on relay tier; stewards can act within policy; directory/roster behavior matches relay contract.

### Milestones

| ID | Milestone | Exit criteria |
|----|-----------|----------------|
| **3.1** | **Relay gate** | Create/manage blocks or degrades managed mode on insufficient relay capability; copy explains why. |
| **3.2** | **Steward model** | `stewardPubkeys` (or equivalent) on descriptor; capability matrix for steward-only actions. |
| **3.3** | **Directory / roster** | Stronger materialization when relay contract satisfied; no false “full directory” on Tier 1. |

**Phase 3 exit:** P2 rows in implementation plan satisfied for a **trusted-relay** happy path; sovereign mode unchanged.

---

## Phase 4 — v1.8.x+ (or 2.0): product shell (P3) + optional P4

**Goal:** Replace scattered dialogs with a **mode-aware** create + manage shell (tabs, guarantees summary); optional advanced features.

### Milestones

| ID | Milestone | Exit criteria |
|----|-----------|----------------|
| **4.1** | **Create flow** | Mode pick + mode-specific steps; state lands on descriptor at create. |
| **4.2** | **Manage hub** | Tabbed management shell replaces ad-hoc duplication; home vs manage responsibilities clear. |
| **4.3** | **P4 (optional)** | Hybrid steward+vote, encrypted public descriptors, gossip hints—only if product still needs them after 4.1–4.2. |

**Phase 4 exit:** P3 exit in implementation plan; P4 explicitly accepted or deferred with rationale.

---

## Dependencies (high level)

```text
Phase 1 (1.5.x) ──► Phase 2 (1.6.x) ──► Phase 3 (1.7.x)
                         │
                         └──► Phase 4 (1.8+)   (P3 can start UX design after 1.2; full shell after 2.1 reduces rework)
```

- **Phase 2** should not re-litigate Phase 1 owners; it **elevates** the same contracts into the projection layer.  
- **Phase 3** assumes descriptor + governance planes are stable enough not to fork managed mode into a second stack.  
- **Phase 4** is mostly UX consolidation; it **consumes** stable mode metadata from earlier phases.

---

## How to use this doc (agents + maintainers)

1. Pick the **active phase** (today: **Phase 3** complete on `main`; **Phase 4** next — see [obscur-2.0-milestone-roadmap.md](./obscur-2.0-milestone-roadmap.md)).  
2. Implement the **next milestone** with the smallest diff that satisfies the **exit criteria** for that milestone.  
3. Update [`docs/handoffs/current-session.md`](../handoffs/current-session.md) with the milestone ID when scope changes.  
4. When a **phase exit** is met, tag a version if product-visible; otherwise merge without tag per [v1.5.x feature roadmap](./v1.5.x-feature-roadmap.md) policy.

---

## Revision history

| Date | Change |
|------|--------|
| 2026-05-19 | Initial phased roadmap (version bands + milestones). |
