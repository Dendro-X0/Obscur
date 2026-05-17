#!/usr/bin/env node
/**
 * Tauri beforeBuildCommand entry — resolves repo root from apps/desktop regardless of caller cwd.
 */
import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const desktopDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const repoRoot = path.resolve(desktopDir, "..", "..");
const buildScript = path.join(repoRoot, "scripts", "build-pwa-shell.mjs");

const result = spawnSync(process.execPath, [buildScript, ...process.argv.slice(2)], {
  cwd: repoRoot,
  env: process.env,
  stdio: "inherit",
});

process.exit(result.status ?? 1);
