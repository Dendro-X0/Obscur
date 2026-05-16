# Program Overview

**Active program:** v1.5.0 — profile isolation, ClientGateway convergence, community membership correctness.  
**Status:** Release candidate (engineering complete for scoped lanes; see release notes for manual gates).  
_Last updated: 2026-05-15_

---

## What v1.5.0 is

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
| **v1.5.0** | Gateway + membership + projection | **Current** |
| v2.0 (draft) | SQLite single store, full rewrite | [architecture/roadmap-v2-draft.md](../architecture/roadmap-v2-draft.md) |

Full narrative: [encyclopedia/11-program-milestones-and-stability-history.md](../encyclopedia/11-program-milestones-and-stability-history.md).

---

## v1.5.0 active execution docs

| Doc | Use when |
|-----|----------|
| [phase3-scope.md](./v1.5.0-phase3-scope.md) | Community membership M1–M5 |
| [implementation-plan.md](./v1.5.0-implementation-plan.md) | Week/slice planning |
| [architecture-refactor-queue.md](./v1.5.0-architecture-refactor-queue.md) | R0/R1/R2 ordering |
| [refactor-checkpoints.md](./v1.5.0-refactor-checkpoints.md) | Checkpoint log |
| [refactor-verification-and-docs-policy.md](./v1.5.0-refactor-verification-and-docs-policy.md) | When testing counts as “done” |
| [known-issues-and-investigation-queue.md](./v1.5.0-known-issues-and-investigation-queue.md) | Open P0/P1 |
| [current-roadmap.md](./current-roadmap.md) | Policy and lane priority |

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

## After v1.5.0

1. **v1.6 cooperative redaction** — canonical message id + display gate + optional relay tombstone topic (design: [messaging/cooperative-redaction-future.md](../messaging/cooperative-redaction-future.md)).
2. **Gateway expansion** — remaining `getActiveProfileIdSafe` call sites and native storage parity.
3. **v2 exploration** — only with explicit program decision ([architecture/roadmap-v2-draft.md](../architecture/roadmap-v2-draft.md)).
