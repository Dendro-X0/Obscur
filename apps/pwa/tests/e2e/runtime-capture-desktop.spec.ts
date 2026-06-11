import { execSync } from "node:child_process";
import { chromium, expect, test as base } from "@playwright/test";
import {
  applyOperatorDevBundle,
  ensureUnlockedForRuntimeCapture,
  expectMessengerShell,
  TESTER1,
} from "./helpers/dev-test-accounts";
import {
  assertShellHealthy,
  captureCrossDeviceDigest,
  captureDmKernelRuntimeGate,
  captureM0Bundle,
  probeShellHealth,
  readRuntimeCapabilities,
  runNavigationSoak,
  writeRuntimeCaptureReport,
} from "./helpers/runtime-capture";
import { resolveAppBaseUrl } from "./helpers/app-url";
import { pickAppPageFromCdpBrowserAsync } from "./helpers/cdp-page";

const REQUIRE_NATIVE = process.env.OBSCUR_RUNTIME_CAPTURE_REQUIRE_NATIVE === "1";
const SURFACE = process.env.OBSCUR_RUNTIME_CAPTURE_SURFACE ?? "chromium";
const CDP_URL = process.env.OBSCUR_CDP_URL?.trim() || null;

const test = base.extend({
  page: async ({ page, baseURL }, use) => {
    if (!CDP_URL) {
      await use(page);
      return;
    }
    const browser = await chromium.connectOverCDP(CDP_URL);
    const cdpPage = await pickAppPageFromCdpBrowserAsync(browser, baseURL);
    if (!cdpPage) {
      const urls = browser.contexts().flatMap((ctx) => ctx.pages().map((p) => p.url()));
      await browser.close();
      throw new Error(
        [
          `No Obscur page on CDP endpoint ${CDP_URL}.`,
          `Expected ${resolveAppBaseUrl(baseURL)} or Tauri shell (tauri:// / tauri.localhost).`,
          "Launch Tauri with WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS=--remote-debugging-port=9222",
          urls.length > 0 ? `CDP pages seen: ${urls.join(", ")}` : "CDP has no open pages — is Tauri running?",
        ].join(" "),
      );
    }
    await use(cdpPage);
    await browser.close();
  },
});

const resolveGitSha = (): string | null => {
  try {
    return execSync("git rev-parse --short HEAD", { encoding: "utf8" }).trim();
  } catch {
    return null;
  }
};

test.describe("runtime capture — desktop golden path", () => {
  test("unlock, navigation soak, M0 bundle, digest gates", async ({ page, baseURL }) => {
    const startupWaitMs = Number.parseInt(process.env.OBSCUR_RUNTIME_CAPTURE_STARTUP_TIMEOUT_MS ?? "120000", 10);
    test.setTimeout(Math.max(180_000, startupWaitMs + 60_000));

    const appBaseUrl = resolveAppBaseUrl(baseURL);
    const scenarios: Array<Record<string, unknown>> = [];
    const startedAt = Date.now();

    await applyOperatorDevBundle(page);
    await ensureUnlockedForRuntimeCapture(page, TESTER1, appBaseUrl, {
      cdpNative: Boolean(CDP_URL && REQUIRE_NATIVE),
    });
    await assertShellHealthy(page, "unlock");
    await expectMessengerShell(page);
    scenarios.push({
      id: "shell_unlock",
      passed: true,
      elapsedMs: Date.now() - startedAt,
    });

    const navStarted = Date.now();
    const visited = await runNavigationSoak(page, appBaseUrl);
    await assertShellHealthy(page, "navigation_soak");
    scenarios.push({
      id: "navigation_soak",
      passed: visited.length >= 3,
      visited,
      elapsedMs: Date.now() - navStarted,
    });
    expect(visited.length).toBeGreaterThanOrEqual(3);

    const reloadStarted = Date.now();
    await page.reload({ waitUntil: "domcontentloaded" });
    await assertShellHealthy(page, "cold_reload");
    await expectMessengerShell(page);
    scenarios.push({
      id: "cold_reload",
      passed: true,
      elapsedMs: Date.now() - reloadStarted,
    });

    const m0Bundle = await captureM0Bundle(page, 300);
    expect(m0Bundle, "obscurM0Triage.capture() must be available").not.toBeNull();
    expect(m0Bundle?.checks?.requiredApis?.appEvents).toBe(true);

    const crossDeviceDigest = await captureCrossDeviceDigest(page, 400);
    expect(crossDeviceDigest, "obscurAppEvents.getCrossDeviceSyncDigest() must be available").not.toBeNull();

    const runtimeCapabilities = await readRuntimeCapabilities(page);
    const shellHealth = await probeShellHealth(page);

    const reportInput = {
      schema: "obscur.runtime-capture-report.v1",
      generatedAtUnixMs: Date.now(),
      surface: SURFACE,
      baseUrl: appBaseUrl,
      gitSha: resolveGitSha(),
      requireNative: REQUIRE_NATIVE,
      scenarios,
      m0Bundle,
      crossDeviceDigest,
      runtimeCapabilities,
      dmKernelGate,
      shellHealth,
      shellUnlocked: shellHealth.shellUnlocked && !shellHealth.rootFatalBoundary,
    };

    const reportPath = writeRuntimeCaptureReport(
      `runtime-capture-${new Date().toISOString().replace(/[:.]/g, "-")}.json`,
      reportInput,
    );

    writeRuntimeCaptureReport("runtime-capture-latest.json", reportInput);

    if (REQUIRE_NATIVE) {
      expect(
        runtimeCapabilities.isNativeRuntime,
        `Native bridge required. Re-run with Tauri CDP (see docs/program/runtime-capture-e2e.md). Report: ${reportPath}`,
      ).toBe(true);
    }

    const digest = crossDeviceDigest as {
      summary?: {
        selfAuthoredDmContinuity?: { riskLevel?: string };
        uiResponsiveness?: { riskLevel?: string };
      };
      recentWarnOrError?: ReadonlyArray<{ level?: string }>;
    };

    const dmRisk = digest.summary?.selfAuthoredDmContinuity?.riskLevel ?? "none";
    expect(
      dmRisk,
      `DM continuity risk too high (${dmRisk}). See ${reportPath}`,
    ).not.toBe("high");

    const uiRisk = digest.summary?.uiResponsiveness?.riskLevel;
    if (uiRisk) {
      expect(uiRisk, `UI responsiveness risk too high (${uiRisk})`).not.toBe("high");
    }

    const recentErrors = (digest.recentWarnOrError ?? []).filter((entry) => entry.level === "error");
    expect(
      recentErrors.length,
      `Recent digest errors: ${recentErrors.length}. See ${reportPath}`,
    ).toBe(0);
  });
});
