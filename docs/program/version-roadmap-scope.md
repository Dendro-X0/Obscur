# Version roadmap scope (canonical)

**Status:** Active checklist — **destination** for v2.0.0; **daily queue** is active v1.9.x scope doc + handoff  
**Execution:** [v1.9.x-execution-contract.md](./v1.9.x-execution-contract.md) — v1.9.x until in-scope rows restored; v2.0.0 **delayed**  
**Last updated:** 2026-06-04  
**North star:** [obscur-2.0-milestone-roadmap.md](./obscur-2.0-milestone-roadmap.md)  
**Production demo:** [v2.0-production-demo-path.md](./v2.0-production-demo-path.md)  
**Release trains:** [v1.8.x-release-train.md](./v1.8.x-release-train.md) · [v1.9.x-release-train.md](./v1.9.x-release-train.md)  
**v2.0 release prep (after v1.9.x exit):** [v2.0-release-pipeline.md](./v2.0-release-pipeline.md)

This document defines **what must be implemented and verified** before the **v2.0.0 production demo**. Semver tags record milestones; **this file is the scope checklist** agents and maintainers use to answer “are we done yet?”

---

## Version bands (what each line means)

```text
v1.7.x   Phase 3 closeout (relay / stewards / directory honesty)
    │
    ▼
v1.8.x   Community Phase 4 + trust + experience + platform prep (many patch tags)
    │
    ▼
v1.9.x   Lane K kernel + post-K slices + platform/demo wrap-up
    │
    ▼
v2.0.0   Production demo gate — all in-scope lanes verified or accepted-with-copy
```

| Band | Owns | Canonical detail |
|------|------|------------------|
| **v1.7.x** | Online experiment closeout, v1.7 demo matrix | [obscur-2.0-milestone-roadmap.md](./obscur-2.0-milestone-roadmap.md) § v1.7.x |
| **v1.8.x** | Lanes **C, T, X, P** (partial) | [v1.8.x-release-train.md](./v1.8.x-release-train.md) · [community-system-overhaul-phased-roadmap.md](./community-system-overhaul-phased-roadmap.md) |
| **v1.9.x** | Lane **K** + trust/X/SQLite tags + **v1.9.4+** demo/platform | [v1.9.x-release-train.md](./v1.9.x-release-train.md) |
| **v2.0.0** | Full gate + demo kit + public-facing install story | This doc § v2.0.0 exit |

**Policy:** [maintainer-distribution-policy.md](./maintainer-distribution-policy.md) — user-visible tags only; ZIP/clone + local package; promotion after v2.0.0.

---

## Three bars: Implement · Verify · Accept

| Bar | Meaning | Evidence |
|-----|---------|----------|
| **Implement (I)** | Code + contracts on `main`; automated gates green for that row | Vitest, `release:test-pack`, boundary scripts, typecheck |
| **Verify (V)** | Runtime behavior proven for the row | [unified-verification-matrix.md](./unified-verification-matrix.md) Phase B **Pass** on desktop A/B where applicable; or scoped demo matrix Pass |
| **Accept (A)** | Known limitation; no further engineering until re-charter | [unified-verification-issues-register.md](./unified-verification-issues-register.md) + user-facing copy in gate doc |

**Rule:** **I alone is not v2.0-ready.** v2.0.0 requires **V** for in-scope features, or **A** with explicit copy in the v2.0 gate doc.

**Process:** [concentrated-version-delivery.md](./concentrated-version-delivery.md) — Phase A = Implement; Phase B–C = Verify + register.

---

## In scope for v2.0.0 (master checklist)

Legend: **I** = implemented on `main` · **V** = verified · **A** = accepted limitation · **—** = not done

### Lane K — Kernel + coordination (v1.9.0 band)

| ID | Requirement | I | V | Notes |
|----|-------------|---|---|-------|
| K1 | TransportPort; Nostr adapter only at boundary | ✓ | ✓ | `transport:boundaries:check` |
| K2 | Single membership write path per `profileId` | ✓ | ✓ | Port + tests |
| K3 | Coordination leave → B sees Excluded (K-M1–K-M2) | ✓ | ◐ | Maintainer desktop Pass 2026-06-01; formal A/B matrix optional detail |
| K4 | Sovereign / nostr_only honest copy (K-M3–K-M4) | ✓ | ◐ | Copy audit + tests; matrix Pass recorded |
| K5 | R1/R2 read models (K-M5–K-M6) | ✓ | ◐ | Engineering exit; ACC-01/02 remain **A** |
| K6 | `release:test-pack` + community invariants | ✓ | ✓ | 2026-06-01 |

Refs: [v1.9.0-kernel-backend-roadmap.md](./v1.9.0-kernel-backend-roadmap.md) · [v1.9.0-gate.md](../releases/v1.9.0-gate.md)

---

### Lane C — Community overhaul Phase 4 (v1.8.x)

