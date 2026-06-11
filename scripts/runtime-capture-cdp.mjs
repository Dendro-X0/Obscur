#!/usr/bin/env node
/**
 * Native Tauri runtime capture via CDP (no Playwright test runner).
 *
 * Use when capture:runtime:native / Playwright test path is awkward with auth.
 * You unlock Tester1 manually in Tauri; this script polls until the shell appears.
 *
 *   set WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS=--remote-debugging-port=9222
 *   pnpm dev:desktop:online
 *   pnpm capture:runtime:cdp
 *
 * Flags:
 *   --cdp URL              default http://127.0.0.1:9222
 *   --require-native       fail if __TAURI__ bridge missing after capture
 *   --wait-ms MS           default 180000 (3 min) for manual unlock
 *   --out DIR              artifact directory
 */

import { createRequire } from "node:module";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  formatNoObscurPageError,
  pickAppPageFromBrowser,
  waitForAppPageFromBrowser,
} from "./lib/cdp-app-page.mjs";
import {
  buildRuntimeCaptureReport,
  summarizeRuntimeCaptureReport,
} from "./lib/runtime-capture-lib.mjs";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const pwaDir = path.join(repoRoot, "apps", "pwa");
const requireFromPwa = createRequire(path.join(pwaDir, "package.json"));

const args = process.argv.slice(2);
const readArg = (flag, fallback) => {
  const i = args.indexOf(flag);
  return i >= 0 && args[i + 1] ? args[i + 1] : fallback;
};
const hasFlag = (flag) => args.includes(flag);

const cdpUrl = readArg("--cdp", "http://127.0.0.1:9222");
const requireNative = hasFlag("--require-native");
const waitMs = Number.parseInt(readArg("--wait-ms", process.env.OBSCUR_RUNTIME_CAPTURE_STARTUP_TIMEOUT_MS ?? "180000"), 10);
const outDir = path.resolve(readArg("--out", path.join(repoRoot, "test-results", "runtime-capture")));
const appBase = readArg("--base-url", "http://127.0.0.1:3340").replace(/\/$/, "");

const log = (msg) => console.log(`[runtime-capture:cdp] ${msg}`);

function loadPlaywright() {
  try {
    return requireFromPwa("playwright");
  } catch {
    return requireFromPwa("@playwright/test");
  }
}

async function isAppShellUnlocked(page) {
  for (const label of ["Settings", "Network", "Search", "Chats"]) {
    if (await page.getByRole("link", { name: label, exact: true }).isVisible().catch(() => false)) {
      return true;
    }
  }
  return false;
}

async function isAuthGateVisible(page) {
  if (await page.getByRole("button", { name: /^(unlock|log in)$/i }).isVisible().catch(() => false)) {
    return true;
  }
  if (await page.locator('input[type="password"]').first().isVisible().catch(() => false)) {
    return true;
  }
  return page.getByText(/welcome back|enter your password/i).isVisible().catch(() => false);
}

async function probeShellHealth(page) {
  return page.evaluate(() => {
    const api = window.obscurDevLab;
    if (api && typeof api.probeShellHealth === "function") {
      const health = api.probeShellHealth();
      return {
        healthy: health.healthy,
        shellUnlocked: health.shellUnlocked,
        rootFatalBoundary: health.rootFatalBoundary,
        settingsTabBoundary: health.settingsTabBoundary,
        issues: health.issues,
        fatalBoundaryMessage: health.fatalBoundaryMessage,
      };
    }
    const rootBoundary = Boolean(document.querySelector('[data-testid="root-error-boundary"]'));
    return {
      healthy: !rootBoundary,
      shellUnlocked: !rootBoundary,
      rootFatalBoundary: rootBoundary,
      settingsTabBoundary: false,
      issues: rootBoundary ? ["root_fatal_error_boundary"] : [],
      fatalBoundaryMessage: rootBoundary ? "Root error boundary active" : null,
    };
  });
}

