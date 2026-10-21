#!/usr/bin/env node
/**
 * CU-UX-4 CDP probe — attach to running Tauri (port 9230) and capture steward UI readiness.
 * Usage: node scripts/cu-ux-4-steward-cdp-probe.mjs
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const require = createRequire(path.join(repoRoot, "apps", "pwa", "package.json"));
const { chromium } = require("playwright");

const CDP = process.env.OBSCUR_CDP_URL || "http://127.0.0.1:9230";
const outDir = path.join(repoRoot, "docs", "handoffs", "captures");
const outJson = path.join(repoRoot, "docs", "handoffs", "cu-ux-4-steward-cdp-probe-latest.json");

const log = (m) => console.log(`[cu-ux-4-cdp] ${m}`);

const main = async () => {
  fs.mkdirSync(outDir, { recursive: true });
  const browser = await chromium.connectOverCDP(CDP);
  const context = browser.contexts()[0] || (await browser.newContext());
  const page = context.pages().find((p) => p.url().includes("127.0.0.1") || p.url().includes("obscur"))
    || context.pages()[0];
  if (!page) {
    throw new Error("no CDP page");
  }

  const url = page.url();
  log(`attached url=${url}`);

  const unlocked = await page.getByRole("link", { name: "Settings", exact: true }).isVisible().catch(() => false)
    || await page.getByRole("link", { name: "Chats", exact: true }).isVisible().catch(() => false);
  const authGate = await page.locator('input[type="password"]').first().isVisible().catch(() => false)
    || await page.getByText(/welcome back|enter your password|log in/i).first().isVisible().catch(() => false);

  const shotPath = path.join(outDir, `cu-ux-4-cdp-${Date.now()}.png`);
  await page.screenshot({ path: shotPath, fullPage: true }).catch(() => null);

  let settingsNav = false;
  let createOpen = false;
  let stewardBadge = false;
  let teamTier = false;

  if (unlocked && !authGate) {
    await page.getByRole("link", { name: "Settings", exact: true }).click({ timeout: 5000 }).catch(() => null);
    await page.waitForTimeout(800);
    settingsNav = page.url().includes("/settings");
    // Look for Relays / Operator copy
    const relaysVisible = await page.getByText(/Relays|Team workspace|Operator/i).first().isVisible().catch(() => false);
    log(`settingsNav=${settingsNav} relaysVisible=${relaysVisible}`);

    await page.getByRole("link", { name: "Chats", exact: true }).click({ timeout: 5000 }).catch(() => null);
    await page.waitForTimeout(600);
    // Try open create group if affordance exists
    const createBtn = page.getByRole("button", { name: /create|new (group|community)/i }).first();
    if (await createBtn.isVisible().catch(() => false)) {
      await createBtn.click().catch(() => null);
      await page.waitForTimeout(800);
      createOpen = await page.getByTestId("create-group-dialog-layer").isVisible().catch(() => false)
        || await page.getByTestId("create-group-tier-team").isVisible().catch(() => false);
      if (createOpen) {
        await page.getByTestId("create-group-tier-team").click().catch(() => null);
        await page.waitForTimeout(400);
        teamTier = await page.getByTestId("create-group-tier-team").isVisible().catch(() => false);
      }
    }
    stewardBadge = await page.getByTestId("member-steward-badge").first().isVisible().catch(() => false);
  }

  const report = {
    schema: "cu-ux-4-steward-cdp-probe@1",
    at: new Date().toISOString(),
    cdp: CDP,
    url,
    unlocked,
    authGate,
    settingsNav,
    createOpen,
    teamTier,
    stewardBadge,
    screenshot: path.relative(repoRoot, shotPath).replace(/\\/g, "/"),
    claim: unlocked && !authGate
      ? (createOpen || settingsNav
        ? "CDP attached · shell unlocked · partial UI probe"
        : "CDP attached · shell unlocked · no create dialog found")
      : "CDP attached · auth gate / profiles — unlock required for UI L3",
  };

  fs.writeFileSync(outJson, `${JSON.stringify(report, null, 2)}\n`, "utf8");
  log(report.claim);
  log(`wrote ${outJson}`);
  await browser.close().catch(() => null);
  process.exit(unlocked && !authGate ? 0 : 2);
};

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
