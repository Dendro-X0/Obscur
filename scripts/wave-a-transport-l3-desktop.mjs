#!/usr/bin/env node
/**
 * Wave A desktop L3-lite — local CONNECTED must not yield false "0 writable".
 *
 * Prerequisites: pnpm dev:desktop:online · CDP :9230 · local :7000
 *
 *   node scripts/wave-a-transport-l3-desktop.mjs
 *   pnpm verify:wave-a-transport-l3
 */
import { createRequire } from "node:module";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  formatNoObscurPageError,
  waitForAppPageFromBrowser,
} from "./lib/cdp-app-page.mjs";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const pwaDir = path.join(repoRoot, "apps", "pwa");
const requireFromPwa = createRequire(path.join(pwaDir, "package.json"));
const CDP = process.env.OBSCUR_CDP_URL ?? "http://127.0.0.1:9230";
const APP_BASE = process.env.PLAYWRIGHT_BASE_URL ?? "http://127.0.0.1:1430";
const USERNAME = process.env.OBSCUR_SOAK_USER ?? "Tester1";
const PASSWORD = process.env.OBSCUR_SOAK_PASSWORD ?? "SyI14^ew1E";
const reportPath = path.join(
  repoRoot,
  "test-results",
  "wave-a-transport-l3-2026-07-31.json",
);

function loadPlaywright() {
  try {
    return requireFromPwa("playwright");
  } catch {
    return requireFromPwa("@playwright/test");
  }
}

const log = (message) => console.log(`[wave-a-l3] ${message}`);

const urlsMatchLocal = (url) => {
  const normalized = String(url ?? "").trim().toLowerCase();
  return (
    normalized.includes("localhost:7000")
    || normalized.includes("127.0.0.1:7000")
  );
};

async function isShell(page) {
  for (const label of ["Settings", "Network", "Search", "Chats"]) {
    if (await page.getByRole("link", { name: label, exact: true }).isVisible().catch(() => false)) {
      return true;
    }
  }
  return page.getByRole("link", { name: /^chats$/i }).isVisible().catch(() => false);
}

async function isGate(page) {
  if (await page.locator('input[type="password"]').first().isVisible().catch(() => false)) {
    return true;
  }
  return page.getByText(/welcome back|enter your password/i).isVisible().catch(() => false);
}

async function unlockTester1(page) {
  const passwordInput = page.locator('input[type="password"]').first();
  await passwordInput.waitFor({ state: "visible", timeout: 20_000 });
  const textInput = page.locator('input:not([type="password"]):not([type="hidden"])').first();
  if (await textInput.isVisible().catch(() => false)) {
    await textInput.click();
    await textInput.fill("");
    await textInput.pressSequentially(USERNAME, { delay: 15 });
  }
  await passwordInput.click();
  await passwordInput.fill("");
  await passwordInput.pressSequentially(PASSWORD, { delay: 15 });
  const unlockBtn = page.getByRole("button", { name: /unlock|sign in|continue/i }).first();
  if (await unlockBtn.isVisible().catch(() => false)) {
    await unlockBtn.click();
  } else {
    await passwordInput.press("Enter");
  }
}

async function ensureUnlockedShell(page) {
  const deadline = Date.now() + 90_000;
  while (Date.now() < deadline) {
    if (await isShell(page)) {
      return;
    }
    if (await isGate(page)) {
      log("Unlocking Tester1…");
      await unlockTester1(page);
      await page.waitForTimeout(2_000);
      continue;
    }
    await page.waitForTimeout(500);
  }
  throw new Error("Timed out waiting for unlocked shell");
}

async function readProbe(page) {
  return page.evaluate(() => {
    const runtime = window.obscurRelayRuntime?.getSnapshot?.() ?? null;
    const bodyText = document.body?.innerText ?? "";
    return {
      runtime,
      zeroWritableBanner: /0 writable/i.test(bodyText),
      offlineBanner: /transport is offline|no writable relay/i.test(bodyText),
      bodyHasLocal: /localhost:7000|127\.0\.0\.1:7000/i.test(bodyText),
      bodyHasConnected: /\bCONNECTED\b/i.test(bodyText),
      href: location.href,
      identityPhase: window.obscurWindowRuntime?.getSnapshot?.()?.phase ?? null,
    };
  });
}

