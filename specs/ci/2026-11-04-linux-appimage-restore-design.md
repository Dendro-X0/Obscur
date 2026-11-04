# Design — restore Linux AppImage on Full Release

**Date:** 2026-11-04  
**Parent:** `specs/ci/2026-11-03-full-release-beta4-investigation.md`  
**Goal:** Replenish `Obscur_2.0.0_amd64.AppImage` on `v2.0.0-beta.4` (or next tag) without waiting for Tor ARM bundles.

## Failure class

**workflow / native-build — AppImage linuxdeploy** on ubuntu-24.04 with `@tauri-apps/cli` **2.11.4** (downloads legacy `linuxdeploy/linuxdeploy-x86_64.AppImage`).

## Fix (one class)

1. Bump `@tauri-apps/cli` → **2.12.4** (bundler pins linuxdeploy **07333c6** + inlined GTK plugin).
2. Keep `NO_STRIP=true` + `APPIMAGE_EXTRACT_AND_RUN=1` + ubuntu-24.04 pin.
3. Install **`libevent-2.1-7(t64)`** — Tor sidecar needs `libevent-2.1.so.7` (run 41798235410 verbose proof).
4. Keep `.deb` fallback if AppImage still fails.
5. Prefer `--verbose` on Linux so linuxdeploy stderr is not swallowed.
6. Re-dispatch Full Release publish; attach AppImage to release (retain `.deb`).

## Evidence (41798235410)

```text
Downloading …/linuxdeploy-07333c6/linuxdeploy-x86_64.AppImage
ERROR: Could not find dependency: libevent-2.1.so.7
AppImage path failed; falling back to --bundles deb
```

Android failure on same run is a **separate** class (CLI 2.12 gradle assemble). Do **not** block AppImage restore: download `desktop-linux-x86_64` artifact and `gh release upload` onto `v2.0.0-beta.4` when AppImage is present.

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

## Outcome 2026-11-04

- [x] CLI 2.12.4 + libevent dep
- [x] Linux job built `Obscur_2.0.0_amd64.AppImage` (run 41800530990)
- [x] Uploaded to GitHub Release `v2.0.0-beta.4` (alongside `.deb`)
- SHA-256: `1e3409876005b56b2763dcb5776de85d83511348c720a953e0d3691ee746ba8b`
