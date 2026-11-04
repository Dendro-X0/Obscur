# Design — restore Linux AppImage on Full Release

**Date:** 2026-11-04  
**Parent:** `specs/ci/2026-11-03-full-release-beta4-investigation.md`  
**Goal:** Replenish `Obscur_2.0.0_amd64.AppImage` on `v2.0.0-beta.4` (or next tag) without waiting for Tor ARM bundles.

## Failure class

**workflow / native-build — AppImage linuxdeploy** on ubuntu-24.04 with `@tauri-apps/cli` **2.11.4** (downloads legacy `linuxdeploy/linuxdeploy-x86_64.AppImage`).

## Fix (one class)

1. Bump `@tauri-apps/cli` → **2.12.4** (bundler pins linuxdeploy **07333c6** + inlined GTK plugin — upstream fix for “failed to run linuxdeploy” on modern Ubuntu).
2. Keep `NO_STRIP=true` + `APPIMAGE_EXTRACT_AND_RUN=1` + ubuntu-24.04 pin.
3. Keep `.deb` fallback if AppImage still fails.
4. Prefer `--verbose` on Linux so linuxdeploy stderr is not swallowed.
5. Re-dispatch Full Release publish; attach AppImage to release (retain `.deb`).

## Non-goals

- Windows ARM / Linux ARM (Tor Expert Bundle still 404)
- Signed `latest.json` updater feed

## Proof

| Layer | Command |
|-------|---------|
| L1 | lockfile resolves `@tauri-apps/cli@2.12.4` |
| L1 | `pnpm release:artifact-matrix-check` |
| L3 | Full Release linux job uploads `*.AppImage` · GH Release lists it |

## Claim

AppImage **restored** only when a published release asset named `Obscur_*_amd64.AppImage` exists for the marketing tag.
