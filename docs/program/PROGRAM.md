# Program Overview

**Status (2026-06-01):** **v1.9.x active program** — [design-goals-and-constraints.md](./design-goals-and-constraints.md) · [v1.9.x-execution-contract.md](./v1.9.x-execution-contract.md)  
**Between sessions:** Handoff may be **Idle**; contract still defines resume path  
**v2.0.0:** **Delayed** — [v2.0-release-pipeline.md](./v2.0-release-pipeline.md) after v1.9.x exit  
**Strategic frame:** [strategic-direction.md](./strategic-direction.md) · [obscur-2.0-milestone-roadmap.md](./obscur-2.0-milestone-roadmap.md)  
**Testing & issues (canonical):** [testing-and-issue-tracking-spec.md](./testing-and-issue-tracking-spec.md) · L3a `pnpm capture:runtime` [runtime-capture-e2e.md](./runtime-capture-e2e.md) · L3b [runtime-investigation-and-capture.md](./runtime-investigation-and-capture.md) · [../incidents/](../incidents/)  
_Last updated: 2026-06-04_

---

## What we are building (adjusted goals)

Obscur is a **communication product** on a **kernel + transport** stack. Nostr is a **long-term adapter**, not membership authority. **v1.9.x** implements the backend refactor chartered in [v1.9.0-kernel-backend-roadmap.md](./v1.9.0-kernel-backend-roadmap.md).

| Bar | Meaning |
|-----|---------|
| **v1.8.x** | Trust + Phase 4 patches on current stack (Lane T/C/X) |
| **v1.9.x** | Kernel ports + coordination backend — **usable** leave/roster/DM materialization |
| **v2.0.0** | Production demo after v1.9.x exit | [v2.0-release-pipeline.md](./v2.0-release-pipeline.md) · [version-roadmap-scope.md](./version-roadmap-scope.md) |

---

## What v1.5.0 was

v1.5.0 is an **architecture and reliability** release, not a feature marketing release.

| Lane | Outcome |
|------|---------|
| **R0–R2 ClientGateway** | DM read models, community roster, and storage ports route through `@dweb/client-gateway` — fewer parallel mutation paths |
| **Profile runtime** | `ProfileMessageBus`, explicit `profileId`, same-process A/B isolation gates |
| **Phase 3 membership** | Relay-first ingress, coordinator-owned ledger, provisional vs authoritative join |
| **Account projection** | DM/community timeline evidence for restore and read cutover |
| **Cooperative DM redaction** | **Not shipped in UI** — deferred to v1.6 protocol (see [messaging/cooperative-redaction-future.md](../messaging/cooperative-redaction-future.md)) |

Canonical release truth: [releases/v1.5.0-release.md](../releases/v1.5.0-release.md).

---

## Milestone history (condensed)

| Version | Theme | Status |
|---------|-------|--------|
| v1.3.x | Offline / PWA / streaming updates | Shipped — see [archive/consolidated/](./../archive/consolidated/) |
| v1.4.0 | CRDT protocol suite, CAS, call TTL | Shipped |
| v1.4.6–7 | Security hardening, restore convergence | Shipped |
| v1.4.11 | DM ledger shadow, send retry queue | Shipped |
| **v1.9.3** | Lane K + post-K trust/X/SQLite slices | **Shipped** — active train **v1.9.4+** |
| **v1.9.4+** | Feature restore + platform wrap-up | **Active** — [v1.9.4-scope.md](./v1.9.4-scope.md) |
| **v2.0.0** | Production demo | **Delayed** — after v1.9.x exit |

Full narrative: [encyclopedia/11-program-milestones-and-stability-history.md](../encyclopedia/11-program-milestones-and-stability-history.md).

---

## v1.9.x active execution docs

| Doc | Use when |
|-----|----------|
| [design-goals-and-constraints.md](./design-goals-and-constraints.md) | Product intent, invariants, limitations — **before coding** |
| [v1.9.x-execution-contract.md](./v1.9.x-execution-contract.md) | Daily order, Phase A/B/C |
| [v1.9.x-release-train.md](./v1.9.x-release-train.md) | Semver train and tags |
| [v1.9.4-scope.md](./v1.9.4-scope.md) | Current concentration unit backlog |
| [version-roadmap-scope.md](./version-roadmap-scope.md) | Master I/V/A checklist |
| [unified-verification-matrix.md](./unified-verification-matrix.md) | Phase B verification |
| [unified-verification-issues-register.md](./unified-verification-issues-register.md) | Phase C outcomes |

## v1.5.0 historical execution docs (archive reference)

| Doc | Use when |
|-----|----------|
| [phase3-scope.md](./v1.5.0-phase3-scope.md) | Community membership M1–M5 |
| [implementation-plan.md](./v1.5.0-implementation-plan.md) | Week/slice planning |
| [architecture-refactor-queue.md](./v1.5.0-architecture-refactor-queue.md) | R0/R1/R2 ordering |
| [refactor-checkpoints.md](./v1.5.0-refactor-checkpoints.md) | Checkpoint log |
| [refactor-verification-and-docs-policy.md](./v1.5.0-refactor-verification-and-docs-policy.md) | When testing counts as “done” |
| [known-issues-and-investigation-queue.md](./v1.5.0-known-issues-and-investigation-queue.md) | Historical P0/P1 — prefer issues register |
| [current-roadmap.md](./current-roadmap.md) | **Superseded** — do not use |

---

## Superseded plans (archive only)

Do not treat these as active requirements:

- `archive/consolidated/v1.4.*.md`
- `archive/consolidated/v1.5.0-community-sync-reliability-overhaul.md` (folded into phase3 + PROGRAM)
- `archive/consolidated/v1.5.0-crdt-integration-emergency-plan.md`
- `archive/rewrite-shelf/*` (historical rewrite specs)

---

## Exit criteria (v1.5.0)

1. ClientGateway owns listed materialization paths per [gateway/client-unified-gateway.md](../gateway/client-unified-gateway.md).
2. Same-process A/B profile isolation tests green.
3. Community membership ingress → coordinator path with Vitest replay suites.
4. Release notes and trust matrix updated; no false “shipped” claims.
5. Handoff [`handoffs/current-session.md`](../handoffs/current-session.md) reflects runtime truth.

---

## v1.5.2 active docs

| Doc | Use when |
|-----|----------|
| [v1.5.2-scope.md](./v1.5.2-scope.md) | Workstreams, perf matrix |
| [v1.5.2-release.md](../releases/v1.5.2-release.md) | User-facing notes (planned) |
| [v1.5.2-ui-performance-gate.md](../releases/v1.5.2-ui-performance-gate.md) | Automated + manual gates |

## v1.5.1 (shipped)

| Doc | Use when |
|-----|----------|
| [v1.5.1-scope.md](./v1.5.1-scope.md) | Historical workstreams |
| [v1.5.1-release.md](../releases/v1.5.1-release.md) | Shipped release notes |
| [v1.5.1-durable-hide-scope-and-gate.md](../releases/v1.5.1-durable-hide-scope-and-gate.md) | Closeout gates |

---

## After v1.5.1

1. **v1.5.x stabilization** — Nostr client quality, docs honesty, gateway-only feature paths.
2. **Kernel charter** — refine `docs/future/`; no big-bang rewrite without program sign-off.
3. **v1.6+** — harder recall/sync gates, team-server concepts — per [cooperative-redaction-future.md](../messaging/cooperative-redaction-future.md).
4. **SQLite / v2 draft** — evaluate against kernel ports ([architecture/roadmap-v2-draft.md](../architecture/roadmap-v2-draft.md)), not as default v1.5 path.