async function waitForUnlockedShell(page) {
  const deadline = Date.now() + waitMs;
  let lastProgress = 0;
  while (Date.now() < deadline) {
    if (await isAppShellUnlocked(page)) {
      return;
    }
    const elapsed = Date.now() - (deadline - waitMs);
    if (elapsed - lastProgress >= 15_000) {
      lastProgress = elapsed;
      const onAuth = await isAuthGateVisible(page);
      log(
        onAuth
          ? `waiting for manual unlock in Tauri (${Math.round(elapsed / 1000)}s / ${Math.round(waitMs / 1000)}s)...`
          : `waiting for shell (${Math.round(elapsed / 1000)}s / ${Math.round(waitMs / 1000)}s)...`,
      );
    }
    await page.waitForTimeout(500);
  }
  if (await isAuthGateVisible(page)) {
    throw new Error(
      "Timed out on auth gate. Unlock Tester1 in the Tauri window, then re-run: pnpm capture:runtime:cdp",
    );
  }
  throw new Error("Timed out waiting for unlocked shell.");
}

async function tryDevLabUnlock(page) {
  await page.evaluate(async () => {
    const lab = window.obscurDevLab;
    if (lab && typeof lab.unlock === "function") {
      try {
        await lab.unlock("tester1");
      } catch {
        // fall through to manual unlock wait
      }
    }
  }).catch(() => undefined);
}

async function runNavigationSoak(page) {
  const routes = [
    { label: "Network", href: "/network" },
    { label: "Settings", href: "/settings" },
    { label: "Search", href: "/search" },
    { label: "Chats", href: "/" },
  ];
  const visited = [];
  for (const route of routes) {
    const link = page.getByRole("link", { name: route.label, exact: true });
    if (await link.isVisible().catch(() => false)) {
      await link.click();
    } else {
      await page.goto(`${appBase}${route.href === "/" ? "/" : route.href}`);
    }
    await page.waitForLoadState("domcontentloaded");
    visited.push(route.href);
    await page.waitForTimeout(400);
  }
  return visited;
}

async function captureDmKernelGate(page) {
  return page.evaluate(async () => {
    const lab = window.obscurDevLab;
    if (!lab) {
      return { devLabAvailable: false, writeProbe: null, oneSidedConversations: null };
    }
    const writeProbe = typeof lab.probeNativeDmSqliteWrite === "function"
      ? await lab.probeNativeDmSqliteWrite()
      : null;
    const oneSidedConversations = typeof lab.scanOneSidedNativeDmConversations === "function"
      ? await lab.scanOneSidedNativeDmConversations()
      : null;
    return { devLabAvailable: true, writeProbe, oneSidedConversations };
  });
}

async function captureFromPage(page) {
  const m0Bundle = await page.evaluate(() => {
    const api = window.obscurM0Triage;
    return api && typeof api.capture === "function" ? api.capture(300) : null;
  });
  const crossDeviceDigest = await page.evaluate(() => {
    const api = window.obscurAppEvents;
    return api && typeof api.getCrossDeviceSyncDigest === "function"
      ? api.getCrossDeviceSyncDigest(400)
      : null;
  });
  const runtimeCapabilities = await page.evaluate(() => {
    const w = window;
    const hasCallableNativeBridge =
      typeof w.__TAURI_INTERNALS__?.invoke === "function"
      || typeof w.__TAURI__?.core?.invoke === "function"
      || typeof w.__TAURI_IPC__ === "function";
    return {
      isNativeRuntime: hasCallableNativeBridge,
      isDesktop: hasCallableNativeBridge,
      isMobile: false,
      hasCallableNativeBridge,
      hostname: window.location?.hostname ?? null,
    };
  });
  return { m0Bundle, crossDeviceDigest, runtimeCapabilities };
}

function writeJson(name, value) {
  fs.mkdirSync(outDir, { recursive: true });
  const filePath = path.join(outDir, name);
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
  return filePath;
}

