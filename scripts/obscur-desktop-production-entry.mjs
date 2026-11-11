#!/usr/bin/env node
/**
 * Cut 5.3 — Vite is the committed production frontendDist.
 * Default: Vite (apps/desktop-ui/dist)
 * Rollback: OBSCUR_DESKTOP_PRODUCTION_ENTRY=next → Next overlay (no silent wipe)
 * Opt-in flag OBSCUR_DESKTOP_UI_AS_DEFAULT=1 remains accepted (redundant after 5.3).
 *
 * @see specs/backend/cut5-vite-production-cutover-design-2026-11-10.md
 */

export const DESKTOP_UI_AS_DEFAULT_ENV = "OBSCUR_DESKTOP_UI_AS_DEFAULT";
export const DESKTOP_PRODUCTION_ROLLBACK_ENV = "OBSCUR_DESKTOP_PRODUCTION_ENTRY";

export const DESKTOP_PRODUCTION_FRONTEND = Object.freeze({
  next: Object.freeze({
    id: "next",
    frontendDist: "../../pwa/out",
    label: "Next.js beta / rollback",
    /** Relative to apps/desktop */
    devTauriConfig: "src-tauri/tauri.dev.conf.json",
    buildTauriConfig: "src-tauri/tauri.next.rollback.conf.json",
  }),
  vite: Object.freeze({
    id: "vite",
    frontendDist: "../../desktop-ui/dist",
    label: "Vite desktop-ui (production default)",
    /** Dev overlay keeps :3350; build uses committed tauri.conf.json */
    devTauriConfig: "src-tauri/tauri.vite.lab.conf.json",
    buildTauriConfig: null,
  }),
});

/**
 * Explicit PRODUCTION_ENTRY wins. Else Vite (Cut 5.3 committed default).
 * @param {NodeJS.ProcessEnv} [env]
 * @returns {"vite" | "next"}
 */
export const resolveDesktopProductionEntryId = (env = process.env) => {
  const explicit = String(env[DESKTOP_PRODUCTION_ROLLBACK_ENV] ?? "").trim().toLowerCase();
  if (explicit === "vite" || explicit === "next") {
    return explicit;
  }
  // Vestigial opt-in: still accepted as vite; does not force next when unset.
  void env[DESKTOP_UI_AS_DEFAULT_ENV];
  return "vite";
};

/**
 * @param {NodeJS.ProcessEnv} [env]
 */
export const resolveDesktopProductionFrontend = (env = process.env) => {
  const id = resolveDesktopProductionEntryId(env);
  return DESKTOP_PRODUCTION_FRONTEND[id];
};

/** Committed production conf after Cut 5.3. */
export const COMMITTED_PRODUCTION_FRONTEND_DIST = "../../desktop-ui/dist";
export const NEXT_ROLLBACK_FRONTEND_DIST = "../../pwa/out";

export const isCommittedProductionVite = (frontendDist) => (
  String(frontendDist ?? "").replace(/\\/g, "/") === COMMITTED_PRODUCTION_FRONTEND_DIST
);

/** @deprecated Cut 5.1 helper name — prefer isCommittedProductionVite after 5.3 */
export const isCommittedProductionStillNext = (frontendDist) => (
  String(frontendDist ?? "").replace(/\\/g, "/") === NEXT_ROLLBACK_FRONTEND_DIST
);

/**
 * Build argv for `tauri <command>` under apps/desktop cwd.
 * @param {"dev" | "build"} command
 * @param {NodeJS.ProcessEnv} [env]
 * @returns {string[]}
 */
export const resolveDesktopProductionTauriArgs = (command, env = process.env) => {
  const entry = resolveDesktopProductionFrontend(env);
  const config = command === "dev" ? entry.devTauriConfig : entry.buildTauriConfig;
  if (config) {
    return [command, "--config", config];
  }
  return [command];
};
