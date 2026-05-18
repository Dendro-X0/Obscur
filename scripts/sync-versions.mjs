#!/usr/bin/env node
/**
 * Sync release version from root package.json to all release-tracked manifests.
 *
 * Coverage:
 * - apps/pwa/package.json
 * - apps/desktop/package.json
 * - apps/desktop/src-tauri/tauri.conf.json
 * - apps/website/package.json
 * - apps/relay-gateway/package.json
 * - packages/<package-name>/package.json
 * - version.json
 *
 * Intentionally excluded:
 * - apps/coordination/package.json (no release version contract yet)
 */
import { existsSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ANDROID_PROPERTIES_PATH = "apps/desktop/src-tauri/gen/android/app/tauri.properties";

function semverToVersionCode(version) {
  const match = version.match(/^(\d+)\.(\d+)\.(\d+)$/);
  if (!match) {
    throw new Error(`Cannot derive Android versionCode from version: ${version}`);
  }
  const [, major, minor, patch] = match;
  return Number(major) * 10_000 + Number(minor) * 100 + Number(patch);
}

function writeAndroidTauriProperties(rootDir, version) {
  const targetPath = resolve(rootDir, ANDROID_PROPERTIES_PATH);
  const targetDir = dirname(targetPath);
  if (!existsSync(targetDir)) {
    console.warn(`[version:sync] Skipping Android properties (missing ${targetDir})`);
    return;
  }
  const versionCode = semverToVersionCode(version);
  const body = [
    `tauri.android.versionName=${version}`,
    `tauri.android.versionCode=${versionCode}`,
    "",
  ].join("\n");
  writeFileSync(targetPath, body, "utf8");
  console.log(`[version:sync] Updated ${targetPath} -> versionName=${version}, versionCode=${versionCode}`);
}

const __dirname = dirname(fileURLToPath(import.meta.url));
const rootDir = resolve(__dirname, "..");

const fixedTargets = [
  "apps/pwa/package.json",
  "apps/desktop/package.json",
  "apps/desktop/src-tauri/tauri.conf.json",
  "apps/website/package.json",
  "apps/relay-gateway/package.json",
  "version.json",
];

function getRootVersion() {
  const rootPkgPath = resolve(rootDir, "package.json");
  const rootPkg = JSON.parse(readFileSync(rootPkgPath, "utf8"));
  return rootPkg.version;
}

function setJsonVersion(absPath, version) {
  if (!existsSync(absPath)) {
    console.warn(`[version:sync] Missing file: ${absPath}`);
    return;
  }
  const content = JSON.parse(readFileSync(absPath, "utf8"));
  content.version = version;
  writeFileSync(absPath, `${JSON.stringify(content, null, 2)}\n`, "utf8");
  console.log(`[version:sync] Updated ${absPath} -> ${version}`);
}

function getPackageTargets() {
  const packagesDir = resolve(rootDir, "packages");
  if (!existsSync(packagesDir)) return [];

  return readdirSync(packagesDir)
    .map((pkg) => resolve(packagesDir, pkg, "package.json"))
    .filter((pkgPath) => existsSync(pkgPath));
}

function main() {
  try {
    const rootVersion = getRootVersion();
    if (!rootVersion) {
      throw new Error("No version found in root package.json");
    }

    console.log(`[version:sync] Root version: ${rootVersion}`);
    for (const relPath of fixedTargets) {
      setJsonVersion(resolve(rootDir, relPath), rootVersion);
    }
    for (const pkgPath of getPackageTargets()) {
      setJsonVersion(pkgPath, rootVersion);
    }
    writeAndroidTauriProperties(rootDir, rootVersion);
    console.log("[version:sync] Complete");
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`[version:sync] Failed: ${message}`);
    process.exit(1);
  }
}

main();
