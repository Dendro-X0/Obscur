#!/usr/bin/env node
/**
 * R12 — fail fast when Tauri bundle filenames do not match package.json version.
 * Usage: node scripts/verify-desktop-bundle-filenames.mjs --dir ./bundle-artifacts
 */
import { readdirSync, statSync } from "node:fs";
import { basename, dirname, extname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import {
  assertDesktopInstallerBasename,
  readExpectedReleaseVersion,
} from "./lib/release-artifact-version.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const rootDir = resolve(__dirname, "..");

const getArg = (name) => {
  const index = process.argv.indexOf(name);
  if (index === -1) return null;
  return process.argv[index + 1] ?? null;
};

const DESKTOP_EXTS = new Set([".exe", ".msi", ".dmg", ".appimage", ".deb"]);

const main = () => {
  const dirArg = getArg("--dir");
  if (!dirArg) {
    throw new Error("Missing --dir <bundle-artifacts>");
  }
  const dir = resolve(process.cwd(), dirArg);
  if (!statSync(dir, { throwIfNoEntry: false })?.isDirectory()) {
    throw new Error(`Bundle directory not found: ${dir}`);
  }

  const expectedVersion = readExpectedReleaseVersion(rootDir);
  const files = readdirSync(dir)
    .filter((name) => DESKTOP_EXTS.has(extname(name).toLowerCase()))
    .map((name) => join(dir, name));

  if (files.length === 0) {
    throw new Error(`No desktop installer files in ${dir}`);
  }

  const errors = [];
  for (const file of files) {
    const name = basename(file);
    const result = assertDesktopInstallerBasename(name, expectedVersion);
    if (!result.ok) {
      errors.push(result.error);
    }
  }

  if (errors.length > 0) {
    throw new Error(errors.join("\n"));
  }

  console.log(
    `[verify-desktop-bundle-filenames] OK — ${files.length} installer(s) match product version ${expectedVersion}`,
  );
};

try {
  main();
} catch (error) {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`[verify-desktop-bundle-filenames] Failed: ${message}`);
  process.exit(1);
}
