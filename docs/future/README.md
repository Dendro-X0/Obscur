# Future protocol & kernel concepts

**Status:** Living concept shelf — concepts graduate via **v1.9.x Lane K**  
**Relationship to product:** v1.8.x finishes trust patches; **v1.9.x** implements kernel/transport from this shelf per [v1.9.0-kernel-backend-roadmap.md](../program/v1.9.0-kernel-backend-roadmap.md). This folder alone does not gate releases.

---

## Why this folder exists

The monorepo accumulates experience faster than a greenfield rewrite. Rather than abandon the codebase or pretend v0.x choices were final, we:

1. **Ship** a decent, honest Nostr client (application layer + adapters).
2. **Document** long-term infrastructure ideas here — refined by what we learn in production.
3. **Harvest** packages, contracts, and UI from `apps/*` and `packages/*` into a future kernel when the charter is ready.

Nothing in this directory is a commitment to ship on a date. It is **inspiration + specification draft** for the next layer.

**Greenfield successor plan (2026-05):** If Obscur is archived, use **[../archive/greenfield/README.md](../archive/greenfield/README.md)** for the from-scratch charter, phased roadmap, and warning model — not v1.9.x Lane K as the primary schedule.

---

## Read order

| # | Document | Purpose |
|---|----------|---------|
| 00 | [Charter & vision](./00-charter-vision.md) | Goals, trust model, three layers, Nostr as optional adapter |
| 01 | [Kernel & transport sketch](./01-kernel-transport-sketch.md) | Gradual kernel, ports, what to extract from the monorepo |
| 02 | [Assets harvested from Obscur](./02-assets-from-obscur.md) | Map existing packages/features to future layers |

**Application architecture (current + bridge):** [../architecture/product-layers-and-nostr.md](../architecture/product-layers-and-nostr.md)

**Program sequence (roadmap → v1.5.x → docs):** [../program/strategic-direction.md](../program/strategic-direction.md)

---

## Rules for editors and agents

1. Implement kernel behavior via **v1.9.x Lane K** and port contracts in `packages/` — see [v1.9.0-kernel-backend-spec.md](../program/v1.9.0-kernel-backend-spec.md).
2. v1.8.x work may **reference** these docs for honesty but must not expand kernel scope before v1.9.0 B0.
3. When a concept graduates to product truth, move or merge it into `docs/encyclopedia/` or `docs/architecture/` and trim duplication here.

**Post–v1.8.8 product roadmap (managed infra):** [v1.8.9+ managed workspace roadmap](../program/v1.8.9-plus-managed-workspace-roadmap.md) — operator-relay end-to-end deletion, group bots. Complements [deletion-roster-limitations.md](../messaging/deletion-roster-limitations.md) and [cooperative-redaction-future.md](../messaging/cooperative-redaction-future.md).
