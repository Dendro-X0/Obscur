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
import { runMembershipLeaveRejoinLiveScenario } from "./lib/dev-lab-membership-leave-rejoin-live.mjs";
import { runAuth4ScopeProbeLiveScenario } from "./lib/dev-lab-auth4-scope-probe-live.mjs";
import { runTrustLiveScenario } from "./lib/dev-lab-trust-live.mjs";
import { runSecBotInboundLiveScenario } from "./lib/dev-lab-bot-inbound-live.mjs";
import { runTwoActorDmScenario } from "./lib/dev-lab-two-actor.mjs";
import {
  formatNoObscurPageError,
  pickAppPageFromBrowser,
} from "./lib/cdp-app-page.mjs";
import {
  resolveDevLabConnection,
  stopStaticShellServer,
} from "./lib/dev-lab-connection.mjs";
import {
  ensureComMem2InfraReady,
  stopComMem2InfraSpawned,
} from "./lib/dev-lab-com-mem-2-stack.mjs";
import {
  formatDevLabShellRebuildMessage,
  readDevLabShellCapabilities,
} from "./lib/dev-lab-playwright-capabilities.mjs";

const PHASE2_SCENARIO_IDS = new Set([
  "membership-leave-rejoin-zombie",
  "sec-bot-keyword-flood",
  "trust-fixtures",
  "auth4-scope-probe",
]);

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
 * CLI node-only scenarios (no Playwright shell).
 *
 * @param {Readonly<{
 *   scenarioId: string;
 *   category: string;
 *   runScenario: (deps: Readonly<{ log: (msg: string) => void; repoRoot: string }>) => Promise<{ passed: boolean }>;
 * }>} options
 */
async function runNodeOnlyCliScenario({ scenarioId, category, runScenario }) {
  log(`running ${scenarioId} (node-only CLI)`);
  const scenarioResult = await runScenario({ log, repoRoot });
  const report = {
    schema: "obscur.dev-lab.benchmark.v1",
    version: "obscur.dev-lab.v1",
    generatedAtUnixMs: Date.now(),
    suite: `scenario:${scenarioId}`,
    surface: "node-cli",
    baseUrl: null,
    passed: scenarioResult.passed,
    scenarios: [scenarioResult],
    summary: {
      total: 1,
      passed: scenarioResult.passed ? 1 : 0,
      failed: scenarioResult.passed ? 0 : 1,
      failedScenarioIds: scenarioResult.passed ? [] : [scenarioId],
      categories: { [category]: { total: 1, passed: scenarioResult.passed ? 1 : 0 } },
    },
    shellHealth: null,
    capture: null,
  };
  const evaluation = evaluateDevLabBenchmark(report);
  const summary = summarizeDevLabBenchmark({ ...report, passed: report.passed && evaluation.passed });
  writeJson("dev-lab-benchmark-latest.json", report);
  writeJson("dev-lab-benchmark-summary.json", summary);
  log(`${scenarioId} passed=${summary.passed}`);
  if (!summary.passed) {
    logFailedScenarioSteps(scenarioResult);
    process.exit(1);
  }
}

/**
 * CLI dual-browser scenarios need the same connection resolution as suite runs
 * (Next :3340, Tauri CDP, or auto-serve apps/pwa/out).
 *
 * @param {Readonly<{
 *   chromium: typeof import('playwright').chromium;
 *   scenarioId: string;
 *   category: string;
 *   requireComMem2Infra?: boolean;
 *   runScenario: (deps: Readonly<{ chromium: typeof import('playwright').chromium; appBase: string; log: (msg: string) => void }>) => Promise<{ passed: boolean }>;
 * }>} options
 */
