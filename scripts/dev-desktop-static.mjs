#!/usr/bin/env node
/**
 * Default desktop dev — static out/ shell (prod-like; no Next dev in WebView2).
 *
 *   pnpm dev:desktop
 *   pnpm dev:desktop -- --rebuild    force static export rebuild
 *   pnpm dev:desktop -- --online       experiment-online env (still no coordination/relay)
 *
 * Hot-reload UI iteration: pnpm dev:desktop:live
 * Online relays + smooth nav: pnpm dev:desktop:online (static shell + stack)
 * Online + webpack HMR (slow nav): pnpm dev:desktop:online:live
 */
import { existsSync } from "node:fs";
import { spawn } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { mergePwaEnvLocal } from "./load-pwa-env-local.mjs";
import {
  isStaticShellDevLabMismatch,
  isStaticShellExperimentModeMismatch,
  isStaticShellStale,
} from "./lib/static-shell-stale.mjs";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const flags = new Set(process.argv.slice(2));
const forceRebuild = flags.has("--rebuild");
const online = flags.has("--online");
const outIndex = path.join(repoRoot, "apps", "pwa", "out", "index.html");

const env = mergePwaEnvLocal({
  ...process.env,
  NEXT_PUBLIC_DESKTOP_SHELL: "1",
  NEXT_PUBLIC_OBSCUR_RADICAL_TRUTH: "0",
  TAURI_BUILD: "true",
  OBSCUR_DESKTOP_STATIC_DEV: "1",
  NEXT_PUBLIC_OBSCUR_EXPERIMENT_ONLINE: online ? "1" : (process.env.NEXT_PUBLIC_OBSCUR_EXPERIMENT_ONLINE ?? "0"),
  NEXT_PUBLIC_OBSCUR_DEV_LAB: "1",
});

const log = (message) => console.log(`[desktop-static] ${message}`);

const runBuild = () => new Promise((resolve, reject) => {
  log("building static desktop shell → apps/pwa/out …");
  const child = spawn("node", [path.join(repoRoot, "scripts", "build-pwa-shell.mjs"), "desktop"], {
    cwd: repoRoot,
    env,
    stdio: "inherit",
    shell: false,
  });
  child.on("exit", (code) => {
    if (code === 0) {
      resolve(undefined);
      return;
    }
    reject(new Error(`static shell build failed (exit ${code ?? 1})`));
  });
});

const run = async () => {
  const stale = isStaticShellStale(repoRoot);
  const experimentMode = isStaticShellExperimentModeMismatch(repoRoot, online);
  const devLabMode = isStaticShellDevLabMismatch(repoRoot);
  if (forceRebuild || !existsSync(outIndex)) {
    await runBuild();
  } else if (experimentMode.mismatch) {
    log(`static shell experiment mode mismatch (${experimentMode.reason}) — rebuilding…`);
    await runBuild();
  } else if (devLabMode.mismatch) {
    log(`static shell dev-lab mismatch (${devLabMode.reason}) — rebuilding…`);
    await runBuild();
  } else if (stale.stale) {
    log(`static shell stale (${stale.reason}) — rebuilding…`);
    await runBuild();
  } else {
    log(`using current static shell (${outIndex}, experimentOnline=${online})`);
  }

  if (online) {
    log("experiment online enabled — relay transport active after unlock");
  } else {
    log("experiment offline stub — use pnpm dev:desktop:online for live relays");
  }

  log("starting Tauri — loads out/index.html (OBSCUR_DESKTOP_STATIC_DEV=1)…");

  const desktop = spawn("pnpm", ["-C", "apps/desktop", "dev"], {
    cwd: repoRoot,
    env,
    stdio: "inherit",
    shell: process.platform === "win32",
  });

  desktop.on("exit", (code) => {
    process.exit(code ?? 1);
  });
};

run().catch((error) => {
  console.error("[desktop-static] failed:", error instanceof Error ? error.message : error);
  process.exit(1);
});
