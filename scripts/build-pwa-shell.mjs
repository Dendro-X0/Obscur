#!/usr/bin/env node
/**
 * Build PWA static export for a specific product shell (desktop | mobile | web).
 * Used by Tauri beforeBuildCommand and CI Android lane.
 */
import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const shellArg = (process.argv[2] ?? process.env.TAURI_SHELL_TARGET ?? "desktop").toLowerCase();

const shellEnv = (() => {
  if (shellArg === "mobile") {
    return { NEXT_PUBLIC_MOBILE_SHELL: "1", NEXT_PUBLIC_DESKTOP_SHELL: "0" };
  }
  if (shellArg === "web") {
    return { NEXT_PUBLIC_MOBILE_SHELL: "0", NEXT_PUBLIC_DESKTOP_SHELL: "0" };
  }
  return { NEXT_PUBLIC_DESKTOP_SHELL: "1", NEXT_PUBLIC_MOBILE_SHELL: "0" };
})();

const env = {
  ...process.env,
  ...shellEnv,
  TAURI_BUILD: "true",
};

console.log(`[build-pwa-shell] target=${shellArg} env=${JSON.stringify(shellEnv)}`);

const result = spawnSync(
  "pnpm",
  ["-C", "apps/pwa", "run", "build:static"],
  { cwd: repoRoot, env, stdio: "inherit", shell: true },
);

process.exit(result.status ?? 1);
