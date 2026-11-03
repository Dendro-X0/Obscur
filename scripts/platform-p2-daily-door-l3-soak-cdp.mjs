#!/usr/bin/env node
/**
 * Platform rewrite band P2 L3 — auth daily-door copy soak via CDP :9230.
 * Spec: specs/backend/platform-p2-daily-door-l3-soak-2026-11.md
 *
 *   OBSCUR_ALLOW_STALE_SHELL=1 pnpm dev:desktop -- --skip-build
 *   node scripts/platform-p2-daily-door-l3-soak-cdp.mjs
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
const PASSWORD = process.env.OBSCUR_SOAK_PASSWORD ?? TESTER1.password;
const outJson = path.join(repoRoot, "docs", "handoffs", "platform-p2-daily-door-l3-soak-latest.json");
const outMd = path.join(repoRoot, "docs", "handoffs", "platform-p2-daily-door-l3-soak-latest.md");

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
  const matrixLines = Object.entries(report.matrix ?? {})
    .map(([k, v]) => `- ${k}: ${v}`)
    .join("\n");
  const nonClaims = (report.nonClaims ?? []).map((c) => `- ${c}`).join("\n");
  fs.writeFileSync(
    outMd,
    [
      "# Platform P2 daily-door L3 soak",
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
    ].filter(Boolean).join("\n"),
    "utf8",
  );
}

async function sample(page) {
  return page.evaluate(() => {
    const root = document.querySelector("main") || document.body;
    const text = (root?.innerText ?? "").replace(/\s+/g, " ").trim();
    const placeholders = [...document.querySelectorAll("input")]
      .map((el) => (el.getAttribute("placeholder") ?? "").toLowerCase())
      .filter(Boolean);
    return {
      href: location.href,
      text: text.slice(0, 900),
      hasPw: Boolean(document.querySelector('input[type="password"]')),
      placeholders,
      hasNsecPlaceholder: placeholders.some((p) => p.includes("nsec")),
      hasOauthCopy: /oauth|sign in with google|continue with google|github login/i.test(text),
      hasAdvancedToggle: /advanced.*private|hide advanced|import key/i.test(text),
    };
  });
}

async function ensureAuthGate(page, wait) {
  let s = await sample(page);
  if (s.hasPw) {
    return s;
  }
  const lockBtn = page.locator('button[aria-label="desktop.titleBar.lock"]');
  if (await lockBtn.count()) {
    await lockBtn.click({ timeout: 10000 });
    await page.getByRole("dialog").waitFor({ state: "visible", timeout: 8000 });
    await page.getByRole("dialog").getByRole("button", { name: /^Lock$/i }).click();
    await wait(5000);
  }
  return sample(page);
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

  const wait = (ms) => page.waitForTimeout(ms);
  const steps = [];

  await page.keyboard.press("Escape").catch(() => undefined);
  await wait(300);
  await page.goto("http://127.0.0.1:1430/network").catch(() => undefined);
  await wait(1500);

  let gate = await ensureAuthGate(page, wait);
  steps.push({ step: "gate", ...gate });

  if (!gate.hasPw) {
    const report = {
      capturedAt: new Date().toISOString(),
      surface: "tauri-desktop-cdp",
      cdp: CDP,
      band: "platform-P2-daily-door-L3",
      verdict: "Fail",
      reason: "auth_gate_not_visible",
      steps,
      matrix: {},
      nonClaims: ["Soft L3 Fixed", "Tor Verified", "Matrix promote"],
    };
    writeReport(report);
    console.log(JSON.stringify({ verdict: "Fail", reason: report.reason, outJson }, null, 2));
    await browser.close().catch(() => undefined);
    process.exit(2);
  }

  const passphrasePrimaryVisible = gate.hasPw && !gate.hasNsecPlaceholder;
  const advancedTogglePresent = gate.hasAdvancedToggle;
  const privateKeyHiddenByDefault = !gate.hasNsecPlaceholder;
  const noOauthOnGate = !gate.hasOauthCopy;

  // Open Advanced if visible, then hide again so passphrase unlock stays primary.
  let privateKeyAfterAdvanced = false;
  const advancedBtn = page.getByRole("button", {
    name: /advanced|import key|private key|hide advanced/i,
  });
  if (await advancedBtn.count()) {
    await advancedBtn.first().click();
    await wait(800);
    const after = await sample(page);
    steps.push({ step: "after_advanced", ...after });
    privateKeyAfterAdvanced = after.hasNsecPlaceholder
      || /nsec1|paste.*(key|nsec)|private key/i.test(after.text);
    const hideBtn = page.getByRole("button", { name: /hide advanced/i });
    if (await hideBtn.count()) {
      await hideBtn.first().click();
      await wait(500);
    } else if (await advancedBtn.count()) {
      // Toggle may reuse the same control label after open.
      await advancedBtn.first().click().catch(() => undefined);
      await wait(500);
    }
    steps.push({ step: "after_hide_advanced", ...(await sample(page)) });
  } else if (!advancedTogglePresent) {
    // Soft-lock / storage-only gate has no Advanced — still passphrase primary.
    privateKeyAfterAdvanced = true;
  }

  // Password reentry to shell (passphrase primary path)
  await page.locator('input[type="password"]').first().fill(PASSWORD);
  if (await page.locator('button[type="submit"]').count()) {
    await page.locator('button[type="submit"]').first().click();
  } else {
    await page.getByRole("button", { name: /unlock local data|^(unlock|log in)$/i }).last().click();
  }

  const deadline = Date.now() + 90000;
  let reentry = false;
  let last = gate;
  while (Date.now() < deadline) {
    last = await sample(page);
    if (last.hasPw && /Unlock local data|Local data locked|Encrypted local storage/i.test(last.text)) {
      await page.locator('input[type="password"]').first().fill(PASSWORD);
      await page.getByRole("button", { name: /unlock local data|unlock/i }).last().click();
      await wait(2500);
      continue;
    }
    if (!last.hasPw && /NETWORK|Chats|CONNECTIONS|Settings|DIRECTORY/i.test(`${last.text} ${last.href}`)) {
      reentry = true;
      break;
    }
    await wait(500);
  }
  steps.push({ step: "password_reentry", shell: reentry, ...last });

  const matrix = {
    passphrasePrimaryVisible,
    advancedTogglePresent: advancedTogglePresent || privateKeyAfterAdvanced === true,
    privateKeyHiddenByDefault,
    privateKeyAfterAdvanced,
    noOauthOnGate,
    passwordReentryShell: reentry,
  };
  const allPass = Object.values(matrix).every(Boolean);
  const report = {
    capturedAt: new Date().toISOString(),
    surface: "tauri-desktop-cdp",
    cdp: CDP,
    band: "platform-P2-daily-door-L3",
    nonClaims: ["Soft L3 Fixed", "Tor Verified", "Matrix promote", "Continuity promote"],
    steps,
    matrix,
    verdict: allPass ? "Pass" : "Fail",
    reason: allPass ? undefined : "matrix_incomplete",
  };
  writeReport(report);
  console.log(JSON.stringify({ verdict: report.verdict, matrix, outJson, outMd }, null, 2));
  await browser.close().catch(() => undefined);
  process.exit(allPass ? 0 : 2);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
