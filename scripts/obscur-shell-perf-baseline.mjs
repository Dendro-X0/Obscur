#!/usr/bin/env node
/**
 * S0 — Obscur shell perf baseline: prod static export vs dev webpack server.
 *
 * Usage:
 *   node scripts/obscur-shell-perf-baseline.mjs prod [--skip-build] [--port 3350] [--out path] [--unlock] [--rapid]
 *   node scripts/obscur-shell-perf-baseline.mjs dev [--base-url URL] [--out path] [--unlock] [--rapid]
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
  evaluateRapidNavGate,
  evaluateV2PerfGate,
  parseBaselineReport,
  RAPID_NAV_SEQUENCE,
  summarizeBaselineReport,
} from "./obscur-shell-perf-baseline-lib.mjs";
import { ensurePerfBaselineUnlocked } from "./obscur-shell-perf-unlock.mjs";

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
  const buildEnv = hasFlag("--unlock")
    ? { NEXT_PUBLIC_OBSCUR_DEV_LAB: "1" }
    : {};
  if (hasFlag("--unlock")) {
    console.log("[s0] Building with NEXT_PUBLIC_OBSCUR_DEV_LAB=1 for programmatic unlock...");
  }
  console.log("[s0] Building desktop static shell (build:pwa-shell)...");
  const result = spawnSync("node", ["scripts/build-pwa-shell.mjs", "desktop"], {
    cwd: repoRoot,
    stdio: "inherit",
    shell: process.platform === "win32",
    env: { ...process.env, ...buildEnv },
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
    const searchInput = page.getByPlaceholder(/npub|contact card|Search people/i).first();
    await searchInput.waitFor({ state: "visible", timeout: 60_000 });
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
/**
 * @param {import('playwright').Page} page
 * @param {string} label
 * @param {string} href
 */
async function clickSidebarRoute(page, label, href) {
  const link = page.getByRole("link", { name: label, exact: true });
  await link.waitFor({ state: "visible", timeout: 30_000 });
  const started = Date.now();
  await link.click();
  const hrefPattern = href === "/"
    ? /\/$/
    : new RegExp(`${href.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}(\\/|$)`);
  await page.waitForURL(hrefPattern, { timeout: 90_000 });
  await waitForRouteReady(page, href);
  const elapsedMs = Date.now() - started;
  const diagnostics = await readRouteMountDiagnostics(page);
  return {
    href,
    label,
    elapsedMs,
    urlMatched: true,
    routeMountWorstMs: diagnostics?.worstElapsedMs,
    routeMountSlowCount: diagnostics?.slowSampleCount,
  };
}

async function measureRapidNavigation(page) {
  /** @type {import('./obscur-shell-perf-baseline-lib.mjs').NavigationSample[]} */
  const samples = [];
  for (const route of RAPID_NAV_SEQUENCE) {
    /** @type {import('./obscur-shell-perf-baseline-lib.mjs').NavigationSample} */
    const sample = {
      href: route.href,
      label: route.label,
      visit: 1,
      elapsedMs: 0,
      urlMatched: false,
    };
    try {
      const result = await clickSidebarRoute(page, route.label, route.href);
      Object.assign(sample, result);
    } catch (error) {
      sample.error = error instanceof Error ? error.message : String(error);
    }
    samples.push(sample);
    console.log(
      `[s0] rapid ${route.label} ${sample.error ? `ERR ${sample.error}` : `${sample.elapsedMs}ms`}`,
    );
  }
  return {
    samples,
    gate: evaluateRapidNavGate(samples),
  };
}

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

  if (hasFlag("--unlock")) {
    try {
      await ensurePerfBaselineUnlocked(page);
      report.checks.unlock = "dev_lab_or_auth_ui";
    } catch (error) {
      report.checks.unlock = "failed";
      report.warnings.push(
        `Unlock failed: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  const shellPhaseAfterUnlock = await detectShellPhase(page, 5_000);
  if (shellPhaseAfterUnlock === "unlocked") {
    report.checks.shellPhase = "unlocked";
  }

  if (report.checks.shellPhase !== "unlocked") {
    report.warnings.push(
      `Shell phase "${report.checks.shellPhase}" — navigation matrix skipped. Re-run with --unlock or seed profile storage.`,
    );
    report.summary = summarizeBaselineReport(report);
    report.v2PerfGate = evaluateV2PerfGate(report);
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
        const result = await clickSidebarRoute(page, route.label, route.href);
        sample.elapsedMs = result.elapsedMs;
        sample.urlMatched = result.urlMatched;
        sample.routeMountWorstMs = result.routeMountWorstMs;
        sample.routeMountSlowCount = result.routeMountSlowCount;
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

  if (hasFlag("--rapid")) {
    const rapidNav = await measureRapidNavigation(page);
    report.checks.rapidNav = rapidNav.gate;
    report.rapidNavigations = rapidNav.samples;
  }

  report.summary = summarizeBaselineReport(report);
  report.v2PerfGate = evaluateV2PerfGate(report);
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
    if (report.v2PerfGate) {
      console.log("[s0] v2 perf gate:", report.v2PerfGate.pass ? "PASS" : "FAIL", report.v2PerfGate.issues);
    }
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
      `Dev server not reachable at ${baseUrl}. Start: pnpm dev:desktop:live (or pnpm dev:desktop:online), then pnpm perf:v2:baseline:dev-webpack`,
    );
  });

  const report = await runMode("dev", baseUrl);
  writeJson(outPath, report);
  console.log("[s0] Dev summary:", report.summary);
  if (report.v2PerfGate) {
    console.log("[s0] v2 perf gate:", report.v2PerfGate.pass ? "PASS" : "FAIL", report.v2PerfGate.issues);
  }
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
