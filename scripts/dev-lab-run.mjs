#!/usr/bin/env node
/**
 * Dev Lab benchmark runner (Playwright → :3340, static out/ serve, or Tauri CDP).
 *
 *   pnpm dev:desktop:online
 *   pnpm dev:lab:smoke
 *
 * When :3340 is down (default static Tauri dev), auto-tries CDP :9222 then serves apps/pwa/out.
 *
 * Flags:
 *   --suite smoke|core|full     default core
 *   --scenario ID               run single scenario
 *   --base-url URL              default http://127.0.0.1:3340
 *   --cdp URL                   connect to Tauri WebView instead of launching Chromium
 *   --out DIR                   artifact directory
 *   --cold-reload               run cold-reload step after suite (CLI-only)
 */

import { createRequire } from "node:module";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { evaluateDevLabBenchmark, summarizeDevLabBenchmark } from "./lib/dev-lab-benchmark-lib.mjs";
import { buildBenchmarkSummary, resolveSuiteScenarioIds } from "./lib/dev-lab-suite-scenarios.mjs";
import { applyDevOperatorBundle, ensureTester1Unlocked, probeShellHealth } from "./lib/dev-lab-playwright-auth.mjs";
import { runDmNativePersistScenario } from "./lib/dev-lab-dm-native-persist.mjs";
import { runDmNativeRelayBackfillScenario } from "./lib/dev-lab-dm-native-relay-backfill.mjs";
import { runDmReloadHistoryScenario } from "./lib/dev-lab-dm-reload-history.mjs";
import { runMembershipJoinLeaveScenario } from "./lib/dev-lab-membership-join-leave.mjs";
import { runTwoActorDmScenario } from "./lib/dev-lab-two-actor.mjs";
import {
  formatNoObscurPageError,
  pickAppPageFromBrowser,
} from "./lib/cdp-app-page.mjs";
import {
  resolveDevLabConnection,
  stopStaticShellServer,
} from "./lib/dev-lab-connection.mjs";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const pwaDir = path.join(repoRoot, "apps", "pwa");
const requireFromPwa = createRequire(path.join(pwaDir, "package.json"));

const args = process.argv.slice(2);
const readArg = (flag, fallback) => {
  const i = args.indexOf(flag);
  return i >= 0 && args[i + 1] ? args[i + 1] : fallback;
};
const hasFlag = (flag) => args.includes(flag);

const suite = readArg("--suite", "core");
const scenario = readArg("--scenario", null);
const appBase = readArg("--base-url", "http://127.0.0.1:3340").replace(/\/$/, "");
const explicitCdpUrl = readArg("--cdp", process.env.OBSCUR_CDP_URL?.trim() || null);

/** @type {string | null} */
let activeCdpUrl = null;
const outDir = path.resolve(readArg("--out", path.join(repoRoot, "test-results", "dev-lab")));
const coldReload = hasFlag("--cold-reload") || suite === "full";

const log = (msg) => console.log(`[dev-lab] ${msg}`);

function loadPlaywright() {
  try {
    return requireFromPwa("playwright");
  } catch {
    return requireFromPwa("@playwright/test");
  }
}

function writeJson(name, value) {
  fs.mkdirSync(outDir, { recursive: true });
  const filePath = path.join(outDir, name);
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
  return filePath;
}

/**
 * @param {import('playwright').Page} page
 * @param {Record<string, unknown>} result
 * @param {{ scenarioId: string; surface: string }} options
 */
async function enrichFailedScenario(page, result, { scenarioId, surface }) {
  if (result.passed === true || surface === "in-app") {
    return result;
  }
  const failedSteps = (result.steps ?? []).filter((step) => step.passed === false);
  if (failedSteps.length === 0) {
    return result;
  }

  const capture = await page.evaluate(() => window.obscurDevLab?.captureBundle?.(120) ?? null).catch(() => null);
  const pathname = await page.evaluate(() => `${window.location.pathname}${window.location.search}`).catch(() => "");
  const digestSummary = capture?.digest?.summary ?? null;
  const shellHealth = capture?.shellHealth ?? null;

  let screenshotFile = null;
  try {
    const screenshotName = `failure-${scenarioId}-${Date.now()}.png`;
    const screenshotPath = path.join(outDir, screenshotName);
    await page.screenshot({ path: screenshotPath, fullPage: true });
    screenshotFile = screenshotName;
  } catch {
    screenshotFile = null;
  }

  return {
    ...result,
    failureArtifacts: {
      screenshotFile,
      pathname,
      failedStepIds: failedSteps.map((step) => step.id),
      shellHealth,
      digestSummary,
    },
  };
}

