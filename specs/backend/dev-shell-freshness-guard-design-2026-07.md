# Design — Dev shell freshness guard

**Status:** Landed 2026-07-15 · L1 verified  
**Owner:** `apps/desktop/src-tauri/src/dev_shell_freshness.rs` + `scripts/lib/static-shell-stale.mjs`

## Goal

Stop stale-desktop debug loops where source edits appear to land but WebView still runs old JS.

## Invariants

1. **Never wipe** IndexedDB, Local Storage, keychain, or session files as part of normal rebuild freshness.
2. Kill only executables whose path is under `apps/desktop/src-tauri/target`.
3. Runtime stamp gate is active only when `OBSCUR_DESKTOP_STATIC_DEV=1`.
4. Cache purge allow-list only: `Cache`, `Code Cache`, `GPUCache`, `Service Worker` (under app data + profile `EBWebView` trees).

## Pipeline

| Layer | Owner | Action |
|-------|--------|--------|
| Stale detect | `static-shell-stale.mjs` | Watch `apps/pwa/app` **and** workspace `@obscur/*` package trees |
| Pre-launch | `obscur-dev-clean` bin | Kill managed PIDs + purge HTTP/code caches |
| Stamp | `build-pwa-shell.mjs` | Write `CLIENT_BUILD_STAMP` + `obscur-shell-manifest.json` |
| Runtime | Tauri setup + PWA banner | Compare DOM stamp vs on-disk manifest; mismatch → event + banner |

## Non-goals

- Vault wipe · live Next HMR (`dev:desktop:live`) · C10 transport changes