async function runDualBrowserCliScenario({ chromium, scenarioId, category, runScenario, requireComMem2Infra = false }) {
  /** @type {import('node:child_process').ChildProcess | null} */
  let staticServerProc = null;
  try {
    if (requireComMem2Infra) {
      log("COM-MEM-2 infra preflight (coordination :8787 + relay :7000)…");
      const infra = await ensureComMem2InfraReady({ repoRoot, log });
      if (!infra.ok) {
        const scenarioResult = {
          id: scenarioId,
          name: scenarioId,
          category,
          passed: false,
          durationMs: 0,
          steps: [{
            id: "com_mem_2_infra",
            passed: false,
            message: infra.error === "relay_boot_timeout"
              ? "Local relay did not start on ws://localhost:7000 (Docker required for auto-spawn)."
              : "Coordination worker did not become healthy on http://127.0.0.1:8787/health.",
            durationMs: 0,
            context: infra,
          }],
        };
        const report = {
          schema: "obscur.dev-lab.benchmark.v1",
          version: "obscur.dev-lab.v1",
          generatedAtUnixMs: Date.now(),
          suite: `scenario:${scenarioId}`,
          surface: "playwright",
          baseUrl: appBase,
          passed: false,
          scenarios: [scenarioResult],
          summary: {
            total: 1,
            passed: 0,
            failed: 1,
            failedScenarioIds: [scenarioId],
            categories: { [category]: { total: 1, passed: 0 } },
          },
          shellHealth: null,
          capture: null,
        };
        writeJson("dev-lab-benchmark-latest.json", report);
        writeJson("dev-lab-benchmark-summary.json", summarizeDevLabBenchmark(report));
        log(`${scenarioId} passed=false`);
        logFailedScenarioSteps(scenarioResult);
        process.exit(1);
      }
      if (infra.spawned) {
        log("COM-MEM-2 infra ready (spawned coordination/relay for this run).");
      } else {
        log("COM-MEM-2 infra ready (external stack).");
      }
    }

    const connection = await resolveDevLabConnection({
      repoRoot,
      appBase,
      explicitCdpUrl,
      requireOnlineShell: true,
      log,
    });
    staticServerProc = connection.staticServerProc ?? null;
    const resolvedBase = connection.baseUrl;
    log(`running ${scenarioId} (dual browser) @ ${resolvedBase}`);
    const scenarioResult = await runScenario({ chromium, appBase: resolvedBase, log });
    const report = {
      schema: "obscur.dev-lab.benchmark.v1",
      version: "obscur.dev-lab.v1",
      generatedAtUnixMs: Date.now(),
      suite: `scenario:${scenarioId}`,
      surface: "playwright",
      baseUrl: resolvedBase,
      passed: scenarioResult.passed,
      scenarios: [scenarioResult],
      summary: {
        total: 1,
        passed: scenarioResult.passed ? 1 : 0,
        failed: scenarioResult.passed ? 0 : 1,
        failedScenarioIds: scenarioResult.passed ? [] : [scenarioId],
        categories: { [category]: { total: 1, passed: scenarioResult.passed ? 1 : 0 } },
      },
      shellHealth: null,
      capture: null,
    };
    const evaluation = evaluateDevLabBenchmark(report);
    const summary = summarizeDevLabBenchmark({ ...report, passed: report.passed && evaluation.passed });
    writeJson("dev-lab-benchmark-latest.json", report);
    writeJson("dev-lab-benchmark-summary.json", summary);
    log(`${scenarioId} passed=${summary.passed}`);
    if (!summary.passed) {
      logFailedScenarioSteps(scenarioResult);
      process.exit(1);
    }
  } finally {
    stopStaticShellServer(staticServerProc);
    if (requireComMem2Infra) {
      stopComMem2InfraSpawned();
    }
  }
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

async function assertPhase2ScenarioAvailable(page, scenarioId) {
  if (!PHASE2_SCENARIO_IDS.has(scenarioId)) {
    return;
  }
  const caps = await readDevLabShellCapabilities(page, { requiredScenarioIds: [scenarioId] });
  if (caps.missingScenarioIds.length > 0 || !caps.hasCreateZombiePersona) {
    throw new Error(formatDevLabShellRebuildMessage(caps));
  }
}

function logFailedScenarioSteps(scenarioResult) {
  if (scenarioResult?.passed !== false) {
    return;
  }
  if (scenarioResult.error) {
    log(`  error: ${scenarioResult.error}`);
  }
  for (const step of scenarioResult.steps ?? []) {
    if (step.passed === false) {
      log(`  step ${step.id}: ${step.message}`);
    }
  }
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
  await assertPhase2ScenarioAvailable(page, scenarioId);
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
    await runDualBrowserCliScenario({
      chromium,
      scenarioId: "two-actor-dm",
      category: "messaging",
      runScenario: runTwoActorDmScenario,
    });
    return;
  }

  if (scenario === "membership-join-leave") {
    await runDualBrowserCliScenario({
      chromium,
      scenarioId: "membership-join-leave",
      category: "network",
      requireComMem2Infra: true,
      runScenario: runMembershipJoinLeaveScenario,
    });
    return;
  }

  if (scenario === "membership-leave-rejoin-live") {
    await runDualBrowserCliScenario({
      chromium,
      scenarioId: "membership-leave-rejoin-live",
      category: "network",
      requireComMem2Infra: true,
      runScenario: runMembershipLeaveRejoinLiveScenario,
    });
    return;
  }

  if (scenario === "auth4-scope-probe-live") {
    await runDualBrowserCliScenario({
      chromium,
      scenarioId: "auth4-scope-probe-live",
      category: "auth",
      runScenario: runAuth4ScopeProbeLiveScenario,
    });
    return;
  }

  if (scenario === "trust-live") {
    await runDualBrowserCliScenario({
      chromium,
      scenarioId: "trust-live",
      category: "security",
      runScenario: runTrustLiveScenario,
    });
    return;
  }

  if (scenario === "sec-bot-inbound-live") {
    await runNodeOnlyCliScenario({
      scenarioId: "sec-bot-inbound-live",
      category: "security",
      runScenario: runSecBotInboundLiveScenario,
    });
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

      log("membership-leave-rejoin-live step (full suite)");
      const leaveLiveResult = await runMembershipLeaveRejoinLiveScenario({ chromium, appBase, log });
      report.scenarios = [...report.scenarios, leaveLiveResult];
      report.summary = buildBenchmarkSummary(report.scenarios);
      report.passed = report.summary.failed === 0;

      log("auth4-scope-probe-live step (full suite)");
      const auth4LiveResult = await runAuth4ScopeProbeLiveScenario({ chromium, appBase, log });
      report.scenarios = [...report.scenarios, auth4LiveResult];
      report.summary = buildBenchmarkSummary(report.scenarios);
      report.passed = report.summary.failed === 0;

      log("trust-live step (full suite)");
      const trustLiveResult = await runTrustLiveScenario({ chromium, appBase, log });
      report.scenarios = [...report.scenarios, trustLiveResult];
      report.summary = buildBenchmarkSummary(report.scenarios);
      report.passed = report.summary.failed === 0;

      log("sec-bot-inbound-live step (full suite)");
      const botInboundLiveResult = await runSecBotInboundLiveScenario({ log, repoRoot });
      report.scenarios = [...report.scenarios, botInboundLiveResult];
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
      for (const failed of report.scenarios.filter((entry) => !entry.passed)) {
        logFailedScenarioSteps(failed);
      }
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
