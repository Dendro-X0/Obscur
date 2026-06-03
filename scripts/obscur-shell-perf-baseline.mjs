#!/usr/bin/env node
/**
 * S0 — Obscur shell perf baseline: prod static export vs dev webpack server.
 *
 * Usage:
 *   node scripts/obscur-shell-perf-baseline.mjs prod [--skip-build] [--port 3350] [--out path]
 *   node scripts/obscur-shell-perf-baseline.mjs dev [--base-url URL] [--out path]
 *   node scripts/obscur-shell-perf-baseline.mjs compare <dev.json> <prod.json> [--out path]
 *
 * Dev: start `pnpm dev:desktop` (or `pnpm -C apps/pwa dev`) first.
 * Prod: builds desktop static export then serves apps/pwa/out (no webpack).
 */

import { createRequire } from "node:module";
import { spawn, spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  BASELINE_SCHEMA,
  compareBaselineReports,
  DEFAULT_NAV_SEQUENCE,
  parseBaselineReport,
  summarizeBaselineReport,
} from "./obscur-shell-perf-baseline-lib.mjs";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const pwaDir = path.join(repoRoot, "apps", "pwa");
const outDir = path.join(pwaDir, "out");
const defaultPerfDir = path.join(repoRoot, "docs", "assets", "perf");

const args = process.argv.slice(2);
const command = args[0];

function readArg(flag, fallback = undefined) {
  const index = args.indexOf(flag);
  if (index >= 0 && args[index + 1]) {
    return args[index + 1];
  }
  return fallback;
}

function hasFlag(flag) {
  return args.includes(flag);
}

function ensureDir(dirPath) {
  fs.mkdirSync(dirPath, { recursive: true });
}

function writeJson(filePath, value) {
  ensureDir(path.dirname(filePath));
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
  console.log(`Wrote ${filePath}`);
}

function loadJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function requirePlaywright() {
  const requireFromPwa = createRequire(path.join(pwaDir, "package.json"));
  try {
    return requireFromPwa("playwright");
  } catch {
    return requireFromPwa("@playwright/test");
  }
}

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

function runBuildPwaShell() {
  console.log("[s0] Building desktop static shell (build:pwa-shell)...");
  const result = spawnSync("node", ["scripts/build-pwa-shell.mjs", "desktop"], {
    cwd: repoRoot,
    stdio: "inherit",
    shell: process.platform === "win32",
  });
  if (result.status !== 0) {
    throw new Error("build:pwa-shell failed");
  }
  if (!fs.existsSync(path.join(outDir, "index.html"))) {
    throw new Error(`Missing ${path.join(outDir, "index.html")} after build`);
  }
}

/** @returns {import('node:child_process').ChildProcess} */
function startStaticServer(port) {
  const serveRoot = path.relative(repoRoot, outDir).split(path.sep).join("/") || ".";
  console.log(`[s0] Serving ${serveRoot} at http://127.0.0.1:${port} ...`);
  const proc = spawn(
    "npx",
    ["--yes", "serve", "-s", serveRoot, "-l", String(port)],
    {
      cwd: repoRoot,
      stdio: ["ignore", "pipe", "pipe"],
      shell: process.platform === "win32",
      env: { ...process.env, CI: "true" },
    },
  );
  proc.stdout?.on("data", (chunk) => {
    process.stdout.write(`[serve] ${chunk}`);
  });
  proc.stderr?.on("data", (chunk) => {
    process.stderr.write(`[serve] ${chunk}`);
  });
  return proc;
}

function stopProcess(proc) {
  if (!proc || proc.killed) {
    return;
  }
  try {
    proc.kill("SIGTERM");
  } catch {
    // ignore
  }
}

/**
 * @param {import('playwright').Page} page
 * @param {number} timeoutMs
 */
async function detectShellPhase(page, timeoutMs) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const settingsLink = page.getByRole("link", { name: "Settings", exact: true });
    if (await settingsLink.isVisible().catch(() => false)) {
      return "unlocked";
    }
    if (await page.getByText("Starting Obscur", { exact: false }).isVisible().catch(() => false)) {
      return "dpb";
    }
    if (await page.getByText("Experiment shell").isVisible().catch(() => false)) {
      return "unlocked";
    }
    await page.waitForTimeout(250);
  }
  return "timeout";
}

/**
 * @param {import('playwright').Page} page
 */
async function readRouteMountDiagnostics(page) {
  return page.evaluate(() => {
    const api = window.obscurRouteMountDiagnostics;
    if (!api || typeof api.getSnapshot !== "function") {
      return null;
    }
    const snapshot = api.getSnapshot();
    return {
      worstElapsedMs: snapshot.worstElapsedMs,
      slowSampleCount: snapshot.slowSampleCount,
      consecutiveSlowSampleCount: snapshot.consecutiveSlowSampleCount,
      recentSampleCount: snapshot.recentSamples?.length ?? 0,
    };
  });
}

/**
 * @param {import('playwright').Page} page
 * @param {string} label
 * @param {string} href
 */
async function waitForRouteReady(page, href) {
  if (href === "/search") {
    await page.getByLabel("Public key").waitFor({ state: "visible", timeout: 60_000 });
    return;
  }
  if (href === "/settings") {
    await page.locator("body").waitFor({ state: "visible", timeout: 60_000 });
    return;
  }
  await page.locator("body").waitFor({ state: "visible", timeout: 60_000 });
}

/**
 * @param {import('playwright').Page} page
 * @param {string} baseUrl
 * @param {'prod' | 'dev'} mode
 */
