#!/usr/bin/env node
/**
 * Two-window MCP smoke — Tester1 on main, Tester2 on profile-2 only.
 * Does NOT open a third window (no "New profile", no extra "Needs setup" slots).
 *
 * Prerequisites:
 *   export WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS="--remote-debugging-port=9230"
 *   pnpm dev:desktop:online   (or no-coord)
 *
 *   node scripts/verify-two-window-mcp.mjs
 *   node scripts/verify-two-window-mcp.mjs --cdp http://127.0.0.1:9230
 */
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import path from "node:path";
import {
  formatNoObscurPageError,
  listCdpPageUrls,
  pickAppPageFromBrowser,
  probeCdpObscurPage,
} from "./lib/cdp-app-page.mjs";
import {
  applyDevOperatorBundle,
  ensureDevLabAccountUnlocked,
  ensureTester1Unlocked,
  isShellUnlocked,
} from "./lib/dev-lab-playwright-auth.mjs";

const require = createRequire(import.meta.url);
const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

const loadPlaywright = async () => {
  const pwaRoot = path.join(repoRoot, "apps", "pwa");
  const requireFromPwa = createRequire(path.join(pwaRoot, "package.json"));
  try {
    return requireFromPwa("playwright");
  } catch {
    return requireFromPwa("@playwright/test");
  }
};

const cdpUrl = process.argv.includes("--cdp")
  ? process.argv[process.argv.indexOf("--cdp") + 1]
  : "http://127.0.0.1:9230";

const log = (msg) => console.log(`[two-window-mcp] ${msg}`);
const fail = (msg) => {
  console.error(`[two-window-mcp] FAIL: ${msg}`);
  process.exit(1);
};

const countObscurCdpPages = (browser) => {
  let count = 0;
  for (const context of browser.contexts()) {
    for (const page of context.pages()) {
      const url = page.url();
      if (
        url.includes("tauri.localhost")
        || url.startsWith("tauri://")
        || url.includes("asset.localhost")
        || url.includes("127.0.0.1:1430")
        || url.includes("localhost:1430")
        || url.includes("127.0.0.1:3340")
      ) {
        count += 1;
      }
    }
  }
  return count;
};

const signInOnPage = async (page, accountId) => {
  await applyDevOperatorBundle(page);
  await ensureDevLabAccountUnlocked(page, accountId, { log, timeoutMs: 120_000 });
};

const run = async () => {
  const hasCdp = await probeCdpObscurPage(cdpUrl, 5000);
  if (!hasCdp) {
    fail(
      `No Obscur page on ${cdpUrl}. Restart desktop with:\n`
      + '  export WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS="--remote-debugging-port=9230"\n'
      + "  pnpm dev:desktop:online",
    );
  }

  const { chromium } = await loadPlaywright();
  const browser = await chromium.connectOverCDP(cdpUrl);
  const mainPage = await pickAppPageFromBrowser(browser);
  if (!mainPage) {
    fail(formatNoObscurPageError(browser, cdpUrl));
  }

  log("Step 1: Tester1 on main window");
  await applyDevOperatorBundle(mainPage);
  await ensureTester1Unlocked(mainPage);
  if (!(await isShellUnlocked(mainPage))) {
    fail("Tester1 not unlocked on main");
  }
  log("  Tester1 shell OK (Chats visible)");

  const pagesBefore = countObscurCdpPages(browser);
  log(`  CDP Obscur pages before second window: ${pagesBefore}`);

  log("Step 2: Open profile-2 window only (second slot — not New profile)");
  await mainPage.goto("http://127.0.0.1:1430/profiles", { waitUntil: "domcontentloaded" }).catch(() => {});
  await mainPage.waitForTimeout(3000);

  const pickerVisible = await mainPage.getByText(/Who's using Obscur\?/i).isVisible().catch(() => false);
  if (!pickerVisible) {
    log("  Locking main window to reach profile picker…");
    await mainPage.evaluate(async () => {
      await window.__TAURI_INTERNALS__?.invoke?.("desktop_lock_session");
    }).catch(() => {});
    await mainPage.waitForTimeout(2000);
    await mainPage.goto("http://127.0.0.1:1430/profiles", { waitUntil: "domcontentloaded" }).catch(() => {});
    await mainPage.waitForTimeout(2000);
  }

  const profileCards = mainPage.locator("div.relative.w-\\[10\\.5rem\\] button").filter({
    hasNotText: /New profile|Add/i,
  });
  const cardCount = await profileCards.count();
  if (cardCount < 2) {
    fail(`Expected at least 2 profile slot cards, found ${cardCount}. Create profile-2 in Advanced management first.`);
  }

  const secondCard = profileCards.nth(1);
  const cardLabel = await secondCard.innerText().catch(() => "?");
  log(`  Clicking second slot card: ${cardLabel.split("\n")[0]?.trim() ?? "?"}`);
  await secondCard.click();
  await mainPage.waitForTimeout(8000);

  const pagesAfterOpen = countObscurCdpPages(browser);
  log(`  CDP Obscur pages after open: ${pagesAfterOpen}`);
  log(`  All CDP URLs: ${listCdpPageUrls(browser).join(" | ") || "(none)"}`);

  if (pagesAfterOpen <= pagesBefore) {
    log("  NOTE: Secondary Tauri window not exposed on CDP (known WebView2 limitation).");
    log("  Verify Tester2 window manually — automation continues on main CDP target only.");
  }

  const secondPage = pagesAfterOpen > pagesBefore
    ? (await pickAppPageFromBrowser(browser, mainPage.url()))
    : null;

  if (secondPage && secondPage !== mainPage) {
    log("Step 3: Tester2 on second CDP page");
    await signInOnPage(secondPage, "tester2");
    log("  Tester2 shell OK on second CDP page");
  } else {
    log("Step 3: Skipped CDP sign-in on window 2 (single CDP target — sign in Tester2 manually in that window)");
  }

  log("Step 4: Guard — must not exceed 2 Obscur windows worth of CDP targets");
  const finalPages = countObscurCdpPages(browser);
  if (finalPages > 2) {
    fail(`Too many CDP Obscur pages (${finalPages}) — close extra windows`);
  }

  log("PASS: Two-window MCP smoke complete (max 2 CDP targets, no third window opened by script)");
  await browser.close().catch(() => {});
};

run().catch((error) => {
  fail(error instanceof Error ? error.message : String(error));
});
