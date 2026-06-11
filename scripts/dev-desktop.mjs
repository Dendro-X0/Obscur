#!/usr/bin/env node
/**
 * Start desktop dev with env flags (no cross-env required at repo root).
 * Ensures Next is ready before Tauri (same path as dev:desktop:fast).
 *
 *   node scripts/dev-desktop.mjs --online
 *   node scripts/dev-desktop.mjs --offline
 *   node scripts/dev-desktop.mjs --webpack
 */
import { spawn } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { mergePwaEnvLocal } from "./load-pwa-env-local.mjs";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const flags = new Set(process.argv.slice(2));
const env = mergePwaEnvLocal({ ...process.env });

if (flags.has("--online")) {
  env.NEXT_PUBLIC_OBSCUR_EXPERIMENT_ONLINE = "1";
  env.NEXT_PUBLIC_OBSCUR_RADICAL_TRUTH = "1";
} else if (flags.has("--offline")) {
  env.NEXT_PUBLIC_OBSCUR_EXPERIMENT_ONLINE = "0";
}

if (flags.has("--webpack") || flags.has("--turbopack")) {
  env.OBSCUR_DESKTOP_DEV_BUNDLER = flags.has("--turbopack") ? "turbopack" : "webpack";
} else if (!env.OBSCUR_DESKTOP_DEV_BUNDLER) {
  env.OBSCUR_DESKTOP_DEV_BUNDLER = "webpack";
}

const staticArgs = ["scripts/dev-desktop-static.mjs"];
if (flags.has("--online")) {
  staticArgs.push("--", "--online");
}

const child = spawn("node", staticArgs, {
  cwd: repoRoot,
  stdio: "inherit",
  env,
  shell: false,
});

child.on("exit", (code) => {
  process.exit(code ?? 1);
});
