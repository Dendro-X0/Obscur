#!/usr/bin/env node
/**
 * One-shot P2 unlock→shell soak on release exe via CDP :9230.
 * Spec: specs/backend/r-account-p2-ui-soak-design-2026-07.md
 *
 *   node scripts/r-account-p2-ui-soak-cdp.mjs
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
const PASSWORD = "SyI14^ew1E";
const USERNAME = "Tester1";
const outPath = path.join(
  repoRoot,
  "docs",
  "handoffs",
  "r-account-p2-ui-soak-2026-07-30.json",
);

function loadPlaywright() {
  try {
    return requireFromPwa("playwright");
  } catch {
    return requireFromPwa("@playwright/test");
  }
}

async function isShell(page) {
  for (const label of ["Settings", "Network", "Search", "Chats"]) {
    if (await page.getByRole("link", { name: label, exact: true }).isVisible().catch(() => false)) {
      return true;
    }
  }
  if (await page.getByRole("link", { name: /^chats$/i }).isVisible().catch(() => false)) {
    return true;
  }
  return page.getByRole("button", { name: /^chats$/i }).isVisible().catch(() => false);
}

async function isGate(page) {
  if (await page.locator('input[type="password"]').first().isVisible().catch(() => false)) {
    return true;
  }
  return page.getByText(/welcome back|enter your password/i).isVisible().catch(() => false);
}

async function pageTextSample(page) {
  return page.evaluate(() => {
    const body = document.body?.innerText ?? "";
    return body.replace(/\s+/g, " ").trim().slice(0, 400);
  });
}

async function tauriInvoke(page, cmd, args = {}) {
  return page.evaluate(
    async ({ cmd, args }) => {
      const invoke =
        window.__TAURI_INTERNALS__?.invoke
        ?? window.__TAURI__?.core?.invoke
        ?? window.__TAURI__?.invoke;
      if (typeof invoke !== "function") {
        return {
          ok: false,
          error: "no Tauri invoke",
          tauriKeys: window.__TAURI__ ? Object.keys(window.__TAURI__) : null,
          hasInternals: typeof window.__TAURI_INTERNALS__ !== "undefined",
        };
      }
      try {
        const value = await invoke(cmd, args);
        return { ok: true, value };
      } catch (err) {
        return { ok: false, error: String(err?.message ?? err) };
      }
    },
    { cmd, args },
  );
}

async function waitForShellOrSettle(page, timeoutMs = 45000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (await isShell(page)) {
      return "shell";
    }
    const text = await pageTextSample(page);
    if (/unlocking profile/i.test(text)) {
      await page.waitForTimeout(500);
      continue;
    }
    if (await isGate(page)) {
      return "gate";
    }
    await page.waitForTimeout(500);
  }
  return (await isShell(page)) ? "shell" : "timeout";
}

async function unlockTester1(page) {
  const passwordInput = page.locator('input[type="password"]').first();
  await passwordInput.waitFor({ state: "visible", timeout: 15000 });
  const textInput = page.locator('input:not([type="password"]):not([type="hidden"])').first();
  if (await textInput.isVisible().catch(() => false)) {
    await textInput.click();
    await textInput.fill("");
    await textInput.pressSequentially(USERNAME, { delay: 20 });
  }
  await passwordInput.click();
  await passwordInput.fill("");
  await passwordInput.pressSequentially(PASSWORD, { delay: 20 });
  const formSubmit = page.locator('form button[type="submit"]').first();
  if (await formSubmit.isVisible().catch(() => false)) {
    await formSubmit.click();
  } else {
    await page.getByRole("button", { name: /^(unlock|log in)$/i }).last().click();
  }
}

async function main() {
  const { chromium } = loadPlaywright();
  const browser = await chromium.connectOverCDP(CDP);
  let page = await pickAppPageFromBrowser(browser, "http://tauri.localhost");
  if (!page) {
    page = await waitForAppPageFromBrowser(browser, {
      timeoutMs: 20000,
      appBase: "http://tauri.localhost",
    });
  }
  if (!page) {
    throw new Error(formatNoObscurPageError(browser, CDP));
  }

  const before = {
    url: page.url(),
    shell: await isShell(page),
    gate: await isGate(page),
    text: await pageTextSample(page),
  };

  let unlockedViaUi = false;
  let settle = "unknown";
  if (before.shell) {
    settle = "shell";
  } else if (before.gate) {
    await unlockTester1(page);
    unlockedViaUi = true;
    settle = await waitForShellOrSettle(page, 45000);
    if (settle === "gate") {
      await unlockTester1(page);
      settle = await waitForShellOrSettle(page, 30000);
    }
  } else {
    settle = await waitForShellOrSettle(page, 20000);
  }

  const afterText = await pageTextSample(page);
  const afterUnlock = {
    url: page.url(),
    shell: await isShell(page),
    gate: await isGate(page),
    settle,
    text: afterText,
    hasTester1: /Tester1/i.test(afterText),
    hasDemoUser: /DemoUser/i.test(afterText),
  };

  const session = await tauriInvoke(page, "get_session_status", {});
  const boot = await tauriInvoke(page, "auth_boot_snapshot", { restoreEligible: true });
  const digest = await page.evaluate(() => {
    const g = globalThis;
    const ring = g.__OBSCUR_RUNTIME_DIGEST__ ?? g.__obscurRuntimeDigest__ ?? null;
    if (Array.isArray(ring)) {
      return ring.slice(-30);
    }
    if (ring && typeof ring === "object" && Array.isArray(ring.events)) {
      return ring.events.slice(-30);
    }
    try {
      const raw = sessionStorage.getItem("obscur.runtime.digest.v1");
      if (raw) return JSON.parse(raw).slice?.(-30) ?? JSON.parse(raw);
    } catch {
      /* ignore */
    }
    return null;
  });

  const report = {
    capturedAt: new Date().toISOString(),
    surface: "release-exe",
    exe: "apps/desktop/src-tauri/target/release/obscur_desktop_app.exe",
    cdp: CDP,
    unlockedViaUi,
    before,
    afterUnlock,
    session,
    boot,
    digestSample: digest,
    matrix: {
      shell: afterUnlock.shell,
      identityNotDemoForever: afterUnlock.shell && !afterUnlock.hasDemoUser,
      sessionActive: Boolean(session?.ok && session.value?.is_active),
      bootUnlocked: Boolean(
        boot?.ok
          && (boot.value?.phase === "unlocked"
            || boot.value?.phase === "Unlocked"
            || boot.value?.keychainPresent === true),
      ),
      keychainPresent: boot?.value?.keychainPresent === true,
    },
  };

  report.verdict =
    report.matrix.shell
    && report.matrix.sessionActive
    && report.matrix.keychainPresent
      ? "Pass"
      : "Fail";

  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  fs.writeFileSync(outPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");
  console.log(JSON.stringify({ verdict: report.verdict, matrix: report.matrix, outPath }, null, 2));
  await browser.close().catch(() => undefined);
  process.exit(report.verdict === "Pass" ? 0 : 2);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
