#!/usr/bin/env node
/**
 * Detects stale Tauri 2 permission-file pointers under src-tauri/target and runs
 * `cargo clean` when referenced paths are missing (Windows os error 2).
 *
 * @see https://github.com/tauri-apps/tauri/issues/10484
 *
 * Usage:
 *   node scripts/repair-tauri-permission-cache.mjs
 *   node scripts/repair-tauri-permission-cache.mjs --force
 */

import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { execSync } from "node:child_process";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(fileURLToPath(import.meta.url), "..");
const SRC_TAURI = join(ROOT, "apps", "desktop", "src-tauri");
const TARGET_ROOT = join(SRC_TAURI, "target");

const force = process.argv.includes("--force");

function stripExtendedPath(filePath) {
  return String(filePath).replace(/^\\\\\?\\/, "");
}

function findPermissionFileLists(dir, acc) {
  if (!existsSync(dir)) {
    return;
  }
  let entries = [];
  try {
    entries = readdirSync(dir);
  } catch {
    return;
  }
  for (const name of entries) {
    const entryPath = join(dir, name);
    let stat;
    try {
      stat = statSync(entryPath);
    } catch {
      continue;
    }
    if (!stat.isDirectory()) {
      continue;
    }
    if (name.endsWith("-permission-files")) {
      acc.push(entryPath);
      continue;
    }
    findPermissionFileLists(entryPath, acc);
  }
}

function collectBrokenPermissionPointers() {
  const broken = [];
  for (const profile of ["debug", "release"]) {
    const buildRoot = join(TARGET_ROOT, profile, "build");
    const lists = [];
    findPermissionFileLists(buildRoot, lists);
    for (const listPath of lists) {
      let paths;
      try {
        paths = JSON.parse(readFileSync(listPath, "utf8"));
      } catch {
        broken.push({ listPath, missingPath: "(invalid JSON)" });
        continue;
      }
      if (!Array.isArray(paths)) {
        continue;
      }
      for (const raw of paths) {
        const resolved = stripExtendedPath(raw);
        if (!existsSync(resolved)) {
          broken.push({ listPath, missingPath: resolved });
        }
      }
    }
  }
  return broken;
}

function runCargoClean() {
  console.log("[tauri-repair] running cargo clean in apps/desktop/src-tauri …");
  execSync("cargo clean", { cwd: SRC_TAURI, stdio: "inherit" });
}

const broken = collectBrokenPermissionPointers();

if (force) {
  if (!existsSync(TARGET_ROOT)) {
    console.log("[tauri-repair] no target/ directory — nothing to clean");
    process.exit(0);
  }
  runCargoClean();
  process.exit(0);
}

if (broken.length === 0) {
  console.log("[tauri-repair] permission cache OK");
  process.exit(0);
}

console.log("[tauri-repair] stale Tauri permission cache detected:");
for (const item of broken.slice(0, 5)) {
  console.log(`  missing: ${item.missingPath}`);
  console.log(`  list:    ${item.listPath}`);
}
if (broken.length > 5) {
  console.log(`  … and ${broken.length - 5} more`);
}
runCargoClean();
