# Unified version source (canonical)

**Status:** Active (2026-06-02)  
**Replaces for user-facing truth:** GitHub Releases (feature **disabled** on this repo)

---

## Single source of truth

| What | Where | URL (stable channel) |
|------|--------|----------------------|
| **Current semver** | Root `version.json` on **`main`** | `https://raw.githubusercontent.com/Dendro-X0/Obscur/main/version.json` |
| **Desktop update feed** | Repo channel | `.../apps/desktop/release/channel/stable/latest.json` |
| **Download URLs + checksums** | Policy manifest | `.../apps/desktop/release/channel/stable/streaming-update-policy.json` |
| **Human release notes** | `CHANGELOG.md` on **`main`** | `https://github.com/Dendro-X0/Obscur/blob/main/CHANGELOG.md` |

Every client surface (desktop in-app updater, PWA/website download, docs) reads from this table.

---

## GitHub Releases — not canonical

GitHub does **not** offer a repo-wide “disable Releases” checkbox. General → **Releases** is only **release immutability**.

**Hide sidebar (optional):** Repo home → **About** gear → **Include in the home page** → uncheck **Releases**.

That removes the misleading **Latest v1.8.11** badge from the landing page. Old release pages may still exist at `/releases`; nothing in Obscur reads them.

| Do not use | Why |
|------------|-----|
| GitHub **Latest** / `/releases` | Stale history; not version truth |
| `releases/latest` API | Obscur clients use repo channel instead |
| Obscur Full Release workflow | Retired; tag push trigger removed |
| `pnpm github:releases:retire` | Optional cosmetic cleanup; requires `gh` CLI |

---

## Who reads what

| Surface | Version | Install / update |
|---------|---------|------------------|
| **Desktop app** | `version.json` + Tauri feed | Repo channel `latest.json`; in-app install |
| **PWA `/download`** | Policy manifest | `fetchRepoChannelDownloadRelease()` |
| **Website `/download`** | Policy manifest | `readUnifiedReleaseSnapshot()` in site-content |
| **Maintainer** | `pnpm version:sync` | `pnpm desktop:package` |

Runbook: [local-desktop-packaging.md](./local-desktop-packaging.md)

---

## Maintainer checklist (cutover — completed)

- [x] Hide **Releases** on repo home (About → gear → Include in the home page)  
- [x] Retire Full Release tag-push trigger (workflow)  
- [x] Point app/website download at repo channel policy  
- [ ] `pnpm desktop:package --publish-channel` when signed installers exist  
- [ ] Push `main` so raw URLs serve real artifact links  

---

## Revision

| Date | Change |
|------|--------|
| 2026-06-02 | Unified version on `main`; GitHub Releases not used (no disable toggle; sidebar hide via About) |
| 2026-06-02 | Initial repo channel (supersedes releases/latest) |
