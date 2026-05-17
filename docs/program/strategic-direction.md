# Strategic direction & implementation sequence

**Status:** Active program framing  
**Last updated:** 2026-05-16  
**Current release target:** v1.5.2 (patch) — UI/UX + relay efficiency; v1.5.1 shipped

---

## Summary

Obscur is **not** a failed experiment. It requires **adjusted goals**:

- **Near term:** A **decent, honest Nostr client** — better gateway convergence, durable local hide, experimental cooperative recall with clear limits.
- **Long term:** A **communication kernel** developed gradually, with Nostr as a **permanent adapter option**, not the whole system.
- **Parallel:** `docs/future/` holds kernel/protocol concepts refined by shipping the client.

---

## Implementation sequence

| Step | Deliverable | Status |
|------|-------------|--------|
| **1** | Roadmap + specs with realistic limits; bar = “decent Nostr client” | This doc + [product-layers](../architecture/product-layers-and-nostr.md) |
| **2** | Goals aligned to limitations; Nostr stays, as adapter | [future/00-charter-vision](../future/00-charter-vision.md) |
| **3** | Encyclopedia / knowledge base reflects layers + honesty | Ongoing — [docs/README](../README.md) |
| **4** | Ship **v1.5.1** — honest hide (shipped) | [v1.5.1-release](../releases/v1.5.1-release.md) |
| **4b** | Ship **v1.5.2** — feel-fast UI + relay discipline | [v1.5.2-scope](./v1.5.2-scope.md) |
| **5** | Kernel concepts in `docs/future/` only until chartered | No code gate from that folder |

---

## Version lanes

| Version | Theme |
|---------|--------|
| **v1.5.0** | ClientGateway, profile isolation, membership (shipped / RC) |
| **v1.5.1** | Honest hide, show again, profile-scoped bus (shipped) |
| **v1.5.2** | Navigation warmup, community confirm pages, relay probe caps |
| **v1.5.x** | Stabilize Nostr client; docs + gates; no false marketing |
| **v1.6+** | Cooperative recall hardening, optional features per charter |
| **Kernel** | Gradual — see `docs/future/` |

---

## What we stop doing

- Chasing “ultimate sovereignty” or global delete as a v1.5.x ship criterion.
- Treating relay backup restore as overriding local tombstones.
- Adding features that bypass ClientGateway or profile-scoped signals.
- Big-bang rewrite before v1.5.1 ships (SQLite v2 draft stays in architecture/future).

---

## What we continue doing

- Improving DM, groups, sync, and desktop reliability on Nostr transport.
- Writing maintainer truth ([encyclopedia/12-core-architecture-truth-map.md](../encyclopedia/12-core-architecture-truth-map.md)).
- Harvesting lessons into `docs/future/` for the kernel.
- Keeping ~90% of UI and packages productive.

---

## Agent / maintainer start

1. [AGENTS.md](../../AGENTS.md)
2. [Maintainer playbook](../encyclopedia/08-maintainer-playbook.md)
3. [Current session handoff](../handoffs/current-session.md)
4. [v1.5.1 scope](./v1.5.1-scope.md)
5. [Strategic direction](./strategic-direction.md) (this file)
