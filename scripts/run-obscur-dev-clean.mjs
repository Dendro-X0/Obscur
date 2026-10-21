#!/usr/bin/env node

/**
 * Thin wrapper: cargo run --bin obscur-dev-clean from apps/desktop/src-tauri.
 * Owns kill of managed target binaries + WebView HTTP/code cache purge.
 */

import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { applyWindowsBuildTempEnv } from "./lib/windows-build-temp.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "..");
const srcTauri = path.join(repoRoot, "apps", "desktop", "src-tauri");

// Package / maintainer override: never enter cargo + process kill. On some Windows
// hosts Get-Process/tasklist WMI can hang forever and stall `desktop:package`.
if (
  process.env.OBSCUR_DEV_CLEAN_SKIP === "1" ||
  process.env.OBSCUR_DEV_CLEAN_SKIP_PROCESS_KILL === "1"
) {
  console.log(
    "[obscur-dev-clean] skipped (OBSCUR_DEV_CLEAN_SKIP or OBSCUR_DEV_CLEAN_SKIP_PROCESS_KILL)",
  );
  process.exit(0);
}

const env = applyWindowsBuildTempEnv({
  ...process.env,
  OBSCUR_DEV_CLEAN_TARGET_ROOT: path.join(srcTauri, "target"),
  OBSCUR_DEV_CLEAN_OUT_DIR: path.join(repoRoot, "apps", "pwa", "out"),
}, { repoRoot });

const result = spawnSync(
  "cargo",
  ["run", "--quiet", "--bin", "obscur-dev-clean"],
  {
    cwd: srcTauri,
    stdio: "inherit",
    env,
    shell: process.platform === "win32",
  },
);

process.exit(result.status ?? 1);
