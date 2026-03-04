#!/usr/bin/env node
/**
 * Validate release version alignment.
 * Fails when any release-tracked manifest version differs from root package.json.
 */
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const rootDir = resolve(__dirname, "..");

const fixedTargets = [
  "package.json",
  "apps/pwa/package.json",
  "apps/desktop/package.json",
  "apps/desktop/src-tauri/tauri.conf.json",
  "apps/website/package.json",
  "apps/relay-gateway/package.json",
  "version.json",
];

function readVersion(relPath) {
  const absPath = resolve(rootDir, relPath);
  if (!existsSync(absPath)) {
    return { relPath, version: null, missing: true };
  }
  const json = JSON.parse(readFileSync(absPath, "utf8"));
  return { relPath, version: json.version ?? null, missing: false };
}

function getPackageTargets() {
  const packagesDir = resolve(rootDir, "packages");
  if (!existsSync(packagesDir)) return [];
  return readdirSync(packagesDir)
    .map((name) => `packages/${name}/package.json`)
    .filter((relPath) => existsSync(resolve(rootDir, relPath)));
}

function main() {
  const root = readVersion("package.json");
  if (!root.version) {
    console.error("[version:check] Root package.json has no version");
    process.exit(1);
  }

  const targets = [...fixedTargets, ...getPackageTargets()];
  const seen = new Set();
  const rows = [];
  for (const target of targets) {
    if (seen.has(target)) continue;
    seen.add(target);
    rows.push(readVersion(target));
  }

  const failures = [];
  console.log(`[version:check] Expected version: ${root.version}`);
  for (const row of rows) {
    if (row.missing) {
      failures.push(`${row.relPath}: missing file`);
      continue;
    }
    if (!row.version) {
      failures.push(`${row.relPath}: missing version field`);
      continue;
    }
    const marker = row.version === root.version ? "OK" : "MISMATCH";
    console.log(`- ${marker} ${row.relPath}: ${row.version}`);
    if (row.version !== root.version) {
      failures.push(`${row.relPath}: ${row.version} != ${root.version}`);
    }
  }

  if (failures.length > 0) {
    console.error("[version:check] Alignment failed:");
    for (const failure of failures) {
      console.error(`  - ${failure}`);
    }
    process.exit(1);
  }
  console.log("[version:check] All release-tracked versions are aligned");
}

main();