| ID | Requirement | I | V | Notes |
|----|-------------|---|---|-------|
| C-4.1 | Mode-aware create + managed-workspace gate | ✓ | ◐ | [v1.8.1-scope.md](./v1.8.1-scope.md); full A/B matrix deferred |
| C-4.2 | Tabbed manage hub; home vs manage split | ✓ | ◐ | [v1.8.2-scope.md](./v1.8.2-scope.md) |
| C-4.3 | P4 optional (hybrid steward+vote, etc.) | — | — | **Record accept/defer** in v2.0 gate |

Ref: [community-system-overhaul-phased-roadmap.md](./community-system-overhaul-phased-roadmap.md) Phase 4

---

### Lane T — Trust / reliability (v1.8.x + v1.9.1)

| ID | Theme | I | V | Notes |
|----|-------|---|---|-------|
| REL-001 | Ledger precedence (left beats stale joined) | ✓ | ◐ | Shipped 2026-06-03; queue doc **stale** |
| REL-002 | Restore live boundary | ✓ | ◐ | Shipped |
| REL-003 | Profile scope isolation | ✓ | ◐ | Shipped |
| REL-004 | Leave outbox durability | ✓ | ◐ | Shipped v1.8.x batch |
| REL-005 | Mutation owner convergence | ◐ | ◐ | Partial; no single matrix row |
| MEM-002 | Cross-surface membership | ✓ | ◐ | Shipped |
| MEM-003 | Invite member pubkeys / thin roster | ✓ | ◐ | Shipped |
| MEM-004 | Invite-response-only ledger | ✓ | ◐ | Shipped |
| MEM-005 | Terminal invite clears inviter roster | ✓ | ◐ | Shipped v1.8.14 batch |
| MEM-006 | Empty groups re-hydrate | ✓ | ◐ | Shipped |
| MEM-001 | Roster architecture | — | **A** | Display-layer R2; accepted |
| DM-001 | Delete-for-me durability | ◐ | **A** | R1 port; ACC-01 |
| DM-002–007 | DM cross-device / delete paths | ◐ | — | **Out of v2.0 gate** unless re-chartered |
| MED-001 | Restore media relink | ✓ | ◐ | v1.9.1 band |
| MED-002 | Ghost voice quarantine | ✓ | ◐ | v1.9.1 band |

**Verify source:** Re-run [unified-verification-matrix.md](./unified-verification-matrix.md) §1–§7 before v2.0; sync register. Do **not** trust status column in [v1.5.0-known-issues-and-investigation-queue.md](./v1.5.0-known-issues-and-investigation-queue.md) (last updated 2026-05-15).

---

### Lane X — Experience (v1.9.2 / v1.8.15)

| ID | Deliverable | I | V | Notes |
|----|-------------|---|---|-------|
| X1 | Route warm-up skeleton | ✓ | ◐ | |
| X2 | Page transition shell | ✓ | ◐ | |
| X3 | Voice dock polish | ✓ | ◐ | |
| X4–X6 | Media preview | ✓ | **A** | Existing lightbox/players |

---

### Lane P — Platform + persistence (v1.9.3+ → v2.0)

| ID | Deliverable | I | V | Notes |
|----|-------------|---|---|-------|
| P1 | Android install path + local signing | ◐ | — | [android-p1-signing-runbook.md](./android-p1-signing-runbook.md); Tier 1 smoke **pending** |
| P2 | Mobile native components (push, background) | — | — | **v2.0 minimum:** document defer or MVP in gate |
| P3a–c | DM + projection SQLite convergence | ◐ | ◐ | Desktop DM native path largely done |
| P3d | Community group list + sealed messages SQLite | ✓ | — | v1.9.3; manual restart soak **pending** |
| P3 gaps | Remaining domains per [obscur-native-sqlite-policy.md](./obscur-native-sqlite-policy.md) | ✓ | — | P4-5 owner matrix **done** (2026-06-01); subtraction queue in policy doc |
| P4 | PWA/web production parity vs desktop | ◐ | — | Production web disabled; parity = policy + spot check |
| P-sign | Local self-signing (desktop minisign + Android JKS) | — | — | **Deferred** — [local-signing-strategy.md](./local-signing-strategy.md); unsigned desktop + debug APK OK for now |
| P-demo | Installers + website download + demo assets | ◐ | — | Desktop package **done**; website/GIFs **pending** |

---

### Cross-cutting (all bands)

| ID | Requirement | I | V | Notes |
|----|-------------|---|---|-------|
| AUTO | `pnpm release:test-pack` on release commit | ✓ | ✓ | |
| AUTO | `pnpm docs:check` | ✓ | ✓ | |
| DIST | Local desktop installer (`pnpm desktop:package`) | ✓ | ✓ | v1.9.3 NSIS |
| DIST | Repo update channel + signed artifacts | ◐ | — | Needs minisign private key |
| DEMO | v2.0 demo scripts + evidence | — | — | Create under `docs/assets/demo/` at closeout (v2.0 folder TBD) |
| DEMO | v1.9.x K-M evidence PNGs | — | — | Folder mostly empty |
| ENV | G6-4 two-client coordination soak | — | **S** | Env-blocked; not v2.0 blocker per handoff |

