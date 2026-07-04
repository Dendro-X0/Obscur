#!/usr/bin/env node
/**
 * Automated profile-picker verification (Playwright + static shell + Tauri mock).
 * Full native window focus requires CDP: WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS=--remote-debugging-port=9222
 *
 *   node scripts/verify-profile-picker-flow.mjs
 *   node scripts/verify-profile-picker-flow.mjs --cdp http://127.0.0.1:9222
 */
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import {
  resolveDevLabConnection,
  stopStaticShellServer,
} from "./lib/dev-lab-connection.mjs";
import { pickAppPageFromBrowser } from "./lib/cdp-app-page.mjs";
import { ensureTester1Unlocked, isShellUnlocked } from "./lib/dev-lab-playwright-auth.mjs";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const appBase = process.env.OBSCUR_APP_BASE?.trim() || "http://127.0.0.1:3341";
const explicitCdp = process.argv.includes("--cdp")
  ? process.argv[process.argv.indexOf("--cdp") + 1]
  : null;

const log = (msg) => console.log(`[profile-picker-verify] ${msg}`);

const MOCK_SNAPSHOT = {
  currentWindow: {
    windowLabel: "main",
    profileId: "default",
    profileLabel: "Default",
    launchMode: "existing",
  },
  profiles: [
    {
      profileId: "default",
      label: "Default",
      createdAtUnixMs: 1,
      lastUsedAtUnixMs: Date.now(),
    },
    {
      profileId: "profile-2",
      label: "Profile slot",
      createdAtUnixMs: 2,
      lastUsedAtUnixMs: 0,
    },
  ],
  windowBindings: [
    {
      windowLabel: "main",
      profileId: "default",
      profileLabel: "Default",
      launchMode: "existing",
    },
  ],
};

function buildTauriMockInitScript() {
  return `(() => {
    const snapshot = ${JSON.stringify(MOCK_SNAPSHOT)};
    const invokeLog = [];
    window.__OBSCUR_WINDOW_BOOT__ = {
      windowLabel: "main",
      profileId: "default",
      launchMode: "existing",
    };
    window.__OBSCUR_SYNC_PROFILE_SCOPE__ = "default";
    window.__TAURI_INTERNALS__ = {
      invoke: async (command, args) => {
        invokeLog.push({ command, args });
        window.__obscurProfilePickerInvokeLog = invokeLog;
        if (command === "desktop_get_profile_isolation_snapshot") {
          return snapshot;
        }
        if (command === "desktop_list_profiles") {
          return snapshot.profiles;
        }
        if (command === "desktop_list_active_session_leases") {
          return [];
        }
        if (command === "desktop_open_profile_window") {
          return null;
        }
        if (command === "get_current_window" || command === "plugin:window|get_current_window") {
          return { label: "main" };
        }
        if (command.startsWith("desktop_") || command.startsWith("plugin:")) {
          return null;
        }
      },
    };
    try {
      const profileKey = "dweb.nostr.pwa.profile::default";
      window.localStorage.setItem(profileKey, JSON.stringify({
        version: 1,
        profile: { username: "Tester1", avatarUrl: "" },
      }));
      window.localStorage.setItem("obscur.profiles.registry.v1", JSON.stringify({
        profiles: snapshot.profiles.map((p) => ({ profileId: p.profileId, label: p.label })),
      }));
    } catch {
      // ignore
    }
  })();`;
}

async function loadPlaywright() {
  const pwaRoot = path.join(repoRoot, "apps", "pwa");
  const require = createRequire(path.join(pwaRoot, "package.json"));
  try {
    return require("playwright");
  } catch {
    return require("@playwright/test");
  }
}

async function assertNoProfilesRedirectLoop(page) {
  const pathname = new URL(page.url()).pathname;
  if (pathname !== "/sign-in") {
    throw new Error(`Expected /sign-in after clicking current-window profile, got ${pathname}`);
  }
  await page.waitForTimeout(1500);
  const after = new URL(page.url()).pathname;
  if (after === "/profiles") {
    throw new Error("Redirect loop detected: /sign-in bounced back to /profiles");
  }
}

