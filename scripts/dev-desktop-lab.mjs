#!/usr/bin/env node
/**
 * Cut 3.4 — Tauri lab entry runner.
 * Defaults to Vite thin shell in lab context.
 * Opt out: OBSCUR_DESKTOP_LAB_ENTRY=next
 * Does not change production `tauri build` / beta frontendDist.
 */
import path from "node:path";
import { fileURLToPath } from "node:url";
import { resolveDesktopLabEntry } from "./obscur-desktop-lab-entry.mjs";
import { applyWindowsBuildTempEnv } from "./lib/windows-build-temp.mjs";
import { spawnPnpm } from "./lib/spawn-pnpm.mjs";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const entry = resolveDesktopLabEntry(process.env, { labContext: true });

console.log(`[desktop-lab] entry=${entry.id} · ${entry.label}`);
console.log(`[desktop-lab] tauri --config ${entry.tauriConfig}`);
console.log(`[desktop-lab] ${entry.webDevHint}`);
if (entry.id === "vite") {
  console.log("[desktop-lab] Production/beta frontendDist remains apps/pwa/out (no silent wipe).");
}

const env = applyWindowsBuildTempEnv({ ...process.env, OBSCUR_TAURI_LAB_UI: "1" }, {
  repoRoot,
  log: (msg) => console.log(`[tauri-temp] ${msg}`),
});

const child = spawnPnpm(
  ["exec", "tauri", "dev", "--config", entry.tauriConfig],
  {
    cwd: path.join(repoRoot, "apps", "desktop"),
    env,
    stdio: "inherit",
  },
);

child.on("exit", (code) => process.exit(code ?? 1));
