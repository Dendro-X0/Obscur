# Obscur 2.0.0 milestone roadmap

**Status:** Active program framing (2026-05-21, revised)  
**North star:** Ship **v2.0.0** only after **all** plans outlined here and in linked program docs are complete — community overhaul, trust register, experience lane, **platform parity** (desktop + PWA/web + mobile installable), and **SQLite** as the unified persistence story across surfaces.

**Version policy:**

- **Two bands** before v2.0.0: **`v1.7.x`** (Phase 3 closeout) then **`v1.8.x`** (everything else). That is **not** “two tags total.”
- **Band opener = minor tag:** `v1.7.0`, then `v1.8.0` after the last `v1.7.x` patch. **Never skip `v1.8.0`.**
- **Work ships in patch tags:** `v1.7.1`, `v1.8.1`, `v1.8.2`, … — one milestone per tag when possible.
- **No v1.9 line**; no jump `v1.7.1` → `v1.8.1` without **`v1.8.0`** in between.

**Manual verification:** [manual-verification-environment.md](./manual-verification-environment.md) — desktop **Tester 1 (dark)** + **Tester 2 (light)**, two profile windows, no third account.

---

## Surfaces and backend (2.0 gate)

| Surface | Before v2.0.0 |
|---------|----------------|
| **Desktop** | Production ship target; A/B manual matrix authoritative |
| **PWA / Web** | Production shell; dev-only overlays off; same kernel as desktop |
| **Mobile (Android)** | **Installable** on emulator/device via **Android Studio** + **decentralized/local signing** (no purchased developer certificates) |
| **Persistence** | **SQLite** for all app databases (desktop + mobile native); PWA uses storage **ports** aligned to the same contracts — no second ad-hoc IDB-only truth path for features that claim cross-surface parity |

Shared **backend/kernel** in monorepo (`apps/pwa`, `packages/*`, native commands) — not three forks.

---

## How 2.0.0 differs from “another patch”

| Dimension | v1.7.x–v1.8.x | **v2.0.0 gate** |
|-----------|----------------|-----------------|
| Community | Phases 1–3 done; Phase **4** in **v1.8.x** | 4.1–4.2 exit + 4.3 decision |
| Trust | REL/MEM/MED rows per patch | All **P0/P1** fixed or **accepted with UI copy** |
| Experience | X1–X6 in **v1.8.x** patches | Demo + tests green |
| Platform | Desktop matrices + automated pack | Desktop + PWA + **signed installable Android** smoke |
| Storage | SQLite convergence slices per patch | Single documented SQLite owner per domain; no silent IDB/desktop drift for DM/community |

---

## Four parallel lanes

```text
Lane C — Community overhaul     [community-system-overhaul-phased-roadmap.md]
Lane T — Trust / known issues   [v1.5.0-known-issues-and-investigation-queue.md]
Lane X — Experience (UI/UX)     (§ v1.8.x — motion, media, voice)
Lane P — Platform + storage     (§ Platform lane — mobile install, SQLite)
         │
         └── all four green + manual matrices ──► v2.0.0 tag
```

**Rule:** One milestone per patch where possible. Do not tag a band until that band’s demo **Pass** column is filled for desktop A/B.

---

## v1.7.x — Phase 3 closeout + stabilization

**Band goal:** Finish Phase 3, fix regressions, complete **v1.7.x** manual matrix before any v1.8 feature slice.

| Patch theme | Content | Status |
|-------------|---------|--------|
| **P3.1–P3.3** | Relay gate, stewards, directory honesty | **Done on `main`** |
| **Hooks / UI** | `GroupManagementDialog` hook order (no conditional `useMemo` after `isOpen` return) | **Done on `main`** |
| **v1.7.1+** | Matrix sign-off only — no new scope until Pass column complete | Pending |
| **Tag** | `v1.7.1`, `v1.7.2`, … as fixes land — not a single monolithic `v1.7.0` dump | Policy |

**Exit (leave v1.7.x):**

- [v1.7.0 demo matrix](../assets/demo/v1.7.0/README.md) — all applicable rows **Pass** on Tester 1 + Tester 2 desktop.
- `pnpm release:test-pack` green on tagged commit.

**Do not start** Phase 4.1 or Lane X until v1.7.x exit is recorded in handoff.

---

## v1.8.x — Everything else before 2.0

All former **v1.8.0 / v1.9.0** scope lives here as **ordered patches** (suggested order; reorder only with handoff note).

### v1.8.x — Lane C (Phase 4)

| ID | Milestone | Exit |
|----|-----------|------|
| 4.1 | Mode-aware **create** flow | Descriptor + relay assessment at create |
| 4.2 | **Manage hub** | Tabbed shell canonical; home vs manage clear |
| 4.3 | P4 optional | Defer or accept in gate doc |

### v1.8.x — Lane T (trust)

| IDs | Theme |
|-----|-------|
| REL-003, REL-004, REL-005 | Multi-profile, leave outbox, owner convergence |
| MEM-002 … MEM-006 | Cross-surface membership (MEM-001 park unchanged) |
| MED-001, MED-002 | Media restore, ghost voice rows |

