# Design — CI updates + website ↔ GitHub Releases sync + multi-arch installers

**Date:** 2026-11-03  
**Status:** Phase A landed · Phase B workflow landed (2026-11-03) — proof = next Full Release  
**Pairs with:** `2026-11-03-ci-restore-preflight.md` · `docs/program/obscur-v2-install-build-guide.md`

## Answers

### Can the website stay in sync with GitHub Releases?

**Yes.** Current stack already has two layers:

| Layer | Source | Role |
|-------|--------|------|
| **Live assets** | GitHub Releases API (`/releases/tags/v{releaseTag}`) | Download URLs + sizes (revalidate ~300s) |
| **Manifest** | `release-assets/manifest.json` (committed after Full Release) | SHA-256 checksums + signing policy + offline fallback |

Identity comes from `version.json.releaseTag` (e.g. `2.0.0-beta.3`). Download hrefs prefer `releases/download/v{tag}/{fileName}`.

**Gap today:** UI shows **one preferred installer per OS** (`pickPreferredDesktopAsset`). Extra arch files on the same release would be invisible except in the checksum details section.

### Do some OSes need multiple installers?

**Yes** (Cursor-style: Windows x64/ARM64, macOS Universal/Intel/Apple Silicon, Linux x64/ARM).

**What we ship today (v2.0.0-beta.3):**

| OS | Built today | Not built yet |
|----|-------------|---------------|
| Windows | `*_x64-setup.exe` | ARM64 |
| macOS | `*_aarch64.dmg` | Intel / Universal |
| Linux | `*_amd64.AppImage` | aarch64 |

Phase A: **UI + selectors ready for N variants per OS** (lists whatever GitHub publishes).  
Phase B: **expand Full Release matrix** to produce missing arches (costly CI time; separate band).

## Phase A (this band)

1. **CI hygiene** — pin workflows that still use Node `20.11.0` / `20` → **`22`** (matches reliability-gates; clears Actions Node-20 deprecation warning). Touch: `docs-check`, `version-check`, `release.yml` desktop/web jobs, android/ios manual as available.
2. **`@dweb/core/release-download-targets`** — add arch classification + `listDesktopDownloadVariants(assets, platform)` returning ordered variants (label, href, size, arch).
3. **Download page** — per OS card: primary CTA = preferred; secondary links for other arches when present. Checksums stay from manifest.
4. **Tests** — unit tests for variant listing (x64 + arm coexist).

## Phase B (Full Release matrix)

| Matrix cell | Runner | Rust target | Artifact name |
|-------------|--------|-------------|---------------|
| Windows x64 | `windows-latest` | host (`use_host_target`) | `desktop-windows-x86_64` |
| macOS Apple Silicon | `macos-latest` | host (`use_host_target`) | `desktop-macos-aarch64` |
| macOS Intel | `macos-latest` | `x86_64-apple-darwin` (cross) | `desktop-macos-x86_64` |
| Linux x64 | `ubuntu-latest` | host (`use_host_target`) + `libfuse2` / `APPIMAGE_EXTRACT_AND_RUN` | `desktop-linux-x86_64` |

**Deferred (no Tor Expert Bundle on archive.torproject.org):** Windows ARM64; Linux ARM64 (`desktop-linux-aarch64` — 404 for `tor-expert-bundle-linux-aarch64-*`).

**Supporting changes:**
- `scripts/setup-tor.mjs` accepts `--triple=<tauri-triple>` for cross-builds (mac Intel on Apple Silicon runners).
- verify/publish download `desktop-{windows,macos,linux}-*` with `merge-multiple: true`.
- streaming-update manifest picks preferred per key; adds `darwin-x86_64` / `linux-aarch64` when files exist.
- Investigation: `specs/ci/2026-11-03-full-release-beta4-investigation.md` (run 41658387338).

## Non-goals

- Hosting binaries on Vercel (keep GitHub Releases as CDN)
- Claiming Universal macOS before CI produces it
- Local `desktop:package` on overloaded host

## Proof

| Layer | Command |
|-------|---------|
| L1 | unit tests for `listDesktopDownloadVariants` |
| L1 | `pnpm docs:check` if docs touched; workflow YAML review |
| L2 | website build / download page typecheck |
| L3 | After next Full Release: download page shows same filenames as `gh release view` |

## Claim language

- Phase A **implemented** when variant API + download UI ship and tests Pass.
- Phase B workflow **implemented** when `release.yml` matrix publishes macOS Intel + Win/mac/linux x64 (Linux ARM deferred).
- Sync **verified** when a published tag’s asset names match the download page after revalidate.
- Multi-arch **product-complete** only after the next Full Release run uploads those artifacts to GitHub Releases.

## Phase B landed files

- `.github/workflows/release.yml` — 4 desktop matrix cells (Linux/Win ARM deferred); host vs cross `use_host_target`; patterned artifact download
- `scripts/setup-tor.mjs` — `--triple=` for cross-builds
- `scripts/build-streaming-update-manifest.mjs` — optional `darwin-x86_64` / `linux-aarch64`
- `scripts/check-release-artifact-matrix.mjs` — Phase B snippet asserts
- `packages/dweb-core/src/release-download-targets.ts` — Linux preferred = amd64 when both exist
- `specs/ci/2026-11-03-full-release-beta4-investigation.md` — linuxdeploy + Tor aarch64 404
