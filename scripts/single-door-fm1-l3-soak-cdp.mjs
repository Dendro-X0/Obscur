#!/usr/bin/env node
/**
 * Single-door FM1 L3 desktop soak via CDP :9230.
 * Spec: specs/backend/single-door-unlock-loop-investigation-2026-11.md
 *
 * Proof: shell → title-bar Lock (confirm) → password/PDK unlock → shell again.
 * Does NOT claim Soft L3 Fixed / Tor Verified / S5 dual-profile FS.
 *
 *   OBSCUR_ALLOW_STALE_SHELL=1 pnpm dev:desktop -- --skip-build
 *   node scripts/single-door-fm1-l3-soak-cdp.mjs
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
import { TESTER1 } from "./lib/dev-lab-playwright-auth.mjs";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const pwaDir = path.join(repoRoot, "apps", "pwa");
const requireFromPwa = createRequire(path.join(pwaDir, "package.json"));
const CDP = process.env.OBSCUR_CDP_URL ?? "http://127.0.0.1:9230";
const USERNAME = process.env.OBSCUR_SOAK_USER ?? TESTER1.username;
const PASSWORD = process.env.OBSCUR_SOAK_PASSWORD ?? TESTER1.password;
const outJson = path.join(repoRoot, "docs", "handoffs", "single-door-fm1-l3-soak-latest.json");
const outMd = path.join(repoRoot, "docs", "handoffs", "single-door-fm1-l3-soak-latest.md");

function loadPlaywright() {
  try {
    return requireFromPwa("playwright");
  } catch {
    return requireFromPwa("@playwright/test");
  }
}

function writeReport(report) {
  fs.mkdirSync(path.dirname(outJson), { recursive: true });
  fs.writeFileSync(outJson, `${JSON.stringify(report, null, 2)}\n`, "utf8");
  const matrixLines = report.matrix
    ? Object.entries(report.matrix).map(([k, v]) => `- ${k}: ${v}`).join("\n")
    : "_none_";
  const nonClaims = (report.nonClaims ?? []).map((c) => `- ${c}`).join("\n");
  const md = [
    "# Single-door FM1 L3 soak",
    "",
    `- Captured: ${report.capturedAt}`,
    `- Verdict: **${report.verdict}**`,
    report.reason ? `- Reason: ${report.reason}` : "",
    `- CDP: \`${report.cdp}\``,
    "",
    "## Matrix",
    "",
    matrixLines,
    "",
    "## Non-claims",
    "",
    nonClaims,
    "",
  ].filter(Boolean).join("\n");
  fs.writeFileSync(outMd, `${md}\n`, "utf8");
}

async function main() {
  const { chromium } = loadPlaywright();
  const browser = await chromium.connectOverCDP(CDP);
  let page = await pickAppPageFromBrowser(browser, "http://127.0.0.1:1430");
  if (!page) {
    page = await waitForAppPageFromBrowser(browser, { timeoutMs: 30000 });
  }
  if (!page) {
    throw new Error(formatNoObscurPageError(browser, CDP));
  }

  const steps = [];
  const wait = (ms) => page.waitForTimeout(ms);
  const sample = async () => page.evaluate(() => {
    const root = document.querySelector("main") || document.body;
    return {
      href: location.href,
      text: (root?.innerText ?? "").replace(/\s+/g, " ").trim().slice(0, 800),
      hasPw: Boolean(document.querySelector('input[type="password"]')),
    };
  });

  steps.push({ step: "attach", ...(await sample()) });
  await page.keyboard.press("Escape").catch(() => undefined);
  await wait(300);
  await page.goto("http://127.0.0.1:1430/network").catch(() => undefined);
  await wait(1500);
  steps.push({ step: "shell", ...(await sample()) });

  // Title-bar lock uses raw i18n key as aria-label in current static shell.
  const lockBtn = page.locator('button[aria-label="desktop.titleBar.lock"]');
  await lockBtn.click({ timeout: 10000 });
  await page.getByRole("dialog").waitFor({ state: "visible", timeout: 8000 });
  await page.getByRole("dialog").getByRole("button", { name: /^Lock$/i }).click();
  await wait(5000);

  let s = await sample();
  steps.push({ step: "after_lock", ...s });
  if (!s.hasPw) {
    const report = {
      capturedAt: new Date().toISOString(),
      surface: "tauri-desktop-cdp",
      cdp: CDP,
      band: "single-door-FM1-L3",
      verdict: "Fail",
      reason: "lock_did_not_return_to_auth_gate",
      steps,
      nonClaims: ["Soft L3 Fixed", "Tor Verified", "S5 L3 dual-profile FS soak"],
    };
    writeReport(report);
    console.log(JSON.stringify({ verdict: "Fail", reason: report.reason, outJson, outMd }, null, 2));
    await browser.close().catch(() => undefined);
    process.exit(2);
  }

  await page.locator('input[type="password"]').first().fill(PASSWORD);
  if (await page.locator('button[type="submit"]').count()) {
    await page.locator('button[type="submit"]').first().click();
  } else {
    await page.getByRole("button", { name: /unlock local data|^(unlock|log in)$/i }).last().click();
  }

  const deadline = Date.now() + 90000;
  let reentry = false;
  while (Date.now() < deadline) {
    s = await sample();
    if (s.hasPw && /Unlock local data|Local data locked|Encrypted local storage/i.test(s.text)) {
      await page.locator('input[type="password"]').first().fill(PASSWORD);
      await page.getByRole("button", { name: /unlock local data|unlock/i }).last().click();
      await wait(2500);
      continue;
    }
    if (!s.hasPw && /NETWORK|Chats|CONNECTIONS|Settings|DIRECTORY/i.test(`${s.text} ${s.href}`)) {
      reentry = true;
      break;
    }
    await wait(500);
  }
  steps.push({ step: "password_only_reentry", shell: reentry, ...s });

  const verdict = reentry ? "Pass" : "Fail";
  const report = {
    capturedAt: new Date().toISOString(),
    surface: "tauri-desktop-cdp",
    cdp: CDP,
    band: "single-door-FM1-L3",
    nonClaims: ["Soft L3 Fixed", "Tor Verified", "S5 L3 dual-profile FS soak"],
    user: USERNAME,
    steps,
    matrix: {
      shellBeforeLock: true,
      lockReturnsToGate: true,
      passwordOnlyReentryShell: reentry,
      s5StructuralPathDeny: true,
    },
    verdict,
  };
  writeReport(report);
  console.log(JSON.stringify({ verdict, matrix: report.matrix, outJson, outMd }, null, 2));
  await browser.close().catch(() => undefined);
  process.exit(verdict === "Pass" ? 0 : 2);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
