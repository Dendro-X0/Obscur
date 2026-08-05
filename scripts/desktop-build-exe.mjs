#!/usr/bin/env node
/**
 * Production release binary without NSIS/MSI bundling — for demo smoke before desktop:package.
 *
 *   pnpm desktop:build:exe
 *   pnpm desktop:build:exe -- --skip-shell   # only if shell is online + fresh (prod-parity)
 *
 * Output: apps/desktop/src-tauri/target/release/obscur_desktop_app.exe
 */
import { spawnSync } from "node:child_process";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { applyWindowsBuildTempEnv } from "./lib/windows-build-temp.mjs";
import { assertProductionStaticShellReady } from "./lib/static-shell-stale.mjs";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const desktopDir = resolve(repoRoot, "apps/desktop");
const releaseExe = resolve(desktopDir, "src-tauri/target/release/obscur_desktop_app.exe");

const args = process.argv.slice(2);
const skipShell = args.includes("--skip-shell");
const passthrough = args.filter((arg) => arg !== "--skip-shell" && arg !== "--no-sign");

const resolveSpawn = (command, commandArgs) => {
  if (process.platform === "win32" && typeof command === "string" && command.toLowerCase().endsWith(".cmd")) {
    return { command: "cmd.exe", args: ["/d", "/s", "/c", command, ...commandArgs] };
  }
  return { command, args: commandArgs };
};

const run = (label, command, commandArgs, env, cwd = desktopDir) => {
  console.log(`[desktop:build:exe] ${label}…`);
  const { command: spawnCommand, args: spawnArgs } = resolveSpawn(command, commandArgs);
  const result = spawnSync(spawnCommand, spawnArgs, {
    cwd,
    env,
    stdio: "inherit",
    shell: process.platform === "win32",
  });
  if (result.status !== 0) {
    throw new Error(`${label} failed (exit ${result.status ?? "unknown"})`);
  }
};

const main = async () => {
  let env = applyWindowsBuildTempEnv({ ...process.env }, {
    repoRoot,
    log: (msg) => console.log(`[tauri-temp] ${msg}`),
  });

  // Match packaged production: live relays, no experiment offline stub.
  env = {
    ...env,
    NEXT_PUBLIC_OBSCUR_EXPERIMENT_ONLINE: env.NEXT_PUBLIC_OBSCUR_EXPERIMENT_ONLINE ?? "1",
  };
  // Production shell must not bake DEV_LAB (parity with package / build-pwa-shell).
  delete env.NEXT_PUBLIC_OBSCUR_DEV_LAB;

  if (skipShell) {
    const gate = assertProductionStaticShellReady(repoRoot);
    if (!gate.ok) {
      throw new Error(`--skip-shell refused: ${gate.reason}`);
    }
    if (gate.staleWarning) {
      console.warn(`[desktop:build:exe] WARNING: stale shell allowed (${gate.staleWarning})`);
    }
    env = { ...env, SKIP_TAURI_BEFORE_BUILD: "1" };
    console.log(
      `[desktop:build:exe] SKIP_TAURI_BEFORE_BUILD=1 (prod shell ok: experimentOnline=${gate.manifest.experimentOnline})`,
    );
  }

  run(
    "tauri build --no-bundle --no-sign (release exe, no installer)",
    "pnpm",
    ["exec", "tauri", "build", "--no-bundle", "--no-sign", ...passthrough],
    env,
  );

  console.log(`
[desktop:build:exe] OK
  Run:  ${releaseExe}
  Smoke: relays online (Tor off) · F5 restore exits ≤2.5s · unlock/create
  Next: pnpm desktop:package   # only after smoke green
  Spec: specs/backend/production-dev-parity-recovery-2026-07.md
`);
};

try {
  await main();
} catch (error) {
  console.error(`[desktop:build:exe] ${error instanceof Error ? error.message : String(error)}`);
  process.exit(1);
}
