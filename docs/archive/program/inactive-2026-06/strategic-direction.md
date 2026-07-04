# Strategic direction & implementation sequence

**Status:** Background framing — **daily order:** [v1.9.x-execution-contract.md](./v1.9.x-execution-contract.md)  
**Last updated:** 2026-06-04  
**Current release train:** **v1.9.x** — [v1.9.x-release-train.md](./v1.9.x-release-train.md) · **1.9.10** on `main` · next tag gate **v1.9.8 Phase 4**
**Feature roadmap:** [v1.5.x-feature-roadmap.md](./v1.5.x-feature-roadmap.md)  
**Mobile/desktop policy:** [mobile-desktop-version-policy.md](./mobile-desktop-version-policy.md)

---

## Summary

Obscur is **not** a failed experiment. It requires **adjusted goals** (2026-05 pivot):

- **Product:** **Private trust platform** — E2E DM and team rooms on **operator-controlled** infrastructure (coordination + team relay/API). See [platform-pivot-private-trust-2026-05.md](./platform-pivot-private-trust-2026-05.md).
- **Nostr:** **Optional adapter** for open-network scenarios—not the membership owner for workspace communities; **gradual** replacement of public-relay dependence for team features.
- **Near term:** Finish Lane K **gates** (coordination required, no public-relay workspace create) or interim **DM-only** cut; stop public-relay community patches.
- **Long term:** `TransportPort` + team transport + “no-logs” server policy (ciphertext-only at rest).
- **Parallel:** `docs/future/` kernel concepts; v1.9.x implements ports inside the monorepo.

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
| **5** | **v1.9.x Lane K** — kernel ports + coordination backend ([v1.9.0-kernel-backend-roadmap.md](./v1.9.0-kernel-backend-roadmap.md)) | Required before v2.0.0 |
| **6** | Kernel concepts in `docs/future/` graduate into `packages/` via Lane K | `docs/future/` alone does not gate releases |

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
| **v1.9.x** | **Lane K** — TransportPort, membership kernel, coordination directory, R1/R2 |
| **v2.0.0** | Production demo gate after v1.9.x exit | [v2.0-release-pipeline.md](./v2.0-release-pipeline.md) |
| **v1.6+** | Cooperative recall hardening, optional features per charter |

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
