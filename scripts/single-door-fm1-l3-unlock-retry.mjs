#!/usr/bin/env node
/** One-shot unlock retry against PROFILE LOCKED / auth gate on CDP :9230. */
import { createRequire } from "node:module";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { pickAppPageFromBrowser, waitForAppPageFromBrowser } from "./lib/cdp-app-page.mjs";
import { TESTER1 } from "./lib/dev-lab-playwright-auth.mjs";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const requireFromPwa = createRequire(path.join(repoRoot, "apps/pwa/package.json"));
const CDP = process.env.OBSCUR_CDP_URL ?? "http://127.0.0.1:9230";
const outJson = path.join(repoRoot, "docs", "handoffs", "single-door-fm1-l3-soak-latest.json");
const outMd = path.join(repoRoot, "docs", "handoffs", "single-door-fm1-l3-soak-latest.md");

function loadPlaywright() {
  try {
    return requireFromPwa("playwright");
  } catch {
    return requireFromPwa("@playwright/test");
  }
}

const sample = async (page) => page.evaluate(() => {
  const root = document.querySelector("main") || document.body;
  const text = (root?.innerText ?? "").replace(/\s+/g, " ").trim();
  return {
    href: location.href,
    text: text.slice(0, 1000),
    hasPw: Boolean(document.querySelector('input[type="password"]')),
    profileLocked: /PROFILE LOCKED/i.test(text),
    welcomeBack: /Welcome back/i.test(text),
    hasDirectory: /\bDIRECTORY\b|\bCONNECTIONS\b|Create Group/i.test(text),
    alerts: [...document.querySelectorAll("[role=alert], [data-sonner-toast]")]
      .map((e) => (e.textContent ?? "").trim())
      .filter(Boolean)
      .slice(0, 8),
  };
});

const isMessengerShell = (s) => (
  !s.hasPw && !s.profileLocked && !s.welcomeBack && s.hasDirectory
);

async function main() {
  const { nip19 } = requireFromPwa("nostr-tools");
  const sk = Uint8Array.from(TESTER1.privateKeyHex.match(/.{2}/g).map((b) => parseInt(b, 16)));
  const nsec = nip19.nsecEncode(sk);

  const { chromium } = loadPlaywright();
  const browser = await chromium.connectOverCDP(CDP);
  const page = await pickAppPageFromBrowser(browser)
    ?? await waitForAppPageFromBrowser(browser, { timeoutMs: 20000 });
  if (!page) {
    throw new Error(`No page on ${CDP}`);
  }

  const steps = [];
  const wait = (ms) => page.waitForTimeout(ms);
  steps.push({ step: "attach", ...(await sample(page)) });

  // Path A: device password Log In
  if ((await sample(page)).hasPw) {
    const pw = page.locator('input[type="password"]').first();
    await pw.click();
    await pw.fill("");
    await pw.pressSequentially(TESTER1.password, { delay: 20 });
    const submit = page.locator('button[type="submit"]').first();
    if (await submit.isVisible().catch(() => false)) {
      await submit.click();
    } else {
      await page.getByRole("button", { name: /^(log in|unlock)$/i }).last().click();
    }
    await wait(6000);
    steps.push({ step: "after_password", ...(await sample(page)) });
  }

  // Path B: Import Key / Advanced nsec if still gated
  if (!isMessengerShell(await sample(page))) {
    const advanced = page.getByRole("button", { name: /Advanced: unlock with private key|Import Key/i });
    if (await advanced.first().isVisible().catch(() => false)) {
      await advanced.first().click();
      await wait(600);
    }
    const key = page.locator('input[placeholder*="nsec" i]').first();
    if (await key.isVisible().catch(() => false)) {
      await key.fill(nsec);
      await page.getByRole("button", { name: /^(unlock|log in)$/i }).last().click();
      await wait(10000);
      steps.push({ step: "after_key", ...(await sample(page)) });
    }
  }

  // Bind form if present
  let s = await sample(page);
  if (/set.?device.?password|choose a device password|DEVICE PASSWORD BIND|Confirm password/i.test(s.text)) {
    const pws = page.locator('input[type="password"]');
    const count = await pws.count();
    await pws.nth(0).fill(TESTER1.password);
    if (count > 1) {
      await pws.nth(1).fill(TESTER1.password);
    }
    await page.getByRole("button", { name: /continue|save|bind|set password|log in/i }).last().click();
    await wait(8000);
    steps.push({ step: "after_bind", ...(await sample(page)) });
  }

  // Soft PDK unlock
  s = await sample(page);
  if (s.hasPw && /Unlock local data|Local data locked|Encrypted local storage/i.test(s.text)) {
    await page.locator('input[type="password"]').first().fill(TESTER1.password);
    await page.getByRole("button", { name: /unlock local data|unlock/i }).last().click();
    await wait(8000);
    steps.push({ step: "after_pdk", ...(await sample(page)) });
  }

  const deadline = Date.now() + 20000;
  let shell = false;
  while (Date.now() < deadline) {
    s = await sample(page);
    if (isMessengerShell(s)) {
      shell = true;
      break;
    }
    await wait(500);
  }
  steps.push({ step: "final", shell, ...s });

  const session = await page.evaluate(async () => {
    const invoke = window.__TAURI_INTERNALS__?.invoke ?? window.__TAURI__?.core?.invoke;
    try {
      return invoke ? await invoke("get_session_status", {}) : null;
    } catch (error) {
      return String(error);
    }
  });

  const verdict = shell ? "Pass" : "Fail";
  const report = {
    capturedAt: new Date().toISOString(),
    surface: "tauri-desktop-cdp",
    cdp: CDP,
    band: "single-door-FM1-L3",
    nonClaims: ["Soft L3 Fixed", "Tor Verified", "S5 L3 dual-profile FS soak"],
    user: TESTER1.username,
    session,
    steps,
    matrix: {
      lockGateObservedEarlier: true,
      passwordOrKeyReachedMessengerShell: shell,
      sessionActive: Boolean(session && typeof session === "object" && session.is_active),
      s5L2Only: true,
    },
    verdict,
    reason: shell ? undefined : "unlock_did_not_reach_messenger_shell",
  };

  fs.writeFileSync(outJson, `${JSON.stringify(report, null, 2)}\n`);
  fs.writeFileSync(outMd, [
    "# Single-door FM1 L3 soak",
    "",
    `- Captured: ${report.capturedAt}`,
    `- Verdict: **${verdict}**`,
    report.reason ? `- Reason: ${report.reason}` : "",
    `- CDP: \`${CDP}\``,
    "",
    "## Matrix",
    ...Object.entries(report.matrix).map(([k, v]) => `- ${k}: ${v}`),
    "",
    "## Non-claims",
    ...report.nonClaims.map((c) => `- ${c}`),
    "",
    "## Notes",
    "",
    "- Lock→PROFILE LOCKED gate was observed in prior CDP steps this session.",
    "- Password Log In on PROFILE LOCKED was silent (no incorrect-password toast) in earlier probes.",
    "- This retry covers password then Advanced/Import Key (+ bind/PDK if shown).",
    "",
  ].filter(Boolean).join("\n"));

  console.log(JSON.stringify({
    verdict,
    matrix: report.matrix,
    final: s,
    session,
    outJson,
  }, null, 2));
  await browser.close().catch(() => undefined);
  process.exit(shell ? 0 : 2);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
