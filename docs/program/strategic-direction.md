# Strategic direction & implementation sequence

**Status:** Active program framing  
**Last updated:** 2026-05-18  
**Current release target:** v1.5.5 — client refinement (features); v1.5.4 shipped; **distribution optional**
**Feature roadmap:** [v1.5.x-feature-roadmap.md](./v1.5.x-feature-roadmap.md)  
**Mobile/desktop policy:** [mobile-desktop-version-policy.md](./mobile-desktop-version-policy.md)

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
| **4b** | Ship **v1.5.2** — feel-fast UI + relay discipline | [v1.5.2-release](../releases/v1.5.2-release.md) (shipped) |
| **4c** | Ship **v1.5.3** — stay smooth + mobile shell/CI | [v1.5.3-release](../releases/v1.5.3-release.md) (shipped) |
| **4d** | Ship **v1.5.4** — unified installer icons + desktop polish | [v1.5.4-release](../releases/v1.5.4-release.md) (shipped) |
| **4e** | Ship **v1.5.5** — mobile production (signed APK, device gates) | [v1.5.5-scope](./v1.5.5-scope.md) |
| **5** | Kernel concepts in `docs/future/` only until chartered | No code gate from that folder |

---

## Version lanes

| Version | Theme |
|---------|--------|
| **v1.5.0** | ClientGateway, profile isolation, membership (shipped / RC) |
| **v1.5.1** | Honest hide, show again, profile-scoped bus (shipped) |
| **v1.5.2** | Navigation warmup, community confirm pages, relay probe caps (shipped) |
| **v1.5.3** | Stay smooth + mobile shell build + APK on tag releases (shipped) |
| **v1.5.4** | One Mark — unified icons; **desktop production**; mobile CI artifacts only (same version) |
| **v1.5.5–6** | **Refine** desktop/web + shared kernel; optional mobile UI slice; **distro shelved** |
| **v1.6+** | Cooperative recall UI; mobile/iOS distro if ever prioritized |
| **v1.5.x** | Stabilize Nostr client + mobile ship; no false marketing |
| **v1.6+** | Cooperative recall hardening, optional features per charter |
| **Kernel** | Gradual — see `docs/future/` |

---

## Mobile vs desktop (v1.5.4+)

- **One version number** across desktop, PWA, and Android metadata (`pnpm version:check`).
- **One feature kernel** in shared packages — mobile shell is a build target, not a fork.
- **Desktop ships first**; mobile production release waits until native shell + device evidence are ready ([mobile-desktop-version-policy.md](./mobile-desktop-version-policy.md)).

---

## What we stop doing

- Shipping a separate “mobile 1.0” version line while desktop is `1.5.x`.
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
