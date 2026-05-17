#!/usr/bin/env node
/**
 * Regenerate Tauri bundle icons (Windows, macOS, Linux, Android, iOS) from the PWA canonical mark.
 *
 * Source: apps/pwa/public/obscur-logo-dark.svg
 * Output: apps/desktop/src-tauri/icons/**
 *
 * Usage: pnpm icons:regenerate
 */
import { spawnSync } from "node:child_process";
import { copyFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const rootDir = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const svgPath = resolve(rootDir, "apps/pwa/public/obscur-logo-dark.svg");
const pngPath = resolve(rootDir, "apps/desktop/src-tauri/icons/icon-source.png");
const desktopDir = resolve(rootDir, "apps/desktop");

function run(command, args, cwd) {
  const result = spawnSync(command, args, {
    cwd,
    stdio: "inherit",
    shell: process.platform === "win32",
  });
  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}

console.log("Rendering 1024x1024 icon-source.png from obscur-logo-dark.svg …");
run(
  "pnpm",
  ["dlx", "@resvg/resvg-js-cli", "--fit-width", "1024", "--fit-height", "1024", svgPath, pngPath],
  rootDir,
);

console.log("Regenerating Tauri platform icons …");
run("pnpm", ["tauri", "icon", "src-tauri/icons/icon-source.png"], desktopDir);

const tauriDir = resolve(desktopDir, "src-tauri");
const genRes = resolve(tauriDir, "gen/android/app/src/main/res");
const iconsAndroid = resolve(tauriDir, "icons/android");
for (const density of ["hdpi", "mdpi", "xhdpi", "xxhdpi", "xxxhdpi"]) {
  const from = resolve(genRes, `mipmap-${density}`);
  const to = resolve(iconsAndroid, `mipmap-${density}`);
  for (const name of ["ic_launcher.png", "ic_launcher_foreground.png", "ic_launcher_round.png"]) {
    copyFileSync(resolve(from, name), resolve(to, name));
  }
}
console.log("Synced Android mipmaps: gen/android → icons/android");

console.log(
  "Done. Commit apps/desktop/src-tauri/icons/, icon-source.png, and gen/android/.../mipmap-* when visuals look correct.",
);
