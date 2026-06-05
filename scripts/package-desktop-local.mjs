#!/usr/bin/env node
/**
 * Package Obscur desktop installers locally — no GitHub Actions, no tag push, no hour wait.
 *
 * Output: release-assets/{windows,macos,linux}/ + optional repo update channel publish.
 */
import { spawnSync } from "node:child_process";
import { cp, mkdir, readdir, stat } from "node:fs/promises";
import { basename, dirname, extname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import {
  assertDesktopInstallerBasename,
  readExpectedReleaseVersion,
} from "./lib/release-artifact-version.mjs";
import { loadMaintainerSigningEnv } from "./load-maintainer-signing-env.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, "..");
const TAURI_BUNDLE_ROOT = resolve(repoRoot, "apps/desktop/src-tauri/target/release/bundle");
const ASSETS_ROOT = resolve(repoRoot, "release-assets");

const args = process.argv.slice(2);
const hasFlag = (name) => args.includes(name);
const getArg = (name) => {
  const index = args.indexOf(name);
  if (index === -1) return null;
  return args[index + 1] ?? null;
};

const DESKTOP_EXTS = new Set([".exe", ".msi", ".dmg", ".appimage", ".deb", ".app", ".tar.gz"]);
const SIG_SUFFIXES = [".sig", ".minisig"];

const resolveSpawn = (command, commandArgs) => {
  // Never use shell: true with argv — breaks "C:\Program Files\..." paths on Windows.
  if (process.platform === "win32" && typeof command === "string" && command.toLowerCase().endsWith(".cmd")) {
    return {
      command: "cmd.exe",
      args: ["/d", "/s", "/c", command, ...commandArgs],
    };
  }
  return { command, args: commandArgs };
};

const run = (label, command, commandArgs, options = {}) => {
  console.log(`[desktop:package] ${label}…`);
  const { command: spawnCommand, args: spawnArgs } = resolveSpawn(command, commandArgs);
  const result = spawnSync(spawnCommand, spawnArgs, {
    cwd: repoRoot,
    stdio: "inherit",
    shell: false,
    ...options,
  });
  if (result.status !== 0) {
    throw new Error(`${label} failed (exit ${result.status ?? "unknown"})`);
  }
};

const windowsNsisInstallerExists = async () => {
  if (process.platform !== "win32") {
    return false;
  }
  try {
    const nsisDir = join(TAURI_BUNDLE_ROOT, "nsis");
    const entries = await readdir(nsisDir);
    return entries.some((name) => name.endsWith("-setup.exe"));
  } catch {
    return false;
  }
};

const runDesktopBuild = async (pnpm) => {
  try {
    run("build PWA shell + Tauri bundle", pnpm, ["build:desktop"]);
  } catch (error) {
    if (process.platform === "win32" && (await windowsNsisInstallerExists())) {
      console.warn(
        "[desktop:package] Tauri build exited non-zero but NSIS installer exists (often missing TAURI_SIGNING_PRIVATE_KEY for .sig files). Continuing copy.",
      );
      return;
    }
    throw error;
  }
};

const walkFiles = async (dir) => {
  const entries = await readdir(dir, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const fullPath = join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...(await walkFiles(fullPath)));
      continue;
    }
    files.push(fullPath);
  }
  return files;
};

const resolvePlatformBucket = (filePath) => {
  const normalized = filePath.replace(/\\/g, "/").toLowerCase();
  if (normalized.includes("/nsis/") || normalized.includes("/msi/") || normalized.endsWith(".exe") || normalized.endsWith(".msi")) {
    return "windows";
  }
  if (normalized.includes("/dmg/") || normalized.endsWith(".dmg") || normalized.includes(".app.tar.gz")) {
    return "macos";
  }
  if (normalized.includes("/appimage/") || normalized.endsWith(".appimage") || normalized.endsWith(".deb")) {
    return "linux";
  }
  if (normalized.endsWith(".sig") || normalized.endsWith(".minisig")) {
    if (normalized.includes("/nsis/") || normalized.includes("/msi/")) return "windows";
    if (normalized.includes("/dmg/")) return "macos";
    if (normalized.includes("/appimage/")) return "linux";
  }
  return null;
};

const shouldCopyFile = (filePath) => {
  const name = basename(filePath);
  const ext = extname(name).toLowerCase();
  if (DESKTOP_EXTS.has(ext)) {
    return true;
  }
  return SIG_SUFFIXES.some((suffix) => name.endsWith(suffix));
};

const copyBundleArtifacts = async () => {
  try {
    await stat(TAURI_BUNDLE_ROOT);
  } catch {
    throw new Error(
      `Tauri bundle output not found at ${TAURI_BUNDLE_ROOT}. Run build first (pnpm build:desktop).`,
    );
  }

  const expectedVersion = readExpectedReleaseVersion(repoRoot);
  const allFiles = await walkFiles(TAURI_BUNDLE_ROOT);
  const copied = [];

  for (const filePath of allFiles) {
    if (!shouldCopyFile(filePath)) {
      continue;
    }
    const ext = extname(filePath).toLowerCase();
    if (DESKTOP_EXTS.has(ext)) {
      assertDesktopInstallerBasename(basename(filePath), expectedVersion);
    }
    const bucket = resolvePlatformBucket(filePath);
    if (!bucket) {
      continue;
    }
    const destDir = join(ASSETS_ROOT, bucket);
    await mkdir(destDir, { recursive: true });
    const destPath = join(destDir, basename(filePath));
    await cp(filePath, destPath);
    copied.push(destPath);
  }

  if (copied.length === 0) {
    throw new Error(`No desktop installer artifacts found under ${TAURI_BUNDLE_ROOT}`);
  }

  console.log("[desktop:package] Copied artifacts:");
  for (const path of copied) {
    console.log(`  - ${path}`);
  }
};

const main = async () => {
  if (loadMaintainerSigningEnv()) {
    console.log(
      "[desktop:package] Loaded .env.signing.local — remove file for fully unsigned builds if signing errors occur",
    );
  }

  const skipBuild = hasFlag("--skip-build");
  const publishChannel = hasFlag("--publish-channel");
  const pnpm = process.platform === "win32" ? "pnpm.cmd" : "pnpm";

  if (!hasFlag("--skip-version-sync")) {
    run("version:sync", pnpm, ["version:sync"]);
  }

  if (!skipBuild) {
    if (process.platform === "win32") {
      run("ensure NSIS toolchain", process.execPath, [
        resolve(repoRoot, "scripts/ensure-tauri-nsis-windows.mjs"),
      ]);
    }
    await runDesktopBuild(pnpm);
  }

  await copyBundleArtifacts();

  if (publishChannel) {
    run("publish repo update channel", pnpm, ["desktop:update-channel:publish"]);
  }

  const version = readExpectedReleaseVersion(repoRoot);
  console.log("");
  console.log("[desktop:package] Done.");
  console.log(`  Version: ${version}`);
  console.log(`  Installers: ${ASSETS_ROOT}`);
  console.log("  Install locally: run the .exe / .dmg / .AppImage from release-assets or from:");
  console.log(`    ${TAURI_BUNDLE_ROOT}`);
  if (!publishChannel) {
    console.log("  In-app updates: pnpm desktop:update-channel:publish  then commit channel/ + push main");
  }
};

main().catch((error) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`[desktop:package] ${message}`);
  process.exit(1);
});
