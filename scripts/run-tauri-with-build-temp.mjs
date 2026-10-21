#!/usr/bin/env node
/**
 * Spawn `tauri` with Windows build TEMP redirected off the system drive.
 * Used by apps/desktop package scripts so cargo/rustc intermediates land on E:.
 */
import { spawn } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { applyWindowsBuildTempEnv } from "./lib/windows-build-temp.mjs";
import { spawnPnpm } from "./lib/spawn-pnpm.mjs";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const args = process.argv.slice(2);
const env = applyWindowsBuildTempEnv({ ...process.env }, {
  repoRoot,
  log: (msg) => console.log(`[tauri-temp] ${msg}`),
});

const child = spawnPnpm(["exec", "tauri", ...args], {
  cwd: path.join(repoRoot, "apps", "desktop"),
  env,
  stdio: "inherit",
});

child.on("exit", (code) => process.exit(code ?? 1));