async function main() {
  const { chromium } = loadPlaywright();
  const browser = await chromium.connectOverCDP(CDP);
  const page = await waitForAppPageFromBrowser(browser, {
    appBase: APP_BASE,
    timeoutMs: 30_000,
  });
  if (!page) {
    throw new Error(formatNoObscurPageError(browser, CDP));
  }

  log(`Attached ${page.url()}`);
  // Soft reload picks up Wave A modules without killing CDP.
  await page.reload({ waitUntil: "domcontentloaded" });
  await ensureUnlockedShell(page);
  log("Shell unlocked — polling relay runtime…");

  let probe = await readProbe(page);
  const pollDeadline = Date.now() + 60_000;
  while (Date.now() < pollDeadline) {
    const writable = Number(
      probe.runtime?.writableRelayCount
      ?? probe.runtime?.recovery?.writableRelayCount
      ?? 0,
    );
    const enabled = Array.isArray(probe.runtime?.enabledRelayUrls)
      ? probe.runtime.enabledRelayUrls
      : [];
    const localEnabled = enabled.some(urlsMatchLocal);
    if (writable >= 1 && localEnabled) {
      break;
    }
    // Soft nudge: Retry if present
    const retry = page.getByRole("button", { name: /^retry$/i }).first();
    if (await retry.isVisible().catch(() => false)) {
      await retry.click().catch(() => undefined);
    }
    await page.waitForTimeout(2_500);
    probe = await readProbe(page);
  }

  const runtime = probe.runtime ?? {};
  const writable = Number(runtime.writableRelayCount ?? runtime.recovery?.writableRelayCount ?? 0);
  const readiness = runtime.recovery?.readiness ?? runtime.phase ?? "unknown";
  const enabled = Array.isArray(runtime.enabledRelayUrls) ? runtime.enabledRelayUrls : [];
  const localEnabled = enabled.some(urlsMatchLocal);
  const localConnectedEvidence =
    localEnabled
    && (
      writable >= 1
      || (probe.bodyHasLocal && probe.bodyHasConnected)
    );

  const falseOffline =
    localConnectedEvidence
    && writable === 0
    && (probe.zeroWritableBanner || readiness === "offline" || probe.offlineBanner);

  const pass =
    Boolean(probe.runtime)
    && localEnabled
    && writable >= 1
    && !falseOffline
    && !probe.zeroWritableBanner;

  const report = {
    generatedAtUnixMs: Date.now(),
    version: "obscur.wave-a-transport-l3.v1",
    cdp: CDP,
    pageUrl: probe.href,
    identityPhase: probe.identityPhase,
    l3: {
      pass,
      localEnabled,
      localConnectedEvidence,
      writableRelayCount: writable,
      readiness,
      zeroWritableBanner: probe.zeroWritableBanner,
      offlineBanner: probe.offlineBanner,
      falseOffline,
      enabledRelayUrls: enabled,
      claim: pass
        ? "Wave A desktop L3-lite Pass — local/live writable counted; not a public Nostr fix"
        : "Wave A desktop L3-lite Fail — see details",
    },
    runtimePhase: runtime.phase,
    recoveryReadiness: runtime.recovery?.readiness,
  };

  fs.mkdirSync(path.dirname(reportPath), { recursive: true });
  fs.writeFileSync(reportPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");
  log(`Report: ${reportPath}`);
  log(
    `pass=${pass} writable=${writable} readiness=${readiness} localEnabled=${localEnabled} falseOffline=${falseOffline}`,
  );

  await browser.close().catch(() => undefined);
  if (!pass) {
    process.exit(1);
  }
}

main().catch((error) => {
  log(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
