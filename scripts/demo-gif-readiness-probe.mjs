#!/usr/bin/env node
/**
 * Demo script §2–§7 readiness probe via CDP (static shell / Tauri dev).
 * Output: .codectx/verify/demo-gif-readiness-<date>/report.json
 */
import { createRequire } from "node:module";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const pwaDir = path.join(repoRoot, "apps", "pwa");
const require = createRequire(path.join(pwaDir, "package.json"));
const { chromium } = require("@playwright/test");

const cdpUrl = process.argv.includes("--cdp")
  ? process.argv[process.argv.indexOf("--cdp") + 1]
  : "http://127.0.0.1:9230";

const TESTER1 = {
  password: "SyI14^ew1E",
  privateKeyHex: "c09832d637eb265d90b29c12eb8dfcfffe165b8fb34094af75236d5be4d97884",
};

const outDir = path.join(
  repoRoot,
  ".codectx",
  "verify",
  `demo-gif-readiness-${new Date().toISOString().slice(0, 10)}`,
);
fs.mkdirSync(outDir, { recursive: true });

const report = {
  at: new Date().toISOString(),
  cdpUrl,
  segments: [],
};

const segment = (id, name, result) => {
  report.segments.push({ id, name, ...result });
  const icon = result.status === "pass" ? "PASS" : result.status === "fail" ? "FAIL" : "BLOCKED";
  console.log(`[${icon}] ${id} ${name}: ${result.detail ?? ""}`);
};

const isShell = async (page) => {
  for (const label of ["Settings", "Chats", "Network"]) {
    if (await page.getByRole("link", { name: label, exact: true }).isVisible().catch(() => false)) {
      return true;
    }
  }
  return false;
};

const unlockIfNeeded = async (page) => {
  if (await isShell(page)) return;
  const logInTab = page.getByRole("button", { name: "Log In" }).first();
  if (await logInTab.isVisible().catch(() => false)) await logInTab.click();
  const keyInput = page.getByPlaceholder(/nsec/i).first();
  if (await keyInput.isVisible().catch(() => false)) {
    await keyInput.fill(TESTER1.privateKeyHex);
    await page.getByRole("button", { name: /continue/i }).first().click({ timeout: 90_000 });
    await page.waitForTimeout(3000);
  }
  const pw = page.locator('input[type="password"]').first();
  if (await pw.isVisible().catch(() => false)) {
    await pw.fill(TESTER1.password);
    await page.getByRole("button", { name: /^log in$/i }).last().click({ timeout: 30_000 });
    await page.waitForTimeout(6000);
  }
};

const bodyHints = async (page) => page.evaluate(() => {
  const t = document.body?.innerText ?? "";
  return {
    pathname: location.pathname,
    offlineBanner: /relay transport is offline/i.test(t),
    relayActive: (t.match(/\d+\/\d+\s*(active relays|RELAYS ACTIVE)/i) || [])[0] ?? null,
    roomKeyMissing: /room key missing/i.test(t),
    welcomeBack: /welcome back/i.test(t),
    hasCompose: Boolean(document.querySelector("textarea, [contenteditable='true'], input[placeholder*='message' i]")),
    hasSettingsLink: Boolean(document.querySelector('a[href="/settings"]')),
    hasGroupNav: Boolean(document.querySelector('a[href="/groups"], a[href*="group"]')),
    hasFileInput: Boolean(document.querySelector('input[type="file"]')),
  };
});

const browser = await chromium.connectOverCDP(cdpUrl);
const page = browser.contexts()[0]?.pages()[0];
if (!page) throw new Error("No CDP page");

