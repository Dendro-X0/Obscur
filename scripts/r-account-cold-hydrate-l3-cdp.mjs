#!/usr/bin/env node
/**
 * AUTH-KERN cold hydrate L3 — kill process → launch release exe → expect shell
 * without password when native boot is unlocked.
 *
 * Spec: specs/backend/auth-kern-cold-hydrate-design-2026-07.md
 *
 *   node scripts/r-account-cold-hydrate-l3-cdp.mjs
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
const outJson = path.join(repoRoot, "docs", "handoffs", "auth-kern-cold-hydrate-l3-2026-07-31.json");
const outMd = path.join(repoRoot, "docs", "handoffs", "auth-kern-cold-hydrate-l3-2026-07-31.md");

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

async function waitSettle(page, timeoutMs = 60000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (await isShell(page)) return "shell";
    if (await isGate(page)) {
      // Give boot restore time after first gate paint.
      await page.waitForTimeout(1500);
      if (await isShell(page)) return "shell";
      if (await isGate(page)) return "gate";
    }
    await page.waitForTimeout(400);
  }
  return (await isShell(page)) ? "shell" : "timeout";
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
    throw new Error(`CDP :${CDP_PORT} did not open after launch`);
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

  const settle = await waitSettle(page, 60000);
  const text = await pageTextSample(page);
  const shell = await isShell(page);
  const gate = await isGate(page);
  const session = await tauriInvoke(page, "get_session_status", {});
  const boot = await tauriInvoke(page, "auth_boot_snapshot", { restoreEligible: true });
  const digest = await page.evaluate(() => {
    const g = globalThis;
    const ring = g.__OBSCUR_RUNTIME_DIGEST__ ?? g.__obscurRuntimeDigest__ ?? null;
    if (Array.isArray(ring)) return ring.slice(-40);
    if (ring && typeof ring === "object" && Array.isArray(ring.events)) {
      return ring.events.slice(-40);
    }
    try {
      const raw = sessionStorage.getItem("obscur.runtime.digest.v1");
      if (raw) {
        const parsed = JSON.parse(raw);
        return Array.isArray(parsed) ? parsed.slice(-40) : parsed?.events?.slice?.(-40) ?? null;
      }
    } catch {
      /* ignore */
    }
    return null;
  });

  const digestNames = Array.isArray(digest)
    ? digest.map((e) => e?.name ?? e?.event ?? String(e)).filter(Boolean)
    : [];
  const restoreSucceeded = digestNames.some((n) => /kernel_boot_restore_succeeded/i.test(n));
  const restoreExhausted = digestNames.some((n) => /kernel_boot_restore_exhausted/i.test(n));

  const sessionActive = Boolean(session?.ok && session.value?.is_active);
  const bootPhase = boot?.value?.phase ?? boot?.value?.Phase ?? null;
  const keychainPresent = boot?.value?.keychainPresent === true
    || boot?.value?.keychain_present === true;
  const bootUnlocked = String(bootPhase).toLowerCase() === "unlocked";
  const sessionPk = String(session?.value?.npub || "").toLowerCase();
  const storedPk = await page.evaluate(() => {
    try {
      const raw = localStorage.getItem("obscur.identity.record::default")
        || localStorage.getItem("identity::default");
      if (!raw) return "";
      return String(JSON.parse(raw)?.publicKeyHex || "").toLowerCase();
    } catch {
      return "";
    }
  });
  const pubkeyAligned = Boolean(storedPk && sessionPk && storedPk === sessionPk);

  // Cold hydrate Pass: shell without password when stored identity matches native session.
  const pass = shell && sessionActive && pubkeyAligned && (bootUnlocked || keychainPresent);

  const payload = {
    at: new Date().toISOString(),
    surface: "release-exe-cold",
    exe: "apps/desktop/src-tauri/target/release/obscur_desktop_app.exe",
    cdp: CDP,
    settle,
    shell,
    gate,
    text,
    session,
    boot,
    restoreSucceeded,
    restoreExhausted,
    digestNames: digestNames.slice(-20),
    matrix: {
      shellWithoutPassword: shell,
      stayedOnGate: gate && !shell,
      sessionActive,
      bootUnlocked,
      keychainPresent,
      pubkeyAligned,
      storedPublicKeyHex: storedPk || null,
      sessionPublicKeyHex: sessionPk || null,
    },
    pass,
    claim: {
      maySay: pass ? "AUTH-KERN cold hydrate fixed (L3 release)" : null,
      mustNotSay: pass ? ["P2 package verified"] : ["cold hydrate fixed", "P2 verified"],
    },
  };

  fs.mkdirSync(path.dirname(outJson), { recursive: true });
  fs.writeFileSync(outJson, `${JSON.stringify(payload, null, 2)}\n`, "utf8");
  const md = `# AUTH-KERN cold hydrate L3 — release exe

- **When:** ${payload.at}
- **Outcome:** ${pass ? "**Pass**" : "**Fail**"}
- **Settle:** \`${settle}\` · shell=${shell} · gate=${gate}
- **Recipe:** \`node scripts/r-account-cold-hydrate-l3-cdp.mjs\`

## Matrix

| Check | Result |
|-------|--------|
| Shell without password | ${shell ? "Pass" : "Fail"} |
| Session active | ${sessionActive ? "Pass" : "Fail"} |
| Boot unlocked | ${bootUnlocked ? "Pass" : `Fail (${bootPhase})`} |
| Keychain present | ${keychainPresent ? "Pass" : "Fail"} |
| Stored ≡ session pubkey | ${pubkeyAligned ? "Pass" : `Fail (stored=${(storedPk || "∅").slice(0, 8)}… session=${(sessionPk || "∅").slice(0, 8)}…)`} |
| Digest restore succeeded | ${restoreSucceeded ? "yes" : "no"} |
| Digest restore exhausted | ${restoreExhausted ? "yes" : "no"} |

## Claim

| May say | |
|---------|---|
| Cold hydrate fixed (L3) | ${pass ? "Yes" : "**No**"} |
| P2 package verified | **No** — separate re-soak |

JSON: [\`auth-kern-cold-hydrate-l3-2026-07-31.json\`](./auth-kern-cold-hydrate-l3-2026-07-31.json)
`;
  fs.writeFileSync(outMd, md, "utf8");

  console.log(JSON.stringify({
    pass,
    settle,
    shell,
    gate,
    sessionActive,
    bootUnlocked,
    keychainPresent,
    restoreSucceeded,
    restoreExhausted,
    outMd,
  }, null, 2));

  await browser.close().catch(() => undefined);
  process.exit(pass ? 0 : 2);
};

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
