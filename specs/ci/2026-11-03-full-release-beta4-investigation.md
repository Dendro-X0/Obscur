# CI investigation — Full Release v2.0.0-beta.4

**Run:** https://github.com/Dendro-X0/Obscur/actions/runs/41658387338  
**Status:** failure · Publish skipped  
**Date:** 2026-11-03

## Why release files did not update

Branch push gates (docs / version / reliability-gates / Vercel) are **not** Full Release. Publish only runs after all desktop matrix cells succeed. This run never reached Verify/Publish.

## Job results

| Job | Result |
|-----|--------|
| desktop-windows-x86_64 | success |
| desktop-macos-aarch64 | success |
| desktop-macos-x86_64 | success |
| desktop-linux-x86_64 | **failure** — `failed to run linuxdeploy` (AppImage bundle) |
| desktop-linux-aarch64 | **failure** — Tor Expert Bundle **404** for `linux-aarch64` (14.0.6 and newer checked) |
| Verify / Publish | skipped |

## Primary failure class (this iteration)

**workflow / native-build — Linux desktop matrix**

1. Remove `desktop-linux-aarch64` until Tor publishes an aarch64 expert bundle (same class as Win ARM deferral).
2. Linux x64 AppImage: install `libfuse2` (Ubuntu 24.04) + build **host** without forced `--target` (restore beta.3 path that produced AppImages).

## Fix plan

- [x] Drop linux-aarch64 matrix cell + matrix-check snippets
- [x] Linux deps: `libfuse2` / `libfuse2t64` + `APPIMAGE_EXTRACT_AND_RUN=1`
- [x] Host-native builds: omit `tauri build --target` when `matrix.use_host_target`
- [x] Push + re-dispatch Full Release `v2.0.0-beta.4` → run https://github.com/Dendro-X0/Obscur/actions/runs/41766745843 (commit `ba0bcbba`)

## Follow-up run 41766745843 (still failure)

| Job | Result |
|-----|--------|
| desktop-windows-x86_64 | success |
| desktop-macos-x86_64 | success |
| desktop-macos-aarch64 | **failure** — `FETCH_ARGS[@]: unbound variable` (bash 3.2 + `set -u` + empty array) |
| desktop-linux-x86_64 | **failure** — still `failed to run linuxdeploy` (fuse env alone insufficient) |
| Verify / Publish | skipped |

### Additional fix (same failure class: workflow / native-build)

- [x] Prefetch: branch host vs `--target` without empty-array expansion
- [x] `NO_STRIP=true` for AppImage (linuxdeploy bundled strip vs `.relr.dyn` on Ubuntu 24.04)
- [x] Re-dispatch Full Release `v2.0.0-beta.4` → run https://github.com/Dendro-X0/Obscur/actions/runs/41768900710 (commit `2ebbe4dd`)

## Follow-up run 41768900710 (still failure)

| Job | Result |
|-----|--------|
| win + both mac | success |
| desktop-linux-x86_64 | **failure** — linuxdeploy dies in &lt;1s on **Ubuntu 26.04 / resolute** (`ubuntu-latest` migrated) |
| Verify / Publish | skipped |

Root cause vs beta.3 (40281639059): that run used **ubuntu-24.04**; this run’s apt mirrors are `resolute` / `ubuntu/26.04`.

### Additional fix

- [x] Pin Linux desktop matrix to `ubuntu-24.04` (restore known-good AppImage host)
- [ ] Re-dispatch Full Release `v2.0.0-beta.4`

## Secondary (do not fix this iteration)

- Actions Node 20 deprecation warning on action runtimes
- Broader CI pin of `ubuntu-latest` → 24.04 outside Full Release desktop
