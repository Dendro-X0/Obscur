#!/usr/bin/env node

/**
 * Thin wrapper: cargo run --bin obscur-dev-clean from apps/desktop/src-tauri.
 * Owns kill of managed target binaries + WebView HTTP/code cache purge.
 */

import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "..");
const srcTauri = path.join(repoRoot, "apps", "desktop", "src-tauri");

const result = spawnSync(
  "cargo",
  ["run", "--quiet", "--bin", "obscur-dev-clean"],
  {
    cwd: srcTauri,
    stdio: "inherit",
    env: {
      ...process.env,
      OBSCUR_DEV_CLEAN_TARGET_ROOT: path.join(srcTauri, "target"),
      OBSCUR_DEV_CLEAN_OUT_DIR: path.join(repoRoot, "apps", "pwa", "out"),
    },
    shell: process.platform === "win32",
  },
);

process.exit(result.status ?? 1);
