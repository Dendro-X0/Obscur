#!/usr/bin/env node
/**
 * Align default profile slot with Tester1 fixture (matches OS keychain e07f67…).
 * Feasibility: stored DemoUser 6ca65b… ≠ native Tester1 — clear window + import Tester1.
 *
 *   node scripts/r-account-align-tester1-cdp.mjs
 */
import { spawn, spawnSync } from "node:child_process";
import { createRequire } from "node:module";
import fs from "node:fs";
import net from "node:net";
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
const EXE = path.join(
  repoRoot,
  "apps",
  "desktop",
  "src-tauri",
  "target",
  "release",
  "obscur_desktop_app.exe",
);
const CDP_PORT = Number(process.env.OBSCUR_CDP_PORT ?? "9230");
const CDP = process.env.OBSCUR_CDP_URL ?? `http://127.0.0.1:${CDP_PORT}`;
const TESTER1_PUB = "e07f67dcb8a58f53b13fd15ae549c31fb3817a3a6cf0e8bd6903bae3c191ea56";
const outJson = path.join(repoRoot, "docs", "handoffs", "r-account-align-tester1-2026-07-31.json");
const outMd = path.join(repoRoot, "docs", "handoffs", "r-account-align-tester1-2026-07-31.md");

function loadPlaywright() {
  try {
    return requireFromPwa("playwright");
  } catch {
    return requireFromPwa("@playwright/test");
  }
}

const tcpOpen = (host, port, ms = 500) =>
  new Promise((resolve) => {
    const socket = net.connect({ host, port });
    const t = setTimeout(() => {
      socket.destroy();
      resolve(false);
    }, ms);
    socket.once("connect", () => {
      clearTimeout(t);
      socket.end();
      resolve(true);
    });
    socket.once("error", () => {
      clearTimeout(t);
      resolve(false);
    });
  });

async function waitPort(port, timeoutMs = 45000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (await tcpOpen("127.0.0.1", port)) return true;
    await new Promise((r) => setTimeout(r, 400));
  }
  return false;
}

async function isShell(page) {
  for (const label of ["Settings", "Network", "Search", "Chats"]) {
    if (await page.getByRole("link", { name: label, exact: true }).isVisible().catch(() => false)) {
      return true;
    }
  }
  return page.getByRole("button", { name: /^chats$/i }).isVisible().catch(() => false);
}

async function tauriInvoke(page, cmd, args = {}) {
  return page.evaluate(
    async ({ cmd, args }) => {
      const invoke =
        window.__TAURI_INTERNALS__?.invoke
        ?? window.__TAURI__?.core?.invoke
        ?? window.__TAURI__?.invoke;
      if (typeof invoke !== "function") {
        return { ok: false, error: "no Tauri invoke" };
      }
      try {
        return { ok: true, value: await invoke(cmd, args) };
      } catch (err) {
        return { ok: false, error: String(err?.message ?? err) };
      }
    },
    { cmd, args },
  );
}

async function readIdentityPubkey(page) {
  return page.evaluate(() => {
    try {
      const raw = localStorage.getItem("obscur.identity.record::default")
        || localStorage.getItem("identity::default");
      if (!raw) return null;
      const parsed = JSON.parse(raw);
      return parsed?.publicKeyHex ?? null;
    } catch {
      return null;
    }
  });
}

async function importTester1(page) {
  const steps = [];
  if (await isShell(page)) {
    steps.push("already_shell");
    return steps;
  }

  const importBtn = page.getByRole("button", { name: /^Import Key$/i });
  if (await importBtn.isVisible().catch(() => false)) {
    await importBtn.click();
    steps.push("clicked_import_key");
    await page.waitForTimeout(600);
  }

  const keyInput = page.getByPlaceholder(/nsec/i).first();
  await keyInput.waitFor({ state: "visible", timeout: 15000 });
  await keyInput.click();
  await keyInput.fill("");
  await keyInput.pressSequentially(TESTER1.privateKeyHex, { delay: 5 });
  steps.push("pasted_tester1_hex");
  await page.waitForTimeout(800);

  const clearContinue = page.getByRole("button", { name: /Clear this window and continue/i });
  if (await clearContinue.isVisible().catch(() => false)) {
    await clearContinue.click();
    steps.push("cleared_occupied_window");
    await page.waitForTimeout(1500);
    // After clear, re-open import if needed
    const importAgain = page.getByRole("button", { name: /^Import Key$/i });
    if (await importAgain.isVisible().catch(() => false)) {
      await importAgain.click();
      await page.waitForTimeout(500);
      const key2 = page.getByPlaceholder(/nsec/i).first();
      if (await key2.isVisible().catch(() => false)) {
        await key2.fill("");
        await key2.pressSequentially(TESTER1.privateKeyHex, { delay: 5 });
        steps.push("re_pasted_after_clear");
      }
    }
  }

  // Password may be required for device login after import
  const passwordInput = page.locator('input[type="password"]').first();
  if (await passwordInput.isVisible().catch(() => false)) {
    const userInput = page.locator('input:not([type="password"]):not([type="hidden"])').first();
    if (await userInput.isVisible().catch(() => false)) {
      const ph = await userInput.getAttribute("placeholder").catch(() => "");
      if (!/nsec/i.test(ph || "")) {
        await userInput.click();
        await userInput.fill("");
        await userInput.pressSequentially(TESTER1.username, { delay: 15 });
        steps.push("filled_username");
      }
    }
    await passwordInput.click();
    await passwordInput.fill("");
    await passwordInput.pressSequentially(TESTER1.password, { delay: 15 });
    steps.push("filled_password");
  }

  const unlock = page.getByRole("button", { name: /^(Unlock|Log In|Continue with private key)$/i }).last();
  if (await unlock.isVisible().catch(() => false)) {
    await unlock.click();
    steps.push("clicked_unlock");
  } else {
    const formSubmit = page.locator('form button[type="submit"]').first();
    if (await formSubmit.isVisible().catch(() => false)) {
      await formSubmit.click();
      steps.push("clicked_form_submit");
    }
  }

  const deadline = Date.now() + 60000;
  while (Date.now() < deadline) {
    if (await isShell(page)) {
      steps.push("shell");
      return steps;
    }
    // Conflict clear mid-flow
    const clear2 = page.getByRole("button", { name: /Clear this window and continue/i });
    if (await clear2.isVisible().catch(() => false)) {
      await clear2.click();
      steps.push("cleared_mid_flow");
      await page.waitForTimeout(1000);
    }
    await page.waitForTimeout(500);
  }
  steps.push("timeout_no_shell");
  return steps;
}