try {
  await unlockIfNeeded(page);
  const shellOk = await isShell(page);
  await page.screenshot({ path: path.join(outDir, "01-post-unlock.png"), fullPage: false, timeout: 5000 }).catch(() => undefined);
  segment("S2", "Unlock & identity (§2)", shellOk
    ? { status: "pass", detail: `shell at ${page.url()}`, pathname: new URL(page.url()).pathname }
    : { status: "fail", detail: "auth gate still visible after unlock flow" });

  // §4 Settings navigation (GIF-critical — fixed band)
  if (shellOk) {
    await page.locator('a[href="/settings"]').first().click();
    await page.waitForTimeout(3000);
    const hints = await bodyHints(page);
    await page.screenshot({ path: path.join(outDir, "02-settings.png") });
    const settingsPass = hints.pathname === "/settings" && !hints.welcomeBack;
    segment("S4-nav", "Settings navigation (§4 / GIF)", settingsPass
      ? { status: "pass", detail: "stayed unlocked on /settings", ...hints }
      : { status: "fail", detail: "kicked to auth or wrong route", ...hints });

    // Relays sub-panel
    const relaysTab = page.getByRole("button", { name: /relay/i }).first();
    if (await relaysTab.isVisible().catch(() => false)) {
      await relaysTab.click();
      await page.waitForTimeout(2000);
    }
    const relayText = await page.evaluate(() => document.body?.innerText ?? "");
    const hasLocalRelay = /localhost:7000|127\.0\.0\.1:7000|ws:\/\/localhost:7000/i.test(relayText);
    const relayConnected = /\d+\/\d+/.test(relayText) && !/0\/\d+\s*active relays/i.test(relayText);
    await page.screenshot({ path: path.join(outDir, "03-settings-relays.png") });
    segment("S4-relay", "Relay panel (§4)", hasLocalRelay || relayConnected
      ? { status: "pass", detail: hasLocalRelay ? "localhost:7000 in relays UI" : "non-zero relay count", relayActive: hints.relayActive }
      : { status: "blocked", detail: "relay not shown connected — check Docker :7000 + app restart", offlineBanner: hints.offlineBanner });
  }

  // §3 DM
  if (shellOk) {
    await page.locator('a[href="/"]').first().click();
    await page.waitForTimeout(2000);
    const threadLink = page.locator('a[href^="/network/"]').first();
    const sidebarRow = page.getByText(/LinkBio|botrift|Tester/i).first();
    if (await threadLink.isVisible().catch(() => false)) {
      await threadLink.click();
    } else if (await sidebarRow.isVisible().catch(() => false)) {
      await sidebarRow.click();
    }
      await page.waitForTimeout(2000);
    }
    const marker = `demo-gif-probe-${Date.now().toString(36).slice(-6)}`;
    const compose = page.locator("textarea").first();
    if (await compose.isVisible().catch(() => false)) {
      await compose.fill(marker);
      await page.keyboard.press("Enter");
      await page.waitForTimeout(3000);
      const visible = await page.getByText(marker).first().isVisible().catch(() => false);
      await page.screenshot({ path: path.join(outDir, "04-dm-send.png") });
      segment("S3", "DM send (§3 / GIF)", visible
        ? { status: "pass", detail: `bubble visible: ${marker}` }
        : { status: "fail", detail: `sent ${marker} but not visible in thread` });
    } else {
      segment("S3", "DM send (§3 / GIF)", { status: "blocked", detail: "no compose surface — open a DM thread manually first" });
    }
  }

  // §6 Groups — toggle in chat list panel (not sidebar /groups route)
  if (shellOk) {
    const groupToggle = page.getByRole("button", { name: /^Group$/i }).first();
    if (await groupToggle.isVisible().catch(() => false)) {
      await groupToggle.click();
      await page.waitForTimeout(3000);
      const hints = await bodyHints(page);
      await page.screenshot({ path: path.join(outDir, "05-groups.png"), fullPage: false, timeout: 5000 }).catch(() => undefined);
      segment("S6", "Group home (§6 / P0 GIF gap)", hints.roomKeyMissing
        ? { status: "fail", detail: "Room key missing chrome visible", ...hints }
        : { status: "pass", detail: "Group tab loads without room-key blocker", ...hints });
    } else {
      segment("S6", "Group home (§6)", { status: "blocked", detail: "Group toggle not visible — open Chats first" });
    }
  }

  // §5 Multi-profile — UI presence only
  const profileChrome = await page.evaluate(() => ({
    hasAvatarMenu: Boolean(document.querySelector("[data-testid], [aria-label*='profile' i], [aria-label*='account' i]")),
    hasProfilesRoute: Boolean(document.querySelector('a[href="/profiles"]')),
  }));
  segment("S5", "Multi-profile chrome (§5 / GIF)", profileChrome.hasAvatarMenu || profileChrome.hasProfilesRoute
    ? { status: "pass", detail: "profile switcher or /profiles route present", ...profileChrome }
    : { status: "blocked", detail: "profile UI not found — manual second-window capture needed" });

  // §7 Media — attach control presence
  await page.locator('a[href="/"]').first().click().catch(() => {});
  await page.waitForTimeout(1500);
  const mediaHints = await page.evaluate(() => ({
    hasFileInput: Boolean(document.querySelector('input[type="file"]')),
    hasAttachButton: Boolean([...document.querySelectorAll("button")].some((b) => /attach|file|upload|paperclip/i.test(b.getAttribute("aria-label") ?? b.textContent ?? ""))),
  }));
  segment("S7", "Media attach UI (§7 / GIF)", mediaHints.hasFileInput || mediaHints.hasAttachButton
    ? { status: "pass", detail: "attach control present in shell", ...mediaHints }
    : { status: "blocked", detail: "open DM thread with compose for attach button" });

} finally {
  fs.writeFileSync(path.join(outDir, "report.json"), JSON.stringify(report, null, 2));
  console.log(`\nReport: ${path.join(outDir, "report.json")}`);
  await browser.close();
}
