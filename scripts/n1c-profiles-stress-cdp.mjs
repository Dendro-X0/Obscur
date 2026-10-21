#!/usr/bin/env node
/**
 * N1c profiles stress via CDP :9230 — stays on /profiles (does not leave picker).
 * Leaving /profiles while unlocked intentionally mounts messaging; that is out of scope.
 *
 * Spec: specs/backend/desktop-shell-n1c-stress-plan-2026-10.md
 *
 *   node scripts/n1c-profiles-stress-cdp.mjs
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

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const pwaDir = path.join(repoRoot, "apps", "pwa");
const requireFromPwa = createRequire(path.join(pwaDir, "package.json"));

const CDP = process.env.OBSCUR_CDP_URL ?? "http://127.0.0.1:9230";
const IDLE_MS = Number(process.env.N1C_STRESS_IDLE_MS ?? 120_000);
const CLICK_LOOPS = Number(process.env.N1C_STRESS_CLICK_LOOPS ?? 10);
const FOCUS_LOOPS = Number(process.env.N1C_STRESS_FOCUS_LOOPS ?? 30);
const outPath = path.join(
  repoRoot,
  "docs",
  "handoffs",
  `n1c-profiles-stress-${new Date().toISOString().slice(0, 10)}.json`,
);

function loadPlaywright() {
  try {
    return requireFromPwa("playwright");
  } catch {
    return requireFromPwa("@playwright/test");
  }
}

async function sampleShellMarkers(page) {
  return page.evaluate(() => {
    const text = (document.body?.innerText ?? "").slice(0, 1200);
    const pathname = window.location.pathname;
    const onProfiles = pathname === "/profiles" || pathname.startsWith("/profiles/");
    const pickerCopy = /who'?s using obscur/i.test(text);
    const advancedCopy = /advanced profile management/i.test(text);
    // Messaging chrome while still claiming picker path = N1 regression.
    const messagingOnPicker = onProfiles && /\/(chats|network|settings|vault)/i.test(pathname) === false
      && (document.querySelector("[data-testid='chat-composer'], [data-chrome='main-shell']") != null
        || (/composer|new message/i.test(text) && !pickerCopy && !advancedCopy));
    return {
      pathname,
      onProfiles,
      pickerCopy,
      advancedCopy,
      openingProfilesCopy: /opening profiles/i.test(text),
      messagingOnPicker,
      textSample: text.replace(/\s+/g, " ").trim().slice(0, 280),
    };
  });
}

async function ensureProfiles(page) {
  const markers = await sampleShellMarkers(page);
  if (markers.onProfiles || markers.pickerCopy || markers.openingProfilesCopy) {
    return markers;
  }
  await page.evaluate(() => {
    const nav = window.next?.router;
    if (nav && typeof nav.replace === "function") {
      nav.replace("/profiles");
      return;
    }
    if (nav && typeof nav.push === "function") {
      nav.push("/profiles");
    }
  }).catch(() => {});
  await page.waitForTimeout(1200);
  return sampleShellMarkers(page);
}

async function focusChurn(page, loops) {
  // Soft focus only — do not redefine visibilityState (that forced lease list IPC storms).
  for (let i = 0; i < loops; i += 1) {
    await page.evaluate(() => {
      window.dispatchEvent(new Event("blur"));
      window.dispatchEvent(new Event("focus"));
    });
    await page.waitForTimeout(50);
  }
}

async function clickStress(page, loops) {
  /** @type {Array<Record<string, unknown>>} */
  const results = [];
  for (let i = 0; i < loops; i += 1) {
    // Only toggle Advanced — never click profile cards/menus (those open unlocked windows).
    const advanced = page.getByRole("button", { name: /^advanced profile management$/i });
    if (await advanced.isVisible().catch(() => false)) {
      await advanced.click({ timeout: 3000 }).catch(() => {});
      await page.waitForTimeout(400);
    }
    const backToPicker = page.getByRole("button", { name: /^(back|done)$/i }).first();
    if (await backToPicker.isVisible().catch(() => false)) {
      await backToPicker.click({ timeout: 3000 }).catch(() => {});
      await page.waitForTimeout(300);
    }
    await page.keyboard.press("Escape").catch(() => {});
    await page.evaluate(() => {
      const nav = window.next?.router;
      if (nav && typeof nav.replace === "function") {
        nav.replace("/profiles");
      }
    }).catch(() => {});
    results.push({
      i,
      markers: await sampleShellMarkers(page),
    });
  }
  return results;
}

async function main() {
  const startedAt = new Date().toISOString();
  const { chromium } = loadPlaywright();
  const browser = await chromium.connectOverCDP(CDP);
  let page = await pickAppPageFromBrowser(browser, "http://tauri.localhost");
  if (!page) {
    page = await waitForAppPageFromBrowser(browser, {
      timeoutMs: 30_000,
      appBase: "http://tauri.localhost",
    });
  }
  if (!page) {
    throw new Error(formatNoObscurPageError(browser, CDP));
  }

  page.setDefaultTimeout(8_000);

  const s0 = {
    url: page.url(),
    markers: await sampleShellMarkers(page),
  };

  const ensured = await ensureProfiles(page);
  const afterEnsure = { markers: ensured };

  const idleStarted = Date.now();
  /** @type {Array<Record<string, unknown>>} */
  const idleSamples = [];
  while (Date.now() - idleStarted < IDLE_MS) {
    await page.waitForTimeout(10_000);
    idleSamples.push({
      atMs: Date.now() - idleStarted,
      markers: await sampleShellMarkers(page),
    });
  }

  await focusChurn(page, FOCUS_LOOPS);
  const afterFocus = { markers: await sampleShellMarkers(page) };

  const clickResults = await clickStress(page, CLICK_LOOPS);
  const finalMarkers = await sampleShellMarkers(page);

  const leftProfiles = idleSamples.some((s) => s.markers && s.markers.onProfiles === false)
    || finalMarkers.onProfiles === false;
  const messagingWhileOnPicker = Boolean(finalMarkers.messagingOnPicker)
    || clickResults.some((r) => r.markers?.messagingOnPicker)
    || idleSamples.some((s) => s.markers?.messagingOnPicker);

  const onPickerSurface = finalMarkers.onProfiles
    && (
      finalMarkers.pickerCopy
      || finalMarkers.advancedCopy
      || /manage profiles|back to profile picker/i.test(finalMarkers.textSample ?? "")
    );
  const pass = onPickerSurface && !messagingWhileOnPicker && !leftProfiles;

  const report = {
    startedAt,
    endedAt: new Date().toISOString(),
    cdp: CDP,
    idleMs: IDLE_MS,
    focusLoops: FOCUS_LOOPS,
    clickLoops: CLICK_LOOPS,
    s0,
    afterEnsure,
    idleSamples: idleSamples.slice(-3),
    afterFocus,
    clickResults: clickResults.slice(-3),
    finalMarkers,
    pass,
    failReasons: [
      !finalMarkers.onProfiles ? "final_not_on_profiles" : null,
      !onPickerSurface ? "missing_picker_or_advanced_copy" : null,
      messagingWhileOnPicker ? "messaging_chrome_on_picker" : null,
      leftProfiles ? "left_profiles_during_stress" : null,
    ].filter(Boolean),
    note: "Picker-scoped stress only. CDP-on tax. Pair with CDP-off idle for heap honesty.",
  };

  fs.writeFileSync(outPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");
  console.log(JSON.stringify({
    outPath,
    pass,
    failReasons: report.failReasons,
    finalMarkers,
  }, null, 2));
  if (!pass) {
    process.exitCode = 2;
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
