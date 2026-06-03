# Local desktop packaging (no CI)

**Status:** Active · **Policy:** [maintainer-distribution-policy.md](./maintainer-distribution-policy.md)

You do **not** need GitHub Actions, tag pushes, or Obscur Full Release to produce a desktop installer. Build on your machine, install from disk, optionally publish the repo update channel so other desktop clients can pull the same build in-app.

---

## One command

From repo root (Windows example — same entry point on macOS/Linux):

```bash
pnpm desktop:package
```

This runs:

1. `pnpm version:sync`
2. `pnpm build:desktop` (PWA shell + `tauri build`)
3. Copies installers + `.sig` files into `release-assets/{windows,macos,linux}/`

**Typical runtime:** depends on your machine and cache (often 10–25 minutes locally — still **your** machine, **your** progress bar, **your** installer at the end).

### Flags

| Flag | Effect |
|------|--------|
| `--skip-build` | Only copy existing `target/release/bundle/` into `release-assets/` |
| `--skip-version-sync` | Skip `version:sync` |
| `--publish-channel` | Also run `pnpm desktop:update-channel:publish` (needs signed artifacts) |

---

## Where the installer lands

| Platform | Tauri output (primary) | Copied to |
|----------|------------------------|-----------|
| Windows | `apps/desktop/src-tauri/target/release/bundle/nsis/Obscur_*_x64-setup.exe` | `release-assets/windows/` |
| macOS | `.../bundle/dmg/*.dmg` | `release-assets/macos/` |
| Linux | `.../bundle/appimage/*.AppImage` | `release-assets/linux/` |

Double-click the installer under `release-assets/` or the Tauri `bundle/` path. No browser, no GitHub Releases page.

---

## In-app updates (optional, after local build)

When you have **signed** updater artifacts (`.sig` next to installers):

```bash
pnpm desktop:package --publish-channel
git add apps/desktop/release/channel/stable version.json
git commit -m "chore(desktop): publish stable update channel"
git push origin main
```

Desktop clients read `version.json` and `channel/stable/latest.json` from **`main`**, not GitHub **Latest**.

---

## What we are not doing

| Avoid | Why |
|-------|-----|
| Obscur Full Release workflow | ~hour on GitHub; **Latest** stuck on old tags; publish step skipped unless manually toggled |
| Tag push “to get a build” | Same remote pipeline; no local installer in your hands |
| Waiting on **Latest** to move | That page is optional; **not** the product version on `main` |

CI may return for other maintainers later. **Your** path right now: **local package → install → optional channel push**.

---

## Dev without packaging

```bash
pnpm dev:desktop:online
```

Hot reload for day-to-day feature work. Package only when you want an installer or update channel.
