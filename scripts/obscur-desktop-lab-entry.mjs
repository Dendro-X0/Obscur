#!/usr/bin/env node
/**
 * Cut 3.4 — dual-entry quarantine resolver.
 * Lab can default to Vite when OBSCUR_TAURI_LAB_UI=1 (or explicit ENTRY=vite).
 * Production / beta Tauri build path stays Next (`apps/pwa/out`) — never silently wiped.
 *
 * @see specs/backend/cut3-dual-entry-quarantine-2026-11-09.md
 */

export const DESKTOP_LAB_ENTRY_ENV = "OBSCUR_DESKTOP_LAB_ENTRY";
export const DESKTOP_LAB_UI_FLAG_ENV = "OBSCUR_TAURI_LAB_UI";

export const DESKTOP_ENTRY_CONFIG = Object.freeze({
  next: Object.freeze({
    id: "next",
    label: "Next.js product shell (beta / production)",
    tauriConfig: "src-tauri/tauri.dev.conf.json",
    liveTauriConfig: "src-tauri/tauri.live.dev.conf.json",
    productionFrontendDist: "../../pwa/out",
    webDevHint: "pnpm -C apps/pwa dev  # :3340",
  }),
  vite: Object.freeze({
    id: "vite",
    label: "Vite thin lab shell (Cut 3)",
    tauriConfig: "src-tauri/tauri.vite.lab.conf.json",
    productionFrontendDist: "../../desktop-ui/dist",
    webDevHint: "pnpm -C apps/desktop-ui dev  # :3350",
  }),
});

/**
 * @param {NodeJS.ProcessEnv} [env]
 * @param {Readonly<{ labContext?: boolean }>} [options]
 * @returns {"vite" | "next"}
 */
export const resolveDesktopLabEntryId = (env = process.env, options = {}) => {
  const explicit = String(env[DESKTOP_LAB_ENTRY_ENV] ?? "").trim().toLowerCase();
  if (explicit === "vite" || explicit === "next") {
    return explicit;
  }
  const labUiOn = String(env[DESKTOP_LAB_UI_FLAG_ENV] ?? "").trim() === "1";
  if (labUiOn || options.labContext === true) {
    return "vite";
  }
  return "next";
};

/**
 * @param {NodeJS.ProcessEnv} [env]
 * @param {Readonly<{ labContext?: boolean }>} [options]
 */
export const resolveDesktopLabEntry = (env = process.env, options = {}) => {
  const id = resolveDesktopLabEntryId(env, options);
  return DESKTOP_ENTRY_CONFIG[id];
};