### v1.8.x — Lane X (experience)

| ID | Deliverable |
|----|-------------|
| **X1** | Warm-up **animations** (visual; not route prefetch alone) |
| **X2** | Page **transition** loading shell |
| **X3** | Voice call UI polish |
| **X4–X6** | Image / audio / video preview components |

Suggested patch split: **`v1.8.0`** (band opener) → **`v1.8.1`** (C-4.1) → **`v1.8.2`** (C-4.2) → **`v1.8.3+`** (T) → **`v1.8.6+`** (X) → **`v1.8.10+`** (P). Expect **on the order of 10–15+ patch tags** in v1.8.x, not two releases. See [v1.8.0-scope.md](./v1.8.0-scope.md).

### v1.8.x — Lane P (platform + SQLite)

| ID | Deliverable |
|----|-------------|
| **P1** | **Android install path** — Android Studio build, local/decentralized signing documented, emulator + one physical device smoke |
| **P2** | **Native components** required for mobile shell (push, keystore, background policy per [mobile-ui-stack-evaluation.md](./mobile-ui-stack-evaluation.md)) |
| **P3** | **SQLite** — converge DM/community/delete tombstones on native SQLite; align PWA ports; document migration owner (no dual conflicting migrations) |
| **P4** | PWA/web production parity check on same tag as desktop |

**Exit (leave v1.8.x):** All Lane C/T/X/P rows above + v1.8 demo matrix Pass on desktop A/B; mobile install row Pass on Android Studio environment.

---

## What “all plans in /docs” means for v2.0.0

**In scope for v2.0.0 gate** (must be done or explicitly accepted-with-copy):

| Source | Contents |
|--------|----------|
| [community-system-overhaul-phased-roadmap.md](./community-system-overhaul-phased-roadmap.md) | Phases 1–4 (1–3 shipped; 4 in v1.8.x) |
| [community-system-implementation-and-ui-plan.md](./community-system-implementation-and-ui-plan.md) | P0–P3 + P4 decision |
| [v1.5.0-known-issues-and-investigation-queue.md](./v1.5.0-known-issues-and-investigation-queue.md) | Open **P0/P1** rows (not MEM-001 / DM-001 accepted limitations) |
| This doc | Lanes **C, T, X, P** |

**Out of scope for v2.0.0** unless you re-charter:

| Source | Why |
|--------|-----|
| `docs/archive/**`, `docs/future/**` | Historical or kernel-long-term; not shipping gates |
| [v1.5.0-architecture-refactor-queue.md](./v1.5.0-architecture-refactor-queue.md) | Dedicated refactor milestone (ARCH-001) |
| Cooperative delete-for-everyone UI | Separate messaging charter |
| Full kernel/SQLite rewrite in [radical-overhaul-v2-target.md](../architecture/radical-overhaul-v2-target.md) | Lane **P** is **convergence**, not big-bang rewrite |

**Honest pace:** v2.0.0 is **many** patch releases away (roughly **10–15+** tags in v1.8.x alone), not “one more update after v1.7.1.”

---

## v2.0.0 — Program checkpoint only

Ship when **all** are true:

1. **v1.7.x** and **v1.8.x** exit criteria met (matrices + tags).
2. **Phase 4** exit (4.1, 4.2; 4.3 recorded).
3. **Known issues** — P0/P1 register closed or accepted-with-copy.
4. **Lane X** — X1–X6 complete.
5. **Lane P** — Installable Android + SQLite convergence + shared backend documented.
6. **Release evidence** — `pnpm release:test-pack`, v2.0.0 gate doc (create at closeout under `docs/releases/`), CHANGELOG `## [2.0.0]`.

**Still out of 2.0 unless chartered:**

- iOS App Store / paid signing programs.
- Cooperative delete-for-everyone UI (separate messaging charter).
- Optional third test account workflows.

---

## Distinction: “warm-up” terms

| Term | Meaning |
|------|---------|
| **Navigation warm-up (v1.5.2)** | Code/route prefetch |
| **Relay warm-up** | `warming_up` evidence confidence |
| **UX warm-up (X1)** | Visual skeleton/stagger — **v1.8.x** |

---

## Agent / maintainer default

1. Tag **v1.7.x** only after manual matrix Pass for that patch’s rows.
2. Use [manual-verification-environment.md](./manual-verification-environment.md) for every screenshot and quorum row.
3. Update [current-session handoff](../handoffs/current-session.md) with **band + lane + ID** (e.g. `v1.8.x / C-4.1`).
4. [MEM-001 park](./community-membership-invariants.md) — no new roster *features* until R2; honesty/convergence fixes stay in Lane T.

---

## Revision history

| Date | Change |
|------|--------|
| 2026-05-21 | Initial 2.0 map; Lane X; v1.9 band |
| 2026-05-21 | Revise: v1.7.x/v1.8.x patch bands only; fold v1.9 into v1.8.x; Lane P + SQLite + Android Studio signing; manual A/B env |
