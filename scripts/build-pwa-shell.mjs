#!/usr/bin/env node
/**
 * Build PWA static export for a specific product shell (desktop | mobile | web).
 * Used by Tauri beforeBuildCommand and CI Android lane.
 */
import { readFileSync, writeFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { buildStaticShellManifest, STATIC_SHELL_MANIFEST_FILE } from "./lib/static-shell-stale.mjs";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const rootVersion = JSON.parse(readFileSync(path.join(repoRoot, "package.json"), "utf8")).version ?? "dev";
const shellArg = (process.argv[2] ?? process.env.TAURI_SHELL_TARGET ?? "desktop").toLowerCase();

const shellEnv = (() => {
  if (shellArg === "mobile") {
    return {
      NEXT_PUBLIC_MOBILE_SHELL: "1",
      NEXT_PUBLIC_DESKTOP_SHELL: "0",
      NEXT_PUBLIC_OBSCUR_RADICAL_TRUTH: "0",
    };
  }
  if (shellArg === "web") {
    return { NEXT_PUBLIC_MOBILE_SHELL: "0", NEXT_PUBLIC_DESKTOP_SHELL: "0" };
  }
  return { NEXT_PUBLIC_DESKTOP_SHELL: "1", NEXT_PUBLIC_MOBILE_SHELL: "0", NEXT_PUBLIC_OBSCUR_RADICAL_TRUTH: "0" };
})();

const env = {
  ...process.env,
  ...shellEnv,
  TAURI_BUILD: "true",
  NEXT_PUBLIC_APP_VERSION: rootVersion,
};

console.log(`[build-pwa-shell] target=${shellArg} env=${JSON.stringify(shellEnv)}`);

const result = spawnSync(
  "pnpm",
  ["-C", "apps/pwa", "run", "build:static"],
  { cwd: repoRoot, env, stdio: "inherit", shell: true },
);

if ((result.status ?? 1) === 0 && shellArg === "desktop") {
  const outDir = path.join(repoRoot, "apps", "pwa", "out");
  writeFileSync(
    path.join(outDir, STATIC_SHELL_MANIFEST_FILE),
    `${JSON.stringify(buildStaticShellManifest(env), null, 2)}\n`,
    "utf8",
  );
  console.log(
    `[build-pwa-shell] wrote ${STATIC_SHELL_MANIFEST_FILE} (experimentOnline=${env.NEXT_PUBLIC_OBSCUR_EXPERIMENT_ONLINE === "1"})`,
  );
}

process.exit(result.status ?? 1);
