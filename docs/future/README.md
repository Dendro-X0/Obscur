# Future protocol & kernel concepts

**Status:** Living concept shelf — not shipping requirements  
**Relationship to product:** Obscur remains a **Nostr client application** (v1.5.x). This folder captures the **gradual kernel / new social protocol** direction without blocking current releases.

---

## Why this folder exists

The monorepo accumulates experience faster than a greenfield rewrite. Rather than abandon the codebase or pretend v0.x choices were final, we:

1. **Ship** a decent, honest Nostr client (application layer + adapters).
2. **Document** long-term infrastructure ideas here — refined by what we learn in production.
3. **Harvest** packages, contracts, and UI from `apps/*` and `packages/*` into a future kernel when the charter is ready.

Nothing in this directory is a commitment to ship on a date. It is **inspiration + specification draft** for the next layer.

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

1. Do **not** implement kernel behavior from this folder without an explicit program decision and a port contract in code.
2. v1.5.x work may **reference** these docs for honesty (limitations, non-goals) but must not expand scope because of them.
3. When a concept graduates to product truth, move or merge it into `docs/encyclopedia/` or `docs/architecture/` and trim duplication here.