async function runMockedShellChecks(page) {
  await page.goto(`${appBase}/profiles`, { waitUntil: "domcontentloaded", timeout: 60_000 });
  await page.waitForTimeout(8000);
  const pickerVisible = await page.getByText(/Who's using Obscur\?/i).isVisible().catch(() => false);
  if (!pickerVisible) {
    const body = await page.locator("body").innerText();
    throw new Error(`Profile picker grid not shown. URL=${page.url()} body=${body.slice(0, 500)}`);
  }

  const testerCard = page.locator("button").filter({ hasText: /Tester1/i }).first();
  await testerCard.waitFor({ state: "visible", timeout: 15_000 });
  await testerCard.click();
  await assertNoProfilesRedirectLoop(page);
  log("PASS mocked shell — Tester1 click reaches /sign-in without redirect loop");

  await page.goto(`${appBase}/profiles`, { waitUntil: "domcontentloaded" });
  await page.waitForSelector("text=Who's using Obscur?", { timeout: 30_000 });
  const slotCard = page.locator("button").filter({ hasText: /Profile slot/i }).first();
  await slotCard.click();
  await page.waitForTimeout(1000);
  const openCalls = await page.evaluate(() =>
    (window.__obscurProfilePickerInvokeLog ?? []).filter((entry) => entry.command === "desktop_open_profile_window"),
  );
  if (openCalls.length < 1) {
    throw new Error("Expected desktop_open_profile_window when opening an unused profile slot");
  }
  log("PASS mocked shell — unused profile slot requests openProfileWindow");
}

async function runCdpChecks(page) {
  await page.goto(`${appBase}/profiles`, { waitUntil: "domcontentloaded" }).catch(() => undefined);
  const onProfiles = await page.getByText(/Who's using Obscur\?/i).isVisible().catch(() => false);
  if (!onProfiles) {
    log("CDP: not on profile picker — navigating to /profiles");
    await page.goto(`${appBase}/profiles`, { waitUntil: "domcontentloaded" });
  }
  await page.waitForSelector("text=Who's using Obscur?", { timeout: 60_000 });

  const testerCard = page.locator("button").filter({ hasText: /Tester1/i }).first();
  if (await testerCard.isVisible().catch(() => false)) {
    await testerCard.click();
    await assertNoProfilesRedirectLoop(page);
    log("PASS CDP — Tester1 click reaches /sign-in without redirect loop");

    const passwordVisible = await page.locator('input[type="password"]').first().isVisible().catch(() => false);
    if (passwordVisible) {
      log("CDP — unlocking Tester1 via auth UI");
      await ensureTester1Unlocked(page, { log, timeoutMs: 120_000 });
      await page.waitForTimeout(3000);
      if (!(await isShellUnlocked(page))) {
        throw new Error("Tester1 unlock failed on live Tauri shell");
      }
      log("PASS CDP — Tester1 unlocked successfully");
    } else {
      log("CDP — sign-in surface visible (password field not detected; may need import-key path)");
    }
    return;
  }

  log("CDP — Tester1 card not visible; attempting dev-lab unlock then re-check");
  await page.evaluate(async () => {
    await window.obscurDevLab?.unlock?.("tester1");
  }).catch(() => undefined);
  await page.waitForTimeout(5000);
  if (await isShellUnlocked(page)) {
    log("PASS CDP — shell already unlocked via dev-lab");
    return;
  }
  throw new Error("Could not find Tester1 on profile picker and dev-lab unlock did not succeed");
}

async function main() {
  const { chromium } = await loadPlaywright();
  let staticServerProc = null;
  let browser = null;
  let passed = 0;
  let failed = 0;

  try {
    if (explicitCdp || (await fetch("http://127.0.0.1:9222/json/version", { signal: AbortSignal.timeout(2000) }).then((r) => r.ok).catch(() => false))) {
      const cdpUrl = explicitCdp || "http://127.0.0.1:9222";
      log(`using live Tauri CDP at ${cdpUrl}`);
      browser = await chromium.connectOverCDP(cdpUrl);
      const page = await pickAppPageFromBrowser(browser, appBase);
      if (!page) {
        throw new Error(`No Obscur page on CDP ${cdpUrl}. Launch with WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS=--remote-debugging-port=9222`);
      }
      await runCdpChecks(page);
      passed += 1;
    } else {
      log("CDP unavailable — running mocked static-shell checks");
      const connection = await resolveDevLabConnection({
        repoRoot,
        appBase,
        explicitCdpUrl: null,
        requireOnlineShell: false,
        log,
      });
      staticServerProc = connection.staticServerProc ?? null;
      browser = await chromium.launch({ headless: true });
      const context = await browser.newContext({
        baseURL: connection.baseUrl,
        viewport: { width: 1280, height: 720 },
      });
      await context.addInitScript(buildTauriMockInitScript());
      const page = await context.newPage();
      await runMockedShellChecks(page);
      passed += 1;
    }
  } catch (error) {
    failed += 1;
    console.error(`[profile-picker-verify] FAIL ${error instanceof Error ? error.message : String(error)}`);
    process.exitCode = 1;
  } finally {
    if (browser) {
      await browser.close().catch(() => undefined);
    }
    stopStaticShellServer(staticServerProc);
  }

  log(`done — ${passed} passed, ${failed} failed`);
  if (failed === 0 && !explicitCdp) {
    log("Note: live Tauri window focus was not exercised (CDP off). For full native proof:");
    log('  set WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS=--remote-debugging-port=9222');
    log("  restart pnpm dev:desktop:online -- --rebuild");
    log("  node scripts/verify-profile-picker-flow.mjs --cdp http://127.0.0.1:9222");
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
