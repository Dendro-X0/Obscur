# Maintainer distribution policy

**Status:** Active (2026-06-02)  
**Owner:** Maintainer

---

## Version bumps

| Rule | Detail |
|------|--------|
| **No CI-only releases** | Do **not** bump `package.json` / tag to “fix” release workflows, artifact parity, or gate scripts alone. |
| **User-visible milestone required** | Each version increment must ship **feature improvements or extensions** users can notice (UX, bots, membership convergence, trust fixes, etc.). |
| **Stay on current semver during development** | Large slices may live on `main` at one version (e.g. `1.8.14`) until a real milestone is ready. |

See also [version-line-policy.md](./version-line-policy.md) and [v1.8.x-batch-implementation-lane.md](./v1.8.x-batch-implementation-lane.md).

---

## GitHub Releases — ignore, don't fight

GitHub has **no** “disable Releases” toggle (unlike Issues or Wikis). Settings → General → **Releases** only offers **release immutability** — not a feature off switch.

| What you can do | Effect |
|-----------------|--------|
| **Hide sidebar noise** | Repo home → **About** (gear icon) → **Include in the home page** → uncheck **Releases** |
| **Ignore the page** | Safe — clients read `version.json` + repo channel on `main`, not `/releases` |
| **Bulk delete old pages** | Optional: `pnpm github:releases:retire -- --apply` with [`gh`](https://cli.github.com/) — cosmetic only |

Unified version: [unified-version-source.md](./unified-version-source.md).

## Full Release workflow (retired)

| Rule | Detail |
|------|--------|
| **Not used by default** | This maintainer does **not** rely on Obscur Full Release or GitHub **Latest** for day-to-day shipping. |
| **Local packaging instead** | `pnpm desktop:package` — see [local-desktop-packaging.md](./local-desktop-packaging.md). |
| **If CI runs anyway** | Tag push may still trigger remote builds; that is **orthogonal** to getting an installer on your machine. Do not wait on it. |

Future maintainers may re-enable CI; that does not change the local path above.

---

## How users get builds

| Channel | When |
|---------|------|
| **Local installer** | `pnpm desktop:package` → install from `release-assets/` or Tauri `bundle/` — **primary** |
| **Repo update channel** | Push `channel/stable/*` on `main` after local signed build |
| **Git clone / GitHub ZIP** | Source-only; build with commands above |
| **Local dev** | `pnpm dev:desktop:online` |
| **GitHub Release installers** | **Not used** — historical pages may remain; sidebar hideable via About → gear |

---

## Desktop in-app updates (repo channel — not Full Release)

| Piece | Location |
|-------|----------|
| Stable feed | `apps/desktop/release/channel/stable/latest.json` on **`main`** (raw GitHub URL) |
| Policy | `apps/desktop/release/channel/stable/streaming-update-policy.json` |
| Version truth | Root `version.json` on **`main`** — **not** GitHub Releases **Latest** |
| Publish | `pnpm desktop:update-channel:publish` after **local signed** build — no CI |
| Runtime | Tauri updater `dialog: false` — download + apply + restart inside the app |

The desktop app **does not** use `releases/latest` by default anymore. See [channel README](../../apps/desktop/release/channel/stable/README.md).

## v1.9.x (Lane K) posture

- **Program band** = kernel + coordination + honest membership UX — not a semver tag schedule.
- **B0–B3 + partial B4** structural work may already be on `main`; **tag when** a bundled user-visible milestone is ready (or skip public tag and ship via ZIP).
- **Next tangible focus:** land v1.8.x batch payload (bots, mobile polish, invites, sidebar previews) + Lane K exit evidence (K-M matrix), not CI publish loops.

---

## Revision

| Date | Change |
|------|--------|
| 2026-06-02 | Initial policy — no CI-only versions; ZIP-first; Full Release optional |