async function waitForDevLab(page, timeoutMs = 60_000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const ready = await page.evaluate(() => typeof window.obscurDevLab?.runBenchmark === "function");
    if (ready) {
      return;
    }
    await page.waitForTimeout(500);
  }
  throw new Error(
    "window.obscurDevLab not available — rebuild static shell (pnpm dev:desktop:online -- --rebuild) or use pnpm dev:desktop:online:live",
  );
}

async function waitForHealthyShell(page, timeoutMs = 180_000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const health = await page.evaluate(() => window.obscurDevLab?.probeShellHealth?.() ?? null);
    if (health?.shellUnlocked && !health?.rootFatalBoundary) {
      return;
    }
    await page.waitForTimeout(500);
  }
  throw new Error("Timed out waiting for unlocked healthy shell.");
}

async function runScenarioOnPage(page, scenarioId, playwrightDeps) {
  if (scenarioId === "dm-reload-history") {
    return runDmReloadHistoryScenario(page, playwrightDeps);
  }
  if (scenarioId === "dm-native-persist") {
    return runDmNativePersistScenario(page, {
      ...playwrightDeps,
      requireNative: Boolean(activeCdpUrl),
    });
  }
  if (scenarioId === "dm-native-relay-backfill") {
    return runDmNativeRelayBackfillScenario(page, {
      ...playwrightDeps,
      requireNative: Boolean(activeCdpUrl),
    });
  }
  await waitForDevLab(page);
  const timeoutMs = scenarioId === "auth-unlock" ? 120_000 : 90_000;
  try {
    return await page.evaluate(
      ({ id, waitMs }) => window.obscurDevLab.runScenario(id),
      { id: scenarioId, waitMs: timeoutMs },
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (!message.includes("Execution context was destroyed")) {
      throw error;
    }
    log(`scenario ${scenarioId}: context reset after navigation — recovering`);
    await page.waitForLoadState("domcontentloaded").catch(() => undefined);
    await waitForDevLab(page);
    await ensureTester1Unlocked(page, { log, timeoutMs: 90_000 }).catch(() => undefined);
    return page.evaluate(async (id) => window.obscurDevLab.runScenario(id), scenarioId);
  }
}

async function runBenchmarkOnPage(page, { suiteId, baseUrl, surface, playwrightDeps }) {
  const scenarioIds = resolveSuiteScenarioIds(suiteId, { includeTerminal: false });
  const scenarios = [];
  for (const scenarioId of scenarioIds) {
    log(`scenario ${scenarioId}`);
    let result = await runScenarioOnPage(page, scenarioId, playwrightDeps);
    result = await enrichFailedScenario(page, result, { scenarioId, surface });
    scenarios.push(result);
    if (!result.passed && result.steps?.some((step) => step.context?.health?.rootFatalBoundary === true)) {
      log(`stopping suite — fatal boundary after ${scenarioId}`);
      break;
    }
  }

  const shellHealth = await page.evaluate(() => window.obscurDevLab?.probeShellHealth?.() ?? null);
  const capture = await page.evaluate(() => window.obscurDevLab?.captureBundle?.(120) ?? null);
  const version = await page.evaluate(() => window.obscurDevLab?.version ?? "obscur.dev-lab.v1");
  const summary = buildBenchmarkSummary(scenarios);

  return {
    schema: "obscur.dev-lab.benchmark.v1",
    version,
    generatedAtUnixMs: Date.now(),
    suite: suiteId,
    surface,
    baseUrl,
    passed: summary.failed === 0,
    scenarios,
    summary,
    shellHealth,
    capture,
  };
}

async function main() {
  const { chromium } = loadPlaywright();

  if (scenario === "two-actor-dm") {
    log("running two-actor-dm (dual browser)");
    const twoActorResult = await runTwoActorDmScenario({ chromium, appBase, log });
    const report = {
      schema: "obscur.dev-lab.benchmark.v1",
      version: "obscur.dev-lab.v1",
      generatedAtUnixMs: Date.now(),
      suite: "scenario:two-actor-dm",
      surface: "playwright",
      baseUrl: appBase,
      passed: twoActorResult.passed,
      scenarios: [twoActorResult],
      summary: {
        total: 1,
        passed: twoActorResult.passed ? 1 : 0,
        failed: twoActorResult.passed ? 0 : 1,
        failedScenarioIds: twoActorResult.passed ? [] : ["two-actor-dm"],
        categories: { messaging: { total: 1, passed: twoActorResult.passed ? 1 : 0 } },
      },
      shellHealth: null,
      capture: null,
    };
    const evaluation = evaluateDevLabBenchmark(report);
    const summary = summarizeDevLabBenchmark({ ...report, passed: report.passed && evaluation.passed });
    writeJson("dev-lab-benchmark-latest.json", report);
    writeJson("dev-lab-benchmark-summary.json", summary);
    log(`two-actor-dm passed=${summary.passed}`);
    if (!summary.passed) {
      process.exit(1);
    }
    return;
  }

  if (scenario === "membership-join-leave") {
    log("running membership-join-leave (dual browser)");
    const membershipResult = await runMembershipJoinLeaveScenario({ chromium, appBase, log });
    const report = {
      schema: "obscur.dev-lab.benchmark.v1",
      version: "obscur.dev-lab.v1",
      generatedAtUnixMs: Date.now(),
      suite: "scenario:membership-join-leave",
      surface: "playwright",
      baseUrl: appBase,
      passed: membershipResult.passed,
      scenarios: [membershipResult],
      summary: {
        total: 1,
        passed: membershipResult.passed ? 1 : 0,
        failed: membershipResult.passed ? 0 : 1,
        failedScenarioIds: membershipResult.passed ? [] : ["membership-join-leave"],
        categories: { network: { total: 1, passed: membershipResult.passed ? 1 : 0 } },
      },
      shellHealth: null,
      capture: null,
    };
    const evaluation = evaluateDevLabBenchmark(report);
    const summary = summarizeDevLabBenchmark({ ...report, passed: report.passed && evaluation.passed });
    writeJson("dev-lab-benchmark-latest.json", report);
    writeJson("dev-lab-benchmark-summary.json", summary);
    log(`membership-join-leave passed=${summary.passed}`);
    if (!summary.passed) {
      process.exit(1);
    }
    return;
  }

  /** @type {import('playwright').Page} */
  let page;
  /** @type {import('playwright').Browser | null} */
  let ownedBrowser = null;
  /** @type {import('node:child_process').ChildProcess | null} */
  let staticServerProc = null;

  if ((scenario === "dm-native-persist" || scenario === "dm-native-relay-backfill") && !explicitCdpUrl) {
    log(`${scenario} requires --cdp against Tauri WebView`);
    process.exit(1);
  }

  const requireOnlineShell = !explicitCdpUrl && (suite === "core" || suite === "full" || coldReload);
  const connection = await resolveDevLabConnection({
    repoRoot,
    appBase,
    explicitCdpUrl,
    requireOnlineShell,
    log,
  });
  activeCdpUrl = connection.cdpUrl ?? null;
  staticServerProc = connection.staticServerProc ?? null;

  if (connection.mode === "cdp" && activeCdpUrl) {
    log(`connecting CDP ${activeCdpUrl}`);
    const browser = await chromium.connectOverCDP(activeCdpUrl);
    page = await pickAppPageFromBrowser(browser, appBase);
    if (!page) {
      const message = formatNoObscurPageError(browser, activeCdpUrl);
      await browser.close();
      throw new Error(message);
    }
  } else {
    ownedBrowser = await chromium.launch({ headless: true });
    const context = await ownedBrowser.newContext({
      baseURL: connection.baseUrl,
      viewport: { width: 1280, height: 720 },
    });
    page = await context.newPage();
    await page.goto("/");
    await applyDevOperatorBundle(page);
  }

  try {
    await waitForDevLab(page);
    page.setDefaultTimeout(120_000);
    log("unlocking Tester1");
    await ensureTester1Unlocked(page, { log, timeoutMs: 120_000 });
    await page.waitForFunction(
      () => {
        const status = window.obscurDevLab?.getMessagingStatus?.() ?? null;
        return status === "ready" || status === null;
      },
      undefined,
      { timeout: 90_000 },
    ).catch(() => {
      log("messaging bridge not ready after unlock — DM scenarios may skip or fail");
    });

    const playwrightDeps = {
      log,
      applyDevOperatorBundle,
      ensureTester1Unlocked,
      chromium,
      appBase,
    };

    let report;
    if (scenario) {
      log(`scenario ${scenario}`);
      let result = await runScenarioOnPage(page, scenario, playwrightDeps);
      result = await enrichFailedScenario(page, result, {
        scenarioId: scenario,
        surface: activeCdpUrl ? "cdp" : "playwright",
      });
      const summary = buildBenchmarkSummary([result]);
      const shellHealth = await page.evaluate(() => window.obscurDevLab?.probeShellHealth?.() ?? null);
      const capture = await page.evaluate(() => window.obscurDevLab?.captureBundle?.(120) ?? null);
      const version = await page.evaluate(() => window.obscurDevLab?.version ?? "obscur.dev-lab.v1");
      report = {
        schema: "obscur.dev-lab.benchmark.v1",
        version,
        generatedAtUnixMs: Date.now(),
        suite: `scenario:${scenario}`,
        surface: activeCdpUrl ? "cdp" : "playwright",
        baseUrl: appBase,
        passed: result.passed,
        scenarios: [result],
        summary,
        shellHealth,
        capture,
      };
    } else {
      log(`running benchmark suite=${suite}`);
      report = await runBenchmarkOnPage(page, {
        suiteId: suite,
        baseUrl: appBase,
        surface: activeCdpUrl ? "cdp" : "playwright",
        playwrightDeps,
      });
    }

    if (coldReload && !scenario) {
      log("cold-reload step");
      await page.reload({ waitUntil: "domcontentloaded" });
      await applyDevOperatorBundle(page);
      await waitForDevLab(page);
      try {
        await ensureTester1Unlocked(page, { log, timeoutMs: 90_000 });
      } catch {
        // Record failure below via health probe.
      }
      const reloadHealth = await probeShellHealth(page);
      const coldScenario = {
        id: "cold-reload",
        name: "Cold reload shell health",
        category: "shell",
        passed: reloadHealth?.healthy === true,
        durationMs: 0,
        steps: [{
          id: "cold_reload",
          passed: reloadHealth?.healthy === true,
          message: reloadHealth?.healthy
            ? "Healthy after reload."
            : `Unhealthy after reload: ${reloadHealth?.issues?.join(", ") ?? "auth/shell timeout"}`,
          durationMs: 0,
          context: { health: reloadHealth },
        }],
      };
      report.scenarios = [...report.scenarios, coldScenario];
      report.shellHealth = reloadHealth;
      report.summary = buildBenchmarkSummary(report.scenarios);
      report.passed = report.summary.failed === 0;
    }

    if (suite === "full" && !scenario) {
      log("membership-join-leave step (full suite)");
      const membershipResult = await runMembershipJoinLeaveScenario({ chromium, appBase, log });
      report.scenarios = [...report.scenarios, membershipResult];
      report.summary = buildBenchmarkSummary(report.scenarios);
      report.passed = report.summary.failed === 0;

      log("two-actor-dm step (full suite)");
      const twoActorResult = await runTwoActorDmScenario({ chromium, appBase, log });
      report.scenarios = [...report.scenarios, twoActorResult];
      report.summary = buildBenchmarkSummary(report.scenarios);
      report.passed = report.summary.failed === 0;

      if (activeCdpUrl) {
        log("dm-native-persist step (full suite, CDP)");
        const nativePersistResult = await runDmNativePersistScenario(page, {
          ...playwrightDeps,
          requireNative: true,
        });
        report.scenarios = [...report.scenarios, nativePersistResult];
        report.summary = buildBenchmarkSummary(report.scenarios);
        report.passed = report.summary.failed === 0;

        log("dm-native-relay-backfill step (full suite, CDP)");
        const relayBackfillResult = await runDmNativeRelayBackfillScenario(page, {
          ...playwrightDeps,
          requireNative: true,
        });
        report.scenarios = [...report.scenarios, relayBackfillResult];
        report.summary = buildBenchmarkSummary(report.scenarios);
        report.passed = report.summary.failed === 0;
      } else {
        log("dm-native-persist skipped (no --cdp)");
        report.scenarios = [...report.scenarios, {
          id: "dm-native-persist",
          name: "Native DM history survives reload (CDP)",
          category: "messaging",
          passed: true,
          durationMs: 0,
          steps: [{
            id: "skipped",
            passed: true,
            message: "Skipped — pass --cdp against Tauri for native SQLite proof.",
            durationMs: 0,
          }],
        }, {
          id: "dm-native-relay-backfill",
          name: "Native DM relay backfill repair (CDP)",
          category: "messaging",
          passed: true,
          durationMs: 0,
          steps: [{
            id: "skipped",
            passed: true,
            message: "Skipped — pass --cdp against Tauri for native relay backfill proof.",
            durationMs: 0,
          }],
        }];
        report.summary = buildBenchmarkSummary(report.scenarios);
      }
    }

    const evaluation = evaluateDevLabBenchmark(report);
    const summary = summarizeDevLabBenchmark({ ...report, passed: report.passed && evaluation.passed });

    writeJson("dev-lab-benchmark-latest.json", report);
    writeJson("dev-lab-benchmark-evaluated.json", { report, evaluation, summary });
    writeJson("dev-lab-benchmark-summary.json", summary);

    log(`scenarios ${summary.scenarioTotal - summary.scenarioFailed}/${summary.scenarioTotal} passed=${summary.passed}`);
    if (!summary.passed) {
      log(`failed: ${summary.failedScenarioIds.join(", ") || summary.failedGateIds.join(", ")}`);
      process.exit(1);
    }
  } finally {
    if (ownedBrowser) {
      await Promise.race([
        ownedBrowser.close(),
        new Promise((resolve) => setTimeout(resolve, 5000)),
      ]).catch(() => undefined);
    }
    stopStaticShellServer(staticServerProc);
  }
}

main().catch((error) => {
  console.error("[dev-lab]", error instanceof Error ? error.message : error);
  process.exit(1);
});
