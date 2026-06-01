#!/usr/bin/env node
/**
 * Start desktop dev with env flags (no cross-env required at repo root).
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
  env.NEXT_PUBLIC_OBSCUR_RADICAL_TRUTH = "0";
} else if (flags.has("--offline")) {
  env.NEXT_PUBLIC_OBSCUR_EXPERIMENT_ONLINE = "0";
}

if (flags.has("--webpack")) {
    env.OBSCUR_DESKTOP_DEV_BUNDLER = "webpack";
}

const child = spawn("pnpm", ["-C", "apps/desktop", "dev"], {
    cwd: repoRoot,
    stdio: "inherit",
    env,
    shell: true,
});

child.on("exit", (code) => {
    process.exit(code ?? 1);
});