async function main() {
  const { chromium } = loadPlaywright();
  log(`connecting CDP ${cdpUrl}`);
  const browser = await chromium.connectOverCDP(cdpUrl);
  const page = await waitForAppPageFromBrowser(browser, { appBase, timeoutMs: 30_000 });
  if (!page) {
    const message = formatNoObscurPageError(browser, cdpUrl);
    await browser.close();
    throw new Error(message);
  }
  log(`attached ${page.url()}`);

  try {
    await tryDevLabUnlock(page);
    await waitForUnlockedShell(page);
    log("shell unlocked");

    const scenarios = [];
    const navVisited = await runNavigationSoak(page);
    const postNavHealth = await probeShellHealth(page);
    if (!postNavHealth.healthy) {
      throw new Error(`Shell unhealthy after navigation: ${postNavHealth.fatalBoundaryMessage ?? postNavHealth.issues.join(", ")}`);
    }
    scenarios.push({ id: "navigation_soak", visited: navVisited, passed: navVisited.length >= 3 });

    await page.reload({ waitUntil: "domcontentloaded" });
    await waitForUnlockedShell(page);
    const postReloadHealth = await probeShellHealth(page);
    if (!postReloadHealth.healthy) {
      throw new Error(`Shell unhealthy after reload: ${postReloadHealth.fatalBoundaryMessage ?? postReloadHealth.issues.join(", ")}`);
    }
    scenarios.push({ id: "cold_reload", passed: true });

    const { m0Bundle, crossDeviceDigest, runtimeCapabilities } = await captureFromPage(page);
    if (!m0Bundle) {
      throw new Error("obscurM0Triage.capture() unavailable");
    }
    if (!crossDeviceDigest) {
      throw new Error("obscurAppEvents.getCrossDeviceSyncDigest() unavailable");
    }

    const dmKernelGate = requireNative ? await captureDmKernelGate(page) : null;
    if (requireNative) {
      scenarios.push({
        id: "dm_kernel_runtime_gate",
        passed: dmKernelGate?.writeProbe?.ok === true
          && (dmKernelGate?.oneSidedConversations?.length ?? 0) === 0,
        writeProbeReason: dmKernelGate?.writeProbe?.reason ?? null,
        oneSidedCount: dmKernelGate?.oneSidedConversations?.length ?? null,
      });
    }

    const shellHealth = await probeShellHealth(page);

    const raw = {
      schema: "obscur.runtime-capture-report.v1",
      generatedAtUnixMs: Date.now(),
      surface: "tauri-webview-cdp",
      baseUrl: appBase,
      requireNative,
      scenarios,
      m0Bundle,
      crossDeviceDigest,
      runtimeCapabilities,
      dmKernelGate,
      shellHealth,
      shellUnlocked: shellHealth.shellUnlocked && !shellHealth.rootFatalBoundary,
    };

    writeJson("runtime-capture-latest.json", raw);
    const report = buildRuntimeCaptureReport({
      ...raw,
      requireNative,
      shellUnlocked: raw.shellUnlocked,
      shellHealth,
      dmKernelGate,
    });

    if (requireNative && !runtimeCapabilities.isNativeRuntime) {
      throw new Error("Native __TAURI__ bridge not detected — not running inside Tauri webview?");
    }

    const dmRisk = report.crossDeviceDigest?.summary?.selfAuthoredDmContinuity?.riskLevel;
    if (dmRisk === "high") {
      throw new Error(`DM continuity risk high (${dmRisk})`);
    }

    const evaluatedPath = writeJson("runtime-capture-evaluated.json", report);
    const summary = summarizeRuntimeCaptureReport(report);
    writeJson("runtime-capture-summary.json", summary);

    log(`passed=${summary.passed} native=${summary.isNativeRuntime}`);
    log(`evaluated → ${evaluatedPath}`);

    if (!summary.passed) {
      process.exit(1);
    }
  } finally {
    await browser.close();
  }
}

main().catch((error) => {
  console.error("[runtime-capture:cdp]", error instanceof Error ? error.message : error);
  process.exit(1);
});
