#!/usr/bin/env node
/**
 * Automated Obscur runtime capture (Playwright → M0 triage + digest gates).
 *
 * Usage:
 *   node scripts/runtime-capture-e2e.mjs
 *   node scripts/runtime-capture-e2e.mjs --start-pwa
 *   node scripts/runtime-capture-e2e.mjs --cdp http://127.0.0.1:9222
 *   node scripts/runtime-capture-e2e.mjs --require-native --cdp http://127.0.0.1:9222
 *   node scripts/runtime-capture-e2e.mjs --out docs/incidents/e2e
 *
 * Prerequisites (default chromium mode):
 *   App reachable at http://127.0.0.1:3340 — e.g. `pnpm dev:desktop:online`
 *
 * Native Tauri WebView (persistence / SQLite truth):
 *   set WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS=--remote-debugging-port=9222
 *   pnpm dev:desktop:online
 *   node scripts/runtime-capture-e2e.mjs --require-native --cdp http://127.0.0.1:9222
 */

import { spawn, spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  buildRuntimeCaptureReport,
  summarizeRuntimeCaptureReport,
} from "./lib/runtime-capture-lib.mjs";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const pwaDir = path.join(repoRoot, "apps", "pwa");
const defaultBaseUrl = "http://127.0.0.1:3340";

const args = process.argv.slice(2);

const readArg = (flag, fallback = undefined) => {
  const index = args.indexOf(flag);
  if (index >= 0 && args[index + 1]) {
    return args[index + 1];
  }
  return fallback;
};

const hasFlag = (flag) => args.includes(flag);

const baseUrl = readArg("--base-url", process.env.PLAYWRIGHT_BASE_URL ?? defaultBaseUrl);
const outDir = path.resolve(readArg("--out", path.join(repoRoot, "test-results", "runtime-capture")));
const cdpUrl = hasFlag("--cdp") ? readArg("--cdp", "http://127.0.0.1:9222") : null;
const requireNative = hasFlag("--require-native");
const startPwa = hasFlag("--start-pwa");

const log = (message) => {
  console.log(`[runtime-capture] ${message}`);
};

async function waitForHttp(url, timeoutMs = 120_000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      const response = await fetch(url, { method: "GET" });
      if (response.ok || response.status < 500) {
        return;
      }
    } catch {
      // retry
    }
    await new Promise((resolve) => {
      setTimeout(resolve, 500);
    });
  }
  throw new Error(`Timed out waiting for ${url}`);
}

/** @type {import('node:child_process').ChildProcess | null} */
let pwaChild = null;

function stopPwa() {
  if (!pwaChild || pwaChild.killed) {
    return;
  }
  try {
    pwaChild.kill("SIGTERM");
  } catch {
    // ignore
  }
}

function startPwaDev() {
  log("starting desktop-shell PWA dev on :3340…");
  pwaChild = spawn("node", [path.join(repoRoot, "scripts", "dev-pwa-tauri.mjs")], {
    cwd: repoRoot,
    stdio: "inherit",
    shell: false,
    env: {
      ...process.env,
      NEXT_PUBLIC_OBSCUR_EXPERIMENT_ONLINE: "1",
    },
  });
}

function runPlaywright() {
  const env = {
    ...process.env,
    PLAYWRIGHT_BASE_URL: baseUrl,
    RUNTIME_CAPTURE_OUT_DIR: outDir,
    OBSCUR_RUNTIME_CAPTURE_REQUIRE_NATIVE: requireNative ? "1" : "0",
    OBSCUR_RUNTIME_CAPTURE_SURFACE: cdpUrl ? "tauri-webview-cdp" : "chromium",
  };

  if (cdpUrl) {
    env.OBSCUR_CDP_URL = cdpUrl;
    log(`CDP mode: connect to ${cdpUrl} (unlock Tester1 in Tauri if auth gate appears — script waits up to 120s)`);
  }

  log(`running Playwright runtime capture against ${baseUrl}`);
  log(`artifacts → ${outDir}`);

  const result = spawnSync(
    "pnpm",
    [
      "exec",
      "playwright",
      "test",
      "tests/e2e/runtime-capture-desktop.spec.ts",
      "--config=playwright.runtime-capture.config.ts",
    ],
    {
      cwd: pwaDir,
      stdio: "inherit",
      shell: true,
      env,
    },
  );

  return result.status ?? 1;
}

function finalizeReport(exitCode) {
  const latestPath = path.join(outDir, "runtime-capture-latest.json");
  if (!fs.existsSync(latestPath)) {
    log(`no capture report at ${latestPath}`);
    return exitCode;
  }

  const raw = JSON.parse(fs.readFileSync(latestPath, "utf8"));
  const report = buildRuntimeCaptureReport({
    ...raw,
    surface: raw.surface ?? (cdpUrl ? "tauri-webview-cdp" : "chromium"),
    requireNative,
    shellUnlocked: true,
  });

  const evaluatedPath = path.join(outDir, "runtime-capture-evaluated.json");
  fs.writeFileSync(evaluatedPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");

  const summary = summarizeRuntimeCaptureReport(report);
  const summaryPath = path.join(outDir, "runtime-capture-summary.json");
  fs.writeFileSync(summaryPath, `${JSON.stringify(summary, null, 2)}\n`, "utf8");

  log(`evaluated report → ${evaluatedPath}`);
  log(`summary → ${summaryPath}`);
  log(`passed=${summary.passed} surface=${summary.surface} native=${summary.isNativeRuntime}`);

  if (!summary.passed) {
    log(`failed gates: ${summary.failedGateIds.join(", ") || "(playwright failure)"}`);
    return exitCode !== 0 ? exitCode : 1;
  }

  return exitCode;
}

async function main() {
  try {
    if (startPwa) {
      startPwaDev();
      await waitForHttp(baseUrl);
    } else {
      try {
        await waitForHttp(baseUrl, 5_000);
      } catch {
        console.error(`[runtime-capture] ${baseUrl} is not reachable.`);
        console.error("  Start: pnpm dev:desktop:online");
        console.error("  Or:    node scripts/runtime-capture-e2e.mjs --start-pwa");
        process.exit(1);
      }
    }

    const exitCode = runPlaywright();
    const finalCode = finalizeReport(exitCode);
    process.exit(finalCode);
  } finally {
    stopPwa();
  }
}

main().catch((error) => {
  console.error("[runtime-capture] failed:", error instanceof Error ? error.message : error);
  stopPwa();
  process.exit(1);
});
