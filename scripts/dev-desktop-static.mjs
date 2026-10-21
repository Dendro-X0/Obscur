#!/usr/bin/env node
/**
 * Default desktop dev — static out/ shell matching packaged production.
 *
 *   pnpm dev:desktop                 production parity (online relays, no DEV_LAB)
 *   pnpm dev:desktop -- --parity     same as default (explicit)
 *   pnpm dev:desktop -- --online     same as parity (Dev Lab tombstoned — no DEV_LAB bake)
 *   pnpm dev:desktop -- --offline    experiment offline stub (NOT product truth)
 *   pnpm dev:desktop -- --rebuild    force static export rebuild (required to see UI code changes)
 *   pnpm dev:desktop -- --build-only build static shell only
 *   pnpm dev:desktop -- --skip-build start Tauri without rebuilding (refuses if stale/mismatch)
 *
 * Hot-reload UI only: pnpm dev:desktop:live (Next in WebView — not package parity)
 * Full stack + coord: pnpm dev:desktop:online
 * Capture/explore: CodaCtrl Studio on this shell or release exe (not Dev Lab)
 *
 * Spec: specs/backend/production-dev-parity-recovery-2026-07.md
 *       specs/backend/production-rewrite-and-devlab-tombstone-2026-07.md
 */
import { existsSync } from "node:fs";
import { spawn } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { mergePwaEnvLocal } from "./load-pwa-env-local.mjs";
import { spawnPnpm } from "./lib/spawn-pnpm.mjs";
import { applyWindowsBuildTempEnv } from "./lib/windows-build-temp.mjs";
import {
  formatStaticShellStaleHelp,
  isStaticShellExperimentModeMismatch,
  isStaticShellStale,
  readStaticShellManifest,
} from "./lib/static-shell-stale.mjs";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const flags = new Set(process.argv.slice(2));
const forceRebuild = flags.has("--rebuild");
const offline = flags.has("--offline");
// Dev Lab tombstoned — --online no longer bakes DEV_LAB; parity = packaged contract.
const parity = !offline;
const online = !offline;
const buildOnly = flags.has("--build-only");
const skipBuild = flags.has("--skip-build");
const outIndex = path.join(repoRoot, "apps", "pwa", "out", "index.html");

const log = (message) => console.log(`[desktop-static] ${message}`);

const env = applyWindowsBuildTempEnv(mergePwaEnvLocal({
  ...process.env,
  NEXT_PUBLIC_DESKTOP_SHELL: "1",
  NEXT_PUBLIC_OBSCUR_RADICAL_TRUTH: "0",
  TAURI_BUILD: "true",
  OBSCUR_DESKTOP_STATIC_DEV: "1",
  NEXT_PUBLIC_OBSCUR_EXPERIMENT_ONLINE: online ? "1" : "0",
}), { repoRoot, log });
// Per-window CDP is configured in Tauri WebviewWindowBuilder (OBSCUR_CDP_MAIN / OBSCUR_CDP_PROFILE).
// Process-wide WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS prevents profile windows from binding :9231.
delete env.WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS;
env.OBSCUR_CDP_MAIN ??= "9230";
env.OBSCUR_CDP_PROFILE ??= "9231";
// Never bake Dev Lab into desktop shells (tombstone 2026-07-28).
delete env.NEXT_PUBLIC_OBSCUR_DEV_LAB;
if (parity) {
  log("production parity: EXPERIMENT_ONLINE=1, DEV_LAB unset (matches packaged). Rebuild to see UI changes.");
} else {
  log("WARNING: offline experiment stub (EXPERIMENT_ONLINE=0) — NOT product truth. Default is parity.");
}

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

const isParityDevLabMismatch = () => {
  if (!parity) {
    return { mismatch: false, reason: "not parity mode" };
  }
  const manifest = readStaticShellManifest(repoRoot);
  if (!manifest) {
    return { mismatch: true, reason: "missing obscur-shell-manifest.json (rebuild required)" };
  }
  if (manifest.devLabEnabled === true) {
    return { mismatch: true, reason: "parity requires shell without DEV_LAB" };
  }
  return { mismatch: false, reason: "parity DEV_LAB matches" };
};

const run = async () => {
  const stale = isStaticShellStale(repoRoot);
  const experimentMode = isStaticShellExperimentModeMismatch(repoRoot, online);
  const parityDevLab = isParityDevLabMismatch();

  if (skipBuild) {
    if (stale.stale && process.env.OBSCUR_ALLOW_STALE_SHELL !== "1") {
      console.error(formatStaticShellStaleHelp(stale.reason));
      process.exit(1);
    }
    if (experimentMode.mismatch || parityDevLab.mismatch) {
      const reason = experimentMode.mismatch ? experimentMode.reason : parityDevLab.reason;
      console.error(`[desktop-static] --skip-build refused: ${reason}`);
      process.exit(1);
    }
    if (stale.stale) {
      log(`WARNING: using stale static shell (${stale.reason}) — OBSCUR_ALLOW_STALE_SHELL=1`);
    } else {
      log("skipping static shell build (--skip-build)");
    }
  } else if (forceRebuild || !existsSync(outIndex)) {
    await runBuild();
  } else if (experimentMode.mismatch) {
    log(`static shell experiment mode mismatch (${experimentMode.reason}) — rebuilding…`);
    await runBuild();
  } else if (parityDevLab.mismatch) {
    log(`static shell parity mismatch (${parityDevLab.reason}) — rebuilding…`);
    await runBuild();
  } else if (stale.stale) {
    log(`static shell stale (${stale.reason}) — rebuilding…`);
    await runBuild();
  } else {
    log(`using current static shell (${outIndex}, experimentOnline=${online}, parity=${parity})`);
  }

  if (buildOnly) {
    return;
  }

  if (online) {
    log("relay transport active after unlock (same contract as packaged production)");
  } else {
    log("offline stub — use default pnpm dev:desktop for production parity");
  }

  log("starting Tauri — loads out/index.html (OBSCUR_DESKTOP_STATIC_DEV=1)…");

  const desktop = spawnPnpm(["-C", "apps/desktop", "dev"], {
    cwd: repoRoot,
    env,
    stdio: "inherit",
  });

  desktop.on("exit", (code) => {
    process.exit(code ?? 1);
  });
};

run().catch((error) => {
  console.error("[desktop-static] failed:", error instanceof Error ? error.message : error);
  process.exit(1);
});
