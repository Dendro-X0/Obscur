#!/usr/bin/env node
/**
 * E2 desktop L3-lite — dead public primary must dial a standby (or local writable).
 *
 * Prerequisites: pnpm dev:desktop:online(:live) · CDP :9230 · optional :7000
 *
 *   node scripts/e2-public-dial-l3-desktop.mjs
 *   pnpm verify:e2-public-dial-l3
 */
import { createRequire } from "node:module";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  formatNoObscurPageError,
  waitForAppPageFromBrowser,
} from "./lib/cdp-app-page.mjs";
import {
  applyDevOperatorBundle,
  ensureTester1Unlocked,
  TESTER1,
} from "./lib/dev-lab-playwright-auth.mjs";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const pwaDir = path.join(repoRoot, "apps", "pwa");
const requireFromPwa = createRequire(path.join(pwaDir, "package.json"));
const CDP = process.env.OBSCUR_CDP_URL ?? "http://127.0.0.1:9230";
const APP_BASE = process.env.PLAYWRIGHT_BASE_URL ?? "http://127.0.0.1:3340";
const reportPath = path.join(repoRoot, "test-results", "e2-public-dial-l3-2026-07-31.json");

function loadPlaywright() {
  try {
    return requireFromPwa("playwright");
  } catch {
    return requireFromPwa("@playwright/test");
  }
}

const log = (message) => console.log(`[e2-l3] ${message}`);

async function isShell(page) {
  for (const label of ["Settings", "Network", "Search", "Chats"]) {
    if (await page.getByRole("link", { name: label, exact: true }).isVisible().catch(() => false)) {
      return true;
    }
  }
  return page.getByRole("link", { name: /^chats$/i }).isVisible().catch(() => false);
}

async function openDefaultProfileSlot(page) {
  if (!/\/profiles/i.test(page.url())) {
    return;
  }
  // First profile-slot button often opens the current window identity.
  const slot = page.getByRole("button").nth(0);
  if (await slot.isVisible().catch(() => false)) {
    await slot.click().catch(() => undefined);
    await page.waitForTimeout(2_000);
  }
}

/**
 * Fresh live profiles often keep a leftover Log-In password in React state.
 * Tester1's 10-char password fails the 12-char passphrase policy, so Import
 * Continue returns early with authError and looks like a no-op.
 */
async function prepareImportKeyForm(page) {
  return page.evaluate((hex) => {
    const keyEl = document.querySelector('input[placeholder="nsec1..."]');
    if (!keyEl) {
      return { ok: false, reason: "no_key_input" };
    }
    const propsKey = Object.keys(keyEl).find((k) => k.startsWith("__reactProps"));
    if (propsKey && typeof keyEl[propsKey]?.onChange === "function") {
      keyEl[propsKey].onChange({ target: { value: hex }, currentTarget: { value: hex } });
    }

    const continueBtn = [...document.querySelectorAll("button")].find((b) => (
      /^Continue$/i.test((b.innerText || "").trim())
    ));
    if (!continueBtn) {
      return { ok: false, reason: "no_continue" };
    }
    let fiber = continueBtn[Object.keys(continueBtn).find((k) => k.startsWith("__reactFiber"))];
    while (fiber && fiber.elementType?.name !== "AuthScreen") {
      fiber = fiber.return;
    }
    if (!fiber) {
      return { ok: true, clearedPassword: false, reason: "no_auth_screen_fiber" };
    }

    let hook = fiber.memoizedState;
    let idx = 0;
    let clearedPassword = false;
    while (hook && idx < 100) {
      const value = hook.memoizedState;
      const dispatch = hook.queue?.dispatch;
      if (typeof dispatch === "function" && typeof value === "string") {
        const isPolicyError = value.startsWith("Use at least 12 characters");
        const isShortPassword = value.length > 0 && value.length < 64 && idx >= 70 && idx <= 76;
        if (isPolicyError || isShortPassword) {
          dispatch(isPolicyError ? null : "");
          if (isShortPassword) clearedPassword = true;
        }
      }
      hook = hook.next;
      idx += 1;
    }
    return { ok: true, clearedPassword };
  }, TESTER1.privateKeyHex);
}

async function importTester1IfNeeded(page) {
  if (await isShell(page)) {
    return;
  }
  const importBtn = page.getByRole("button", { name: /^Import Key$/i });
  if (!(await importBtn.isVisible().catch(() => false))) {
    return;
  }
  log("Import Key — fresh device needs private-key bootstrap");
  await importBtn.click();
  await page.waitForTimeout(600);

  const keyInput = page.getByPlaceholder(/nsec/i).first();
  if (!(await keyInput.isVisible().catch(() => false))) {
    return;
  }

  const prepared = await prepareImportKeyForm(page);
  log(`Import form prepared clearedPassword=${Boolean(prepared?.clearedPassword)}`);
  await page.waitForTimeout(300);

  const clearContinue = page.getByRole("button", { name: /Clear this window and continue/i });
  if (await clearContinue.isVisible().catch(() => false)) {
    await clearContinue.click();
    await page.waitForTimeout(1_500);
    const importAgain = page.getByRole("button", { name: /^Import Key$/i });
    if (await importAgain.isVisible().catch(() => false)) {
      await importAgain.click();
      await page.waitForTimeout(500);
      await prepareImportKeyForm(page);
      await page.waitForTimeout(300);
    }
  }

  // Do NOT click top "Log In" — Import submit is labeled Continue.
  const continueBtn = page.getByRole("button", { name: /^Continue$/i }).first();
  if (await continueBtn.isVisible().catch(() => false)) {
    await continueBtn.click({ force: true });
  }

  const deadline = Date.now() + 60_000;
  while (Date.now() < deadline) {
    if (await isShell(page)) {
      return;
    }
    const clear2 = page.getByRole("button", { name: /Clear this window and continue/i });
    if (await clear2.isVisible().catch(() => false)) {
      await clear2.click();
      await page.waitForTimeout(1_000);
    }
    // If policy error reappears, clear leftover password and retry Continue once.
    const policyError = page.getByText(/Use at least 12 characters/i);
    if (await policyError.isVisible().catch(() => false)) {
      await prepareImportKeyForm(page);
      if (await continueBtn.isVisible().catch(() => false)) {
        await continueBtn.click({ force: true });
      }
    }
    await page.waitForTimeout(500);
  }
}