async function measureShellBaseline(page, baseUrl, mode) {
  const report = {
    schema: BASELINE_SCHEMA,
    mode,
    baseUrl,
    recordedAt: new Date().toISOString(),
    coldStart: null,
    checks: {},
    navigations: [],
    warnings: [],
  };

  const coldStart = Date.now();
  await page.goto(new URL("/", baseUrl).href, {
    waitUntil: "domcontentloaded",
    timeout: 120_000,
  });
  report.coldStart = { domContentLoadedMs: Date.now() - coldStart };

  const shellPhase = await detectShellPhase(page, 90_000);
  report.checks.shellPhase = shellPhase;
  report.checks.experimentShell = await page
    .getByTestId("experiment-shell-indicator")
    .isVisible()
    .catch(() => false);

  if (shellPhase !== "unlocked") {
    report.warnings.push(
      `Shell phase "${shellPhase}" — navigation matrix skipped. Unlock the app (or seed profile storage) and re-run.`,
    );
    report.summary = summarizeBaselineReport(report);
    return report;
  }

  for (const route of DEFAULT_NAV_SEQUENCE) {
    for (const visit of route.visits) {
      /** @type {import('./obscur-shell-perf-baseline-lib.mjs').NavigationSample} */
      const sample = {
        href: route.href,
        label: route.label,
        visit,
        elapsedMs: 0,
        urlMatched: false,
      };

      try {
        const link = page.getByRole("link", { name: route.label, exact: true });
        await link.waitFor({ state: "visible", timeout: 30_000 });
        const started = Date.now();
        await link.click();
        const hrefPattern = route.href === "/"
          ? /\/$/
          : new RegExp(`${route.href.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}(\\/|$)`);
        await page.waitForURL(hrefPattern, { timeout: 90_000 });
        await waitForRouteReady(page, route.href);
        sample.elapsedMs = Date.now() - started;
        sample.urlMatched = true;
        const diagnostics = await readRouteMountDiagnostics(page);
        if (diagnostics) {
          sample.routeMountWorstMs = diagnostics.worstElapsedMs;
          sample.routeMountSlowCount = diagnostics.slowSampleCount;
        }
      } catch (error) {
        sample.error = error instanceof Error ? error.message : String(error);
        report.warnings.push(`Navigation ${route.label} visit ${visit} failed: ${sample.error}`);
      }

      report.navigations.push(sample);
      console.log(
        `[s0] ${mode} ${route.label} visit=${visit} ${sample.error ? `ERR ${sample.error}` : `${sample.elapsedMs}ms`}`,
      );
    }
  }

  report.summary = summarizeBaselineReport(report);
  return report;
}

/**
 * @param {'prod' | 'dev'} mode
 * @param {string} baseUrl
 */
async function runMode(mode, baseUrl) {
  const { chromium } = requirePlaywright();
  const browser = await chromium.launch({
    headless: true,
    args: ["--disable-dev-shm-usage"],
  });
  const page = await browser.newPage();
  try {
    return await measureShellBaseline(page, baseUrl, mode);
  } finally {
    await browser.close();
  }
}

async function runProd() {
  const port = Number(readArg("--port", "3350"));
  const outPath = readArg(
    "--out",
    path.join(defaultPerfDir, "s0-prod.json"),
  );

  if (!hasFlag("--skip-build")) {
    runBuildPwaShell();
  } else if (!fs.existsSync(path.join(outDir, "index.html"))) {
    throw new Error("--skip-build set but apps/pwa/out is missing; run prod without --skip-build");
  }

  const baseUrl = `http://127.0.0.1:${port}`;
  const server = startStaticServer(port);
  try {
    await waitForHttp(baseUrl);
    const report = await runMode("prod", baseUrl);
    writeJson(outPath, report);
    console.log("[s0] Prod summary:", report.summary);
    return report;
  } finally {
    stopProcess(server);
  }
}

async function runDev() {
  const baseUrl = readArg("--base-url", "http://127.0.0.1:3340");
  const outPath = readArg(
    "--out",
    path.join(defaultPerfDir, "s0-dev.json"),
  );

  await waitForHttp(baseUrl, 15_000).catch(() => {
    throw new Error(
      `Dev server not reachable at ${baseUrl}. Start: pnpm dev:desktop (or pnpm -C apps/pwa dev)`,
    );
  });

  const report = await runMode("dev", baseUrl);
  writeJson(outPath, report);
  console.log("[s0] Dev summary:", report.summary);
  return report;
}

function runCompare() {
  const devPath = args[1];
  const prodPath = args[2];
  if (!devPath || !prodPath) {
    throw new Error("Usage: compare <dev.json> <prod.json> [--out path]");
  }
  const devReport = parseBaselineReport(loadJson(devPath));
  const prodReport = parseBaselineReport(loadJson(prodPath));
  const comparison = compareBaselineReports(devReport, prodReport);
  const outPath = readArg(
    "--out",
    path.join(defaultPerfDir, "s0-comparison.json"),
  );
  writeJson(outPath, comparison);
  console.log("\n[s0] Verdict:", comparison.verdict);
  console.log("[s0]", comparison.rationale);
  console.log("[s0] Dev median nav ms:", comparison.dev.medianNavMs);
  console.log("[s0] Prod median nav ms:", comparison.prod.medianNavMs);
  if (comparison.settingsCompileSignal) {
    console.log("[s0] Settings cold→warm on dev suggests route compile/cache (investigation §3).");
  }
  return comparison;
}

async function main() {
  if (command === "prod") {
    await runProd();
    return;
  }
  if (command === "dev") {
    await runDev();
    return;
  }
  if (command === "compare") {
    runCompare();
    return;
  }
  console.error(`Unknown command: ${command ?? "(none)"}`);
  console.error("Commands: prod | dev | compare");
  process.exit(1);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
