#!/usr/bin/env node
/**
 * Cut 5.3 — desktop Tauri production recipes (Vite committed default).
 * Usage:
 *   node scripts/run-desktop-production.mjs dev
 *   node scripts/run-desktop-production.mjs build
 *
 * Default → Vite (committed frontendDist ../../desktop-ui/dist)
 * Rollback → OBSCUR_DESKTOP_PRODUCTION_ENTRY=next (Next overlay; no silent wipe)
 *
 * @see specs/backend/cut5-vite-production-cutover-design-2026-11-10.md
 */
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  resolveDesktopProductionFrontend,
  resolveDesktopProductionTauriArgs,
} from "./obscur-desktop-production-entry.mjs";
import { applyWindowsBuildTempEnv } from "./lib/windows-build-temp.mjs";
import { spawnPnpm } from "./lib/spawn-pnpm.mjs";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const command = String(process.argv[2] ?? "").trim().toLowerCase();

if (command !== "dev" && command !== "build") {
  console.error("Usage: node scripts/run-desktop-production.mjs <dev|build>");
  process.exit(2);
}

const entry = resolveDesktopProductionFrontend(process.env);
const tauriArgs = resolveDesktopProductionTauriArgs(command, process.env);

console.log(`[desktop-production] entry=${entry.id} · ${entry.label}`);
console.log(`[desktop-production] tauri ${tauriArgs.join(" ")}`);
console.log(`[desktop-production] frontendDist target ${entry.frontendDist}`);
if (entry.id === "next") {
  console.log("[desktop-production] Next rollback overlay (Cut 5.3 · no silent wipe of apps/pwa).");
} else {
  console.log("[desktop-production] Vite production default (rollback: OBSCUR_DESKTOP_PRODUCTION_ENTRY=next).");
}

const env = applyWindowsBuildTempEnv({ ...process.env }, {
  repoRoot,
  log: (msg) => console.log(`[tauri-temp] ${msg}`),
});

const child = spawnPnpm(
  ["exec", "tauri", ...tauriArgs],
  {
    cwd: path.join(repoRoot, "apps", "desktop"),
    env,
    stdio: "inherit",
  },
);

child.on("exit", (code) => process.exit(code ?? 1));