async function ensureUnlockedShell(page) {
  if (await isShell(page)) {
    return;
  }
  await openDefaultProfileSlot(page);
  await applyDevOperatorBundle(page).catch(() => undefined);
  await importTester1IfNeeded(page);
  if (await isShell(page)) {
    return;
  }
  try {
    await ensureTester1Unlocked(page, { log, timeoutMs: 45_000 });
  } catch {
    await importTester1IfNeeded(page);
  }
  if (!(await isShell(page))) {
    throw new Error(`Timed out waiting for unlocked shell (url=${page.url()})`);
  }
}

async function readProbe(page) {
  return page.evaluate(() => {
    const runtime = window.obscurRelayRuntime?.getSnapshot?.() ?? null;
    const body = document.body?.innerText ?? "";
    return {
      runtime,
      bodyHasNos: /nos\.lol/i.test(body),
      bodyHasDamus: /damus\.io/i.test(body),
      bodyHasLocal: /localhost:7000|127\.0\.0\.1:7000/i.test(body),
      zeroWritable: /0 writable/i.test(body),
      offlineBanner: /transport is offline/i.test(body),
      notInActivePool: /not in the active transport pool/i.test(body),
      href: location.href,
    };
  });
}

async function main() {
  const { chromium } = loadPlaywright();
  let browser;
  try {
    browser = await chromium.connectOverCDP(CDP);
  } catch (error) {
    throw new Error(
      `CDP connect failed at ${CDP}: ${error instanceof Error ? error.message : error}. `
      + "Start: pnpm dev:desktop:online:live",
    );
  }

  const page = await waitForAppPageFromBrowser(browser, {
    appBase: APP_BASE,
    timeoutMs: 60_000,
  });
  if (!page) {
    throw new Error(formatNoObscurPageError(browser, CDP));
  }

  log(`Attached ${page.url()}`);
  // Do not force navigation away from sign-in/profiles — unlock in place.
  await ensureUnlockedShell(page);
  log(`Unlocked shell at ${page.url()}`);

  // Prefer Network/Relays surface for role copy.
  const settings = page.getByRole("link", { name: /settings/i }).first();
  if (await settings.isVisible().catch(() => false)) {
    await settings.click().catch(() => undefined);
    await page.waitForTimeout(800);
  }
  const network = page.getByRole("link", { name: /network|relays/i }).first();
  if (await network.isVisible().catch(() => false)) {
    await network.click().catch(() => undefined);
    await page.waitForTimeout(1_500);
  }

  let probe = await readProbe(page);
  const deadline = Date.now() + 75_000;
  while (Date.now() < deadline) {
    const writable = Number(
      probe.runtime?.writableRelayCount
      ?? probe.runtime?.recovery?.writableRelayCount
      ?? 0,
    );
    if (writable >= 1 && !probe.zeroWritable) {
      break;
    }
    const retry = page.getByRole("button", { name: /^retry$/i }).first();
    if (await retry.isVisible().catch(() => false)) {
      await retry.click().catch(() => undefined);
    }
    await page.waitForTimeout(3_000);
    probe = await readProbe(page);
  }

  const runtime = probe.runtime ?? {};
  const writable = Number(runtime.writableRelayCount ?? runtime.recovery?.writableRelayCount ?? 0);
  const enabled = Array.isArray(runtime.enabledRelayUrls) ? runtime.enabledRelayUrls : [];
  const hasNos = enabled.some((url) => /nos\.lol/i.test(url));
  const hasLocal = enabled.some((url) => /localhost:7000|127\.0\.0\.1:7000/i.test(url));
  const readiness = runtime.recovery?.readiness ?? runtime.phase ?? "unknown";

  // Pass if transport is writable (local and/or public). Fail hard only when still offline
  // with enabled standbys that should have been dialed after E2.
  const pass = Boolean(probe.runtime) && writable >= 1 && !probe.zeroWritable;

  const report = {
    generatedAtUnixMs: Date.now(),
    version: "obscur.e2-public-dial-l3.v1",
    cdp: CDP,
    pageUrl: probe.href,
    l3: {
      pass,
      writableRelayCount: writable,
      readiness,
      enabledRelayUrls: enabled,
      hasNos,
      hasLocal,
      offlineBanner: probe.offlineBanner,
      zeroWritable: probe.zeroWritable,
      notInActivePoolCopyPresent: probe.notInActivePool,
      claim: pass
        ? "E2 desktop L3-lite Pass — writable≥1 after dial-pad/local path; not a blanket public Nostr fix"
        : "E2 desktop L3-lite Fail — reload shell with E2 modules; Apply Default Stable / set nos primary",
    },
    runtimePhase: runtime.phase,
  };

  fs.mkdirSync(path.dirname(reportPath), { recursive: true });
  fs.writeFileSync(reportPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");
  log(`Report: ${reportPath}`);
  log(`pass=${pass} writable=${writable} readiness=${readiness} hasNos=${hasNos} hasLocal=${hasLocal}`);

  await browser.close().catch(() => undefined);
  if (!pass) process.exit(1);
}

main().catch((error) => {
  log(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
