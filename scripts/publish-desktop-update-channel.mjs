#!/usr/bin/env node
/**
 * Publish stable repo update channel manifests (no GitHub Release workflow).
 * Run after local signed desktop artifacts exist under release-assets/.
 */
import { spawnSync } from "node:child_process";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { loadMaintainerSigningEnv } from "./load-maintainer-signing-env.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, "..");

const CHANNEL_BASE_URL =
  "https://raw.githubusercontent.com/Dendro-X0/Obscur/main/apps/desktop/release/channel/stable";
const CHANNEL_DIR = resolve(repoRoot, "apps/desktop/release/channel/stable");
const ASSETS_DIR = resolve(repoRoot, "release-assets");

const run = (label, args) => {
  const result = spawnSync(process.platform === "win32" ? "pnpm.cmd" : "pnpm", args, {
    cwd: repoRoot,
    stdio: "inherit",
    env: process.env,
  });
  if (result.status !== 0) {
    throw new Error(`${label} failed (exit ${result.status ?? "unknown"})`);
  }
};

const main = () => {
  loadMaintainerSigningEnv();
  console.log("[desktop:update-channel:publish] Publishing stable channel to repo path...");
  run("tauri updater feed", [
    "release:tauri-updater-feed:build",
    "--",
    "--assets-dir",
    ASSETS_DIR,
    "--output",
    resolve(CHANNEL_DIR, "latest.json"),
    "--base-url",
    CHANNEL_BASE_URL,
  ]);
  run("streaming policy manifest", [
    "release:streaming-update-manifest:build",
    "--",
    "--assets-dir",
    ASSETS_DIR,
    "--output",
    resolve(CHANNEL_DIR, "streaming-update-policy.json"),
    "--base-url",
    CHANNEL_BASE_URL,
    "--strict-signatures",
    "--release-notes-url",
    "https://github.com/Dendro-X0/Obscur/blob/main/CHANGELOG.md",
  ]);
  console.log("[desktop:update-channel:publish] Done. Commit apps/desktop/release/channel/stable and push main.");
};

try {
  main();
} catch (error) {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`[desktop:update-channel:publish] ${message}`);
  process.exit(1);
}