const main = async () => {
  if (!fs.existsSync(EXE)) {
    throw new Error(`Missing release exe: ${EXE}`);
  }

  spawnSync("taskkill", ["/F", "/IM", "obscur_desktop_app.exe"], { stdio: "ignore" });
  await new Promise((r) => setTimeout(r, 1500));

  const child = spawn(EXE, [], {
    cwd: path.dirname(EXE),
    detached: true,
    stdio: "ignore",
    env: {
      ...process.env,
      WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS: `--remote-debugging-port=${CDP_PORT}`,
    },
    windowsHide: true,
  });
  child.unref();

  if (!(await waitPort(CDP_PORT))) {
    throw new Error(`CDP :${CDP_PORT} did not open`);
  }

  const { chromium } = loadPlaywright();
  const browser = await chromium.connectOverCDP(CDP);
  let page = await pickAppPageFromBrowser(browser, "http://tauri.localhost");
  if (!page) {
    page = await waitForAppPageFromBrowser(browser, {
      timeoutMs: 30000,
      appBase: "http://tauri.localhost",
    });
  }
  if (!page) {
    throw new Error(formatNoObscurPageError(browser, CDP));
  }

  const beforeStored = await readIdentityPubkey(page);
  const beforeSession = await tauriInvoke(page, "get_session_status", {});
  const steps = await importTester1(page);
  const afterStored = await readIdentityPubkey(page);
  const afterSession = await tauriInvoke(page, "get_session_status", {});
  const shell = await isShell(page);

  const sessionPk = (afterSession?.value?.npub || "").toLowerCase();
  const storedPk = (afterStored || "").toLowerCase();
  const aligned = shell
    && storedPk === TESTER1_PUB
    && sessionPk === TESTER1_PUB;

  const payload = {
    at: new Date().toISOString(),
    before: {
      storedPublicKeyHex: beforeStored,
      session: beforeSession,
    },
    steps,
    after: {
      shell,
      storedPublicKeyHex: afterStored,
      session: afterSession,
    },
    expectedPublicKeyHex: TESTER1_PUB,
    aligned,
  };

  fs.mkdirSync(path.dirname(outJson), { recursive: true });
  fs.writeFileSync(outJson, `${JSON.stringify(payload, null, 2)}\n`, "utf8");
  const md = `# Device align — Tester1 on default (2026-07-31)

- **When:** ${payload.at}
- **Outcome:** ${aligned ? "**Pass**" : "**Fail**"}
- **Expected pubkey:** \`${TESTER1_PUB.slice(0, 8)}…\`
- **Before stored:** \`${(beforeStored || "null").slice(0, 8)}…\`
- **After stored:** \`${(afterStored || "null").slice(0, 8)}…\`
- **After session:** \`${(sessionPk || "null").slice(0, 8)}…\`
- **Shell:** ${shell}
- **Steps:** ${steps.join(" → ")}

## Claim

| May say | |
|---------|---|
| Device slot aligned to Tester1 | ${aligned ? "Yes" : "**No**"} |
| Cold hydrate fixed | **No** — run L3 after this Pass |

JSON: [\`r-account-align-tester1-2026-07-31.json\`](./r-account-align-tester1-2026-07-31.json)
`;
  fs.writeFileSync(outMd, md, "utf8");
  console.log(JSON.stringify({ aligned, shell, storedPk: storedPk.slice(0, 16), sessionPk: sessionPk.slice(0, 16), steps, outMd }, null, 2));
  await browser.close().catch(() => undefined);
  process.exit(aligned ? 0 : 2);
};

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
