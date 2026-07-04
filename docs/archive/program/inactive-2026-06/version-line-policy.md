# Version line policy (pre–v2.0.0)

**Status:** Active  
**Source of truth:** Root `package.json` `version`  
**Related:** [obscur-2.0-milestone-roadmap.md](./obscur-2.0-milestone-roadmap.md), [mobile-desktop-version-policy.md](./mobile-desktop-version-policy.md)

---

## Bands

| Band | Purpose | Band opener | Typical bumps |
|------|---------|-------------|----------------|
| **v1.7.x** | Phase 3 closeout | `v1.7.0` | `patch` per matrix-backed fix |
| **v1.8.x** | Lane C / T / X / P (community, trust, experience, platform prep) | `v1.8.0` | `patch` per milestone or gate slice |
| **v1.9.x** | Lane K (kernel + coordination backend) | `v1.9.0` | `patch` per B0/B1/B2 slice |
| **v2.0.0** | North star | — | Only when 2.0 gate is green |

**Rules**

- Do **not** skip a band opener (`v1.8.0`, `v1.9.0`, …).
- Do **not** jump minor versions without a roadmap/handoff note (e.g. `v1.7.3` → `v1.8.1` without `v1.8.0`).
- One user-visible milestone per **patch** tag when possible.
- **Do not bump version for CI-only changes** — see [maintainer-distribution-policy.md](./maintainer-distribution-policy.md).
- `apps/coordination` is **not** on the release version line yet (worker deploy is independent).

---

## Commands

| Command | Action |
|---------|--------|
| `pnpm version:plan` | Print current band and suggested next `patch` / `minor` / `major` (no writes) |
| `pnpm version:bump patch` | Bump root + `version.json`, then `version:sync` |
| `pnpm version:bump minor` | Open next band (e.g. `1.8.3` → `1.9.0`) |
| `pnpm version:sync` | Propagate root version to PWA, desktop, Tauri, packages, Android `tauri.properties` |
| `pnpm version:check` | Fail CI if any release-tracked manifest drifts |

**Tag workflow (optional — feature milestones only)**

1. Land **user-visible** milestone on `main` with tests/gate evidence.
2. `pnpm version:bump patch` (or `minor` when opening a band).
3. `pnpm version:check`.
4. Update `CHANGELOG.md` + matching `docs/releases/v1.8.14-release.md` (versioned filename per release).
5. Commit; tag `vX.Y.Z` only if you want a source archive pointer — **GitHub Release publish is optional** ([maintainer-distribution-policy.md](./maintainer-distribution-policy.md)).

Staying on one semver while shipping large slices is **expected**; increment only when the milestone is worth naming, not for CI fixes.

---

## Where the version appears

- Desktop: `apps/desktop/src-tauri/tauri.conf.json`
- In-app label: `NEXT_PUBLIC_APP_VERSION` from `scripts/build-pwa-shell.mjs`
- Android: `gen/android/app/tauri.properties` via `version:sync`
- GitHub Release: single `vX.Y.Z` tag for desktop (+ optional mobile artifact)

---

## Current line (2026-05)

- **Shipping band:** `v1.8.x` (community Phase 4, trust, desktop gates).
- **Next structural band:** `v1.9.x` when Lane K B0 is tagged ([v1.9.0-scope.md](./v1.9.0-scope.md)).
- **Suggested next patch after G6-4 / coordination dev fixes:** `v1.8.4` (`pnpm version:bump patch`).
- **Release train (canonical):** [v1.8.x-release-train.md](./v1.8.x-release-train.md)
