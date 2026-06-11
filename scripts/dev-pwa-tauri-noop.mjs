#!/usr/bin/env node
/**
 * Tauri dev beforeDevCommand noop.
 * Next is always started by scripts/dev-desktop-fast.mjs before Tauri launches.
 * Intentionally does nothing — avoids Windows libuv crash on port-reuse exit.
 */
console.log("[dev-pwa-tauri] skipped — static shell (dev:desktop) or Next started by dev:desktop:live");