---

## Planned semver before v2.0.0 (remaining tags)

| Tag | Scope | Exit (Implement + Verify) |
|-----|-------|---------------------------|
| **v1.9.4** | Platform + demo prep | [v1.9.4-scope.md](./v1.9.4-scope.md) — Android Tier 1, signing charter, demo screenshots, website download draft, P3d restart soak |
| **v1.9.5** (optional) | Distribution trust | **Deferred** until pre–v2.0 demo — signing + channel + release APK |
| **v2.0.0** | Production demo | All § v2.0.0 exit rows below; v2.0 gate doc at closeout under `docs/releases/`; CHANGELOG; major bump |

---

## v2.0.0 exit (production demo gate)

Ship **v2.0.0** only when **all** are true:

### A — Prior bands (evidence-backed)

1. **v1.8.x** batch + Lane C/T/X rows in this doc are **I** and **V** or **A** in register.
2. **v1.9.x** Lane K K1–K6 **V** (or **A** with copy) on desktop A/B for applicable demo rows.
3. **Phase 4.3** recorded (accept or implement).

### B — Platform + distribution

4. **Desktop:** Signed or documented unsigned local install; `release-assets/` or repo channel policy honest.
5. **Android:** Release-signed APK built once; Tier 1 smoke **Pass** or **Blocked env** in register.
6. **SQLite:** [obscur-native-sqlite-policy.md](./obscur-native-sqlite-policy.md) gap list closed or accepted per domain.

### C — Verification + honesty

7. **Unified verification** — Full matrix pass (or section Pass + explicit skips) on tagged commit; register has no silent **Open** P0/P1 for in-scope rows.
8. **Accepted limitations** — DM-001, MEM-001 (and any other **A** rows) in v2.0 gate doc with links to [deletion-roster-limitations.md](../messaging/deletion-roster-limitations.md).

### D — Demo kit (B2B / tech community)

9. **Demo materials** — Scripts, GIFs/screenshots, known-limitations sheet for presenters.
10. **Website** — `/download` (or equivalent) with checksums, signing fingerprints, sideload honesty (no false “store” claims).
11. **Release evidence** — `pnpm release:test-pack` green; CHANGELOG `## [2.0.0]`.

### E — Explicitly out of v2.0.0

- iOS / Play Console / Apple paid programs  
- Public marketing push (policy: after v2.0.0)  
- Cooperative delete-for-everyone UI  
- Full kernel rewrite ([radical-overhaul-v2-target.md](../architecture/radical-overhaul-v2-target.md))  
- `docs/archive/**`, `docs/future/**` as shipping gates  

---

## How to use this doc

1. **Planning a patch** — Add rows only under the correct lane; link a scope doc; do not expand v2.0 scope without handoff note.
2. **Before claiming “feature done”** — Mark **I** when merged; mark **V** only after matrix/demo Pass.
3. **Before v2.0.0 tag** — Walk § v2.0.0 exit A–D; add v2.0 gate doc under `docs/releases/` mirroring this checklist.
4. **Agents** — Read [current-session.md](../handoffs/current-session.md) for active tag; this doc for full scope.

---

## Canonical index (do not duplicate scope elsewhere)

| Topic | Doc |
|-------|-----|
| 2.0 north star | [obscur-2.0-milestone-roadmap.md](./obscur-2.0-milestone-roadmap.md) |
| Demo stages | [v2.0-production-demo-path.md](./v2.0-production-demo-path.md) |
| **Release pipeline (order)** | [v2.0-release-pipeline.md](./v2.0-release-pipeline.md) |
| Verify pass | [unified-verification-matrix.md](./unified-verification-matrix.md) |
| Honest failures | [unified-verification-issues-register.md](./unified-verification-issues-register.md) |
| Community phases | [community-system-overhaul-phased-roadmap.md](./community-system-overhaul-phased-roadmap.md) |
| Kernel band | [v1.9.0-kernel-backend-roadmap.md](./v1.9.0-kernel-backend-roadmap.md) |
| Android | [android-p1-smoke-checklist.md](./android-p1-smoke-checklist.md) |
| Desktop package | [local-desktop-packaging.md](./local-desktop-packaging.md) |
| Signing | [local-signing-strategy.md](./local-signing-strategy.md) |

---

## Revision history

| Date | Change |
|------|--------|
| 2026-06-04 | Execution via v1.9.x contract; v2.0 delayed; full scope checklist restored |
| 2026-06-01 | Initial scope — I/V/A model; master checklist; v1.9.4→v2.0 plan; stale-queue warning |
