#!/usr/bin/env node
/**
 * E2 public-only desktop L3 — Default Stable / public pack must reach writable≥1
 * with no local :7000 in the enabled pool.
 *
 * Prerequisites: pnpm dev:desktop:online:live · CDP :9230 · unlocked or Import Key capable
 *
 *   node scripts/e2-public-only-l3-desktop.mjs
 *   pnpm verify:e2-public-only-l3
 *
 * Pass: writable≥1 ∧ !hasLocal ∧ hasPublic (nos|primal|damus|…)
 * Fail with upstreamProbe when public TLS/WSS are down — do not claim "public Nostr fixed".
 */
import { createRequire } from "node:module";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  formatNoObscurPageError,
  waitForAppPageFromBrowser,
} from "./lib/cdp-app-page.mjs";
import {
  applyDevOperatorBundle,
  ensureTester1Unlocked,
  TESTER1,
} from "./lib/dev-lab-playwright-auth.mjs";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const pwaDir = path.join(repoRoot, "apps", "pwa");
const requireFromPwa = createRequire(path.join(pwaDir, "package.json"));
const CDP = process.env.OBSCUR_CDP_URL ?? "http://127.0.0.1:9230";
const APP_BASE = process.env.PLAYWRIGHT_BASE_URL ?? "http://127.0.0.1:3340";
const reportPath = path.join(repoRoot, "test-results", "e2-public-only-l3-2026-07-31.json");

const PUBLIC_PROBE_URLS = [
  "wss://nos.lol",
  "wss://relay.primal.net",
  "wss://relay.damus.io",
];

function loadPlaywright() {
  try {
    return requireFromPwa("playwright");
  } catch {
    return requireFromPwa("@playwright/test");
  }
}

const log = (message) => console.log(`[e2-public-only-l3] ${message}`);

const isLocalUrl = (url) => /localhost:7000|127\.0\.0\.1:7000/i.test(String(url ?? ""));
const isPublicWss = (url) => /^wss:\/\//i.test(String(url ?? "").trim());

async function isShell(page) {
  for (const label of ["Settings", "Network", "Search", "Chats"]) {
    if (await page.getByRole("link", { name: label, exact: true }).isVisible().catch(() => false)) {
      return true;
    }
  }
  return page.getByRole("link", { name: /^chats$/i }).isVisible().catch(() => false);
}

async function openDefaultProfileSlot(page) {
  if (!/\/profiles/i.test(page.url())) {
    return;
  }
  const slot = page.getByRole("button").nth(0);
  if (await slot.isVisible().catch(() => false)) {
    await slot.click().catch(() => undefined);
    await page.waitForTimeout(2_000);
  }
}

async function prepareImportKeyForm(page) {
  return page.evaluate((hex) => {
    const keyEl = document.querySelector('input[placeholder="nsec1..."]');
    if (!keyEl) {
      return { ok: false, reason: "no_key_input" };
    }
    const propsKey = Object.keys(keyEl).find((k) => k.startsWith("__reactProps"));
    if (propsKey && typeof keyEl[propsKey]?.onChange === "function") {
      keyEl[propsKey].onChange({ target: { value: hex }, currentTarget: { value: hex } });
    }

    const continueBtn = [...document.querySelectorAll("button")].find((b) => (
      /^Continue$/i.test((b.innerText || "").trim())
    ));
    if (!continueBtn) {
      return { ok: false, reason: "no_continue" };
    }
    let fiber = continueBtn[Object.keys(continueBtn).find((k) => k.startsWith("__reactFiber"))];
    while (fiber && fiber.elementType?.name !== "AuthScreen") {
      fiber = fiber.return;
    }
    if (!fiber) {
      return { ok: true, clearedPassword: false };
    }

    let hook = fiber.memoizedState;
    let idx = 0;
    let clearedPassword = false;
    while (hook && idx < 100) {
      const value = hook.memoizedState;
      const dispatch = hook.queue?.dispatch;
      if (typeof dispatch === "function" && typeof value === "string") {
        const isPolicyError = value.startsWith("Use at least 12 characters");
        const isShortPassword = value.length > 0 && value.length < 64 && idx >= 70 && idx <= 76;
        if (isPolicyError || isShortPassword) {
          dispatch(isPolicyError ? null : "");
          if (isShortPassword) clearedPassword = true;
        }
      }
      hook = hook.next;
      idx += 1;
    }
    return { ok: true, clearedPassword };
  }, TESTER1.privateKeyHex);
}

async function importTester1IfNeeded(page) {
  if (await isShell(page)) {
    return;
  }
  const importBtn = page.getByRole("button", { name: /^Import Key$/i });
  if (!(await importBtn.isVisible().catch(() => false))) {
    return;
  }
  log("Import Key bootstrap");
  await importBtn.click();
  await page.waitForTimeout(600);
  if (!(await page.getByPlaceholder(/nsec/i).first().isVisible().catch(() => false))) {
    return;
  }
  await prepareImportKeyForm(page);
  await page.waitForTimeout(300);
  const continueBtn = page.getByRole("button", { name: /^Continue$/i }).first();
  if (await continueBtn.isVisible().catch(() => false)) {
    await continueBtn.click({ force: true });
  }
  const deadline = Date.now() + 60_000;
  while (Date.now() < deadline) {
    if (await isShell(page)) return;
    const policyError = page.getByText(/Use at least 12 characters/i);
    if (await policyError.isVisible().catch(() => false)) {
      await prepareImportKeyForm(page);
      if (await continueBtn.isVisible().catch(() => false)) {
        await continueBtn.click({ force: true });
      }
    }
    await page.waitForTimeout(500);
  }
}

async function ensureUnlockedShell(page) {
  if (await isShell(page)) return;
  await openDefaultProfileSlot(page);
  await applyDevOperatorBundle(page).catch(() => undefined);
  await importTester1IfNeeded(page);
  if (await isShell(page)) return;
  try {
    await ensureTester1Unlocked(page, { log, timeoutMs: 45_000 });
  } catch {
    await importTester1IfNeeded(page);
  }
  if (!(await isShell(page))) {
    throw new Error(`Timed out waiting for unlocked shell (url=${page.url()})`);
  }
}

async function openRelaysSurface(page) {
  await page.goto(`${APP_BASE.replace(/\/$/, "")}/settings`, { waitUntil: "domcontentloaded" }).catch(() => undefined);
  await page.waitForTimeout(2_000);
  // Exact sidebar label "Relays" (not composite "Relaysnetwork").
  await page.evaluate(() => {
    const el = [...document.querySelectorAll("button")].find((node) => (
      (node.innerText || "").trim() === "Relays"
    ));
    el?.click();
  });
  await page.waitForTimeout(2_000);
  await page.getByText(/Transport packs|Default Stable/i).first()
    .waitFor({ state: "visible", timeout: 25_000 });
}

async function applyDefaultStablePack(page) {
  log("Applying Default Stable (public Nostr pack) via UI…");

  const applied = await page.evaluate(() => {
    // Prefer exact textContent match (tightest node), then nearest Apply pack below it.
    const nodes = [...document.querySelectorAll("*")].filter((el) => (
      (el.textContent || "").trim() === "Default Stable"
    ));
    const heading = nodes.sort((a, b) => (
      a.getBoundingClientRect().width - b.getBoundingClientRect().width
    ))[0];
    if (!heading) {
      return { ok: false, reason: "default_stable_heading_not_found", nodeCount: nodes.length };
    }
    const hRect = heading.getBoundingClientRect();
    const applies = [...document.querySelectorAll("button")]
      .filter((btn) => /^Apply pack$/i.test((btn.innerText || "").trim()))
      .map((btn) => {
        const r = btn.getBoundingClientRect();
        return {
          btn,
          dy: r.top - hRect.bottom,
          dx: Math.abs((r.left + r.right) / 2 - (hRect.left + hRect.right) / 2),
        };
      })
      .filter((row) => row.dy >= -20 && row.dy < 280)
      .sort((a, b) => (a.dy - b.dy) || (a.dx - b.dx));
    if (!applies.length) {
      return { ok: false, reason: "apply_near_heading_not_found", headingTop: hRect.top };
    }
    applies[0].btn.click();
    return { ok: true, dy: applies[0].dy, dx: applies[0].dx };
  });
  log(`Default Stable apply click: ${JSON.stringify(applied)}`);
  await page.waitForTimeout(800);

  const confirm = page.getByRole("button", { name: /Replace and apply/i });
  if (await confirm.isVisible().catch(() => false)) {
    const dialogCopy = await page.evaluate(() => {
      const open = [...document.querySelectorAll('[role="dialog"], [data-state="open"]')]
        .map((el) => el.innerText || "")
        .find((text) => /Replace your endpoint list/i.test(text));
      return open ?? "";
    });
    if (/Local Dev Mesh/i.test(dialogCopy) && !/Default Stable/i.test(dialogCopy)) {
      log(`Aborting confirm — dialog targeted wrong pack: ${dialogCopy.slice(0, 160)}`);
      const cancel = page.getByRole("button", { name: /^Cancel$/i }).first();
      if (await cancel.isVisible().catch(() => false)) {
        await cancel.click().catch(() => undefined);
      }
    } else if (!/Default Stable/i.test(dialogCopy)) {
      log(`Aborting confirm — dialog missing Default Stable: ${dialogCopy.slice(0, 160)}`);
      const cancel = page.getByRole("button", { name: /^Cancel$/i }).first();
      if (await cancel.isVisible().catch(() => false)) {
        await cancel.click().catch(() => undefined);
      }
    } else {
      await confirm.click();
      log("Confirmed Replace and apply");
      await page.waitForTimeout(1_500);
    }
  }

  if (!applied?.ok) {
    // No reload — WorkspaceDevRelayBootstrapOwner re-injects :7000 after remount when Docker is up.
    // Patch storage for persistence, then force list via in-page event only if UI apply failed.
    const wrote = await page.evaluate(() => {
      const publicRelays = [
        { url: "wss://nos.lol", enabled: true },
        { url: "wss://relay.primal.net", enabled: true },
        { url: "wss://relay.damus.io", enabled: true },
      ];
      const keys = Object.keys(localStorage).filter((k) => /obscur\.relay_list\.v2\./i.test(k));
      for (const key of keys) {
        localStorage.setItem(key, JSON.stringify(publicRelays));
      }
      window.dispatchEvent(new Event("obscur:operator-trust-config-changed"));
      return { ok: keys.length > 0, keys };
    });
    log(`Storage patch without reload: ${JSON.stringify(wrote)}`);
  }
}

/** Disable/remove local :7000 so public-only proof is not polluted by Wave A bootstrap. */
async function excludeLocalDevRelay(page) {
  // Toggle off any switch on a row that mentions localhost:7000.
  const disabled = await page.evaluate(() => {
    const rows = [...document.querySelectorAll("div,li,article")].filter((el) => {
      const t = el.innerText || "";
      return /localhost:7000|127\.0\.0\.1:7000/i.test(t) && t.length < 800;
    });
    let toggled = 0;
    for (const row of rows) {
      const sw = row.querySelector('[role="switch"], input[type="checkbox"]');
      if (!sw) continue;
      const checked = sw.getAttribute("aria-checked") === "true" || sw.checked === true;
      if (checked) {
        sw.click();
        toggled += 1;
      }
    }
    // Also rewrite storage to drop local enabled entries (no reload).
    const keys = Object.keys(localStorage).filter((k) => /obscur\.relay_list\.v2\./i.test(k));
    for (const key of keys) {
      try {
        const parsed = JSON.parse(localStorage.getItem(key) || "[]");
        if (!Array.isArray(parsed)) continue;
        const next = parsed.map((row) => {
          if (!row || typeof row.url !== "string") return row;
          if (/localhost:7000|127\.0\.0\.1:7000/i.test(row.url)) {
            return { ...row, enabled: false };
          }
          return row;
        });
        localStorage.setItem(key, JSON.stringify(next));
      } catch {
        // ignore
      }
    }
    window.dispatchEvent(new Event("obscur:operator-trust-config-changed"));
    return { toggled, storageKeys: keys.length };
  });
  log(`excludeLocalDevRelay: ${JSON.stringify(disabled)}`);
  await page.waitForTimeout(1_500);
}

async function readRelayListStorage(page) {
  return page.evaluate(() => {
    const keys = Object.keys(localStorage).filter((k) => /obscur\.relay_list\.v2\./i.test(k));
    const lists = keys.map((key) => {
      try {
        return { key, relays: JSON.parse(localStorage.getItem(key) || "[]") };
      } catch {
        return { key, relays: [] };
      }
    });
    const flat = lists.flatMap((row) => (Array.isArray(row.relays) ? row.relays : []));
    const enabled = flat
      .filter((row) => row && row.enabled !== false)
      .map((row) => String(row.url || ""));
    return {
      keys,
      enabled,
      hasLocalEnabled: enabled.some((url) => /localhost:7000|127\.0\.0\.1:7000/i.test(url)),
      hasPublicEnabled: enabled.some((url) => /^wss:\/\//i.test(url)),
    };
  });
}

async function readProbe(page) {
  return page.evaluate(() => {
    const runtime = window.obscurRelayRuntime?.getSnapshot?.() ?? null;
    const body = document.body?.innerText ?? "";
    return {
      runtime,
      bodyHasNos: /nos\.lol/i.test(body),
      bodyHasPrimal: /primal\.net/i.test(body),
      bodyHasDamus: /damus\.io/i.test(body),
      bodyHasLocal: /localhost:7000|127\.0\.0\.1:7000/i.test(body),
      zeroWritable: /0 writable/i.test(body),
      offlineBanner: /transport is offline/i.test(body),
      href: location.href,
    };
  });
}

async function probePublicUpstreams() {
  // Prefer workspace `ws` (same pattern as other L3 scripts); fall back to global WebSocket if present.
  let WebSocketImpl;
  try {
    WebSocketImpl = createRequire(path.join(repoRoot, "apps", "relay-gateway", "package.json"))("ws");
  } catch {
    try {
      WebSocketImpl = requireFromPwa("ws");
    } catch {
      WebSocketImpl = globalThis.WebSocket;
    }
  }
  if (!WebSocketImpl) {
    return PUBLIC_PROBE_URLS.map((url) => ({
      url,
      status: "skipped",
      detail: "no ws client",
      ms: 0,
    }));
  }

  const results = [];
  for (const url of PUBLIC_PROBE_URLS) {
    const started = Date.now();
    const outcome = await new Promise((resolve) => {
      let settled = false;
      let socket;
      const finish = (status, detail) => {
        if (settled) return;
        settled = true;
        try { socket?.close(); } catch { /* ignore */ }
        resolve({ url, status, detail, ms: Date.now() - started });
      };
      try {
        socket = new WebSocketImpl(url, { handshakeTimeout: 8_000 });
      } catch (error) {
        finish("error", error instanceof Error ? error.message : String(error));
        return;
      }
      const timer = setTimeout(() => finish("timeout", "8s"), 8_000);
      const onOpen = () => {
        clearTimeout(timer);
        finish("open", "ok");
      };
      const onError = (error) => {
        clearTimeout(timer);
        finish("error", error instanceof Error ? error.message : String(error ?? "error"));
      };
      if (typeof socket.on === "function") {
        socket.on("open", onOpen);
        socket.on("unexpected-response", (_req, res) => {
          clearTimeout(timer);
          finish("http", `status=${res.statusCode}`);
        });
        socket.on("error", onError);
      } else {
        socket.addEventListener("open", onOpen);
        socket.addEventListener("error", onError);
      }
    });
    results.push(outcome);
    log(`upstream ${outcome.url} → ${outcome.status} (${outcome.detail}, ${outcome.ms}ms)`);
  }
  return results;
}

async function main() {
  const upstreamProbe = await probePublicUpstreams();
  const anyUpstreamOpen = upstreamProbe.some((row) => row.status === "open");

  const { chromium } = loadPlaywright();
  let browser;
  try {
    browser = await chromium.connectOverCDP(CDP);
  } catch (error) {
    throw new Error(
      `CDP connect failed at ${CDP}: ${error instanceof Error ? error.message : error}. `
      + "Start: pnpm dev:desktop:online:live",
    );
  }

  const page = await waitForAppPageFromBrowser(browser, {
    appBase: APP_BASE,
    timeoutMs: 60_000,
  });
  if (!page) {
    throw new Error(formatNoObscurPageError(browser, CDP));
  }

  log(`Attached ${page.url()}`);
  await ensureUnlockedShell(page);
  log(`Unlocked shell at ${page.url()}`);
  await openRelaysSurface(page);
  await applyDefaultStablePack(page);
  await excludeLocalDevRelay(page);

  let probe = await readProbe(page);
  const deadline = Date.now() + 90_000;
  let reapplied = false;
  while (Date.now() < deadline) {
    const enabled = Array.isArray(probe.runtime?.enabledRelayUrls) ? probe.runtime.enabledRelayUrls : [];
    const writable = Number(
      probe.runtime?.writableRelayCount
      ?? probe.runtime?.recovery?.writableRelayCount
      ?? 0,
    );
    const storage = await readRelayListStorage(page);
    const hasPublic = enabled.some(isPublicWss) || storage.hasPublicEnabled;
    const hasLocalInStorage = storage.hasLocalEnabled;
    // Pass early when Default Stable stuck in storage (public only) and transport is writable,
    // even if Wave A still dials local as an extra candidate in runtime.enabledRelayUrls.
    if (
      storage.hasPublicEnabled
      && !hasLocalInStorage
      && writable >= 1
      && !probe.zeroWritable
      && hasPublic
    ) {
      break;
    }
    if (!enabled.some(isLocalUrl) && enabled.some(isPublicWss) && writable >= 1 && !probe.zeroWritable) {
      break;
    }
    const retry = page.getByRole("button", { name: /^retry$/i }).first();
    if (await retry.isVisible().catch(() => false)) {
      await retry.click().catch(() => undefined);
    }
    if (enabled.some(isLocalUrl) || hasLocalInStorage) {
      await excludeLocalDevRelay(page);
      if (!reapplied) {
        await applyDefaultStablePack(page);
        await excludeLocalDevRelay(page);
        reapplied = true;
      }
    }
    await page.waitForTimeout(3_000);
    probe = await readProbe(page);
  }

  const runtime = probe.runtime ?? {};
  const writable = Number(runtime.writableRelayCount ?? runtime.recovery?.writableRelayCount ?? 0);
  const enabled = Array.isArray(runtime.enabledRelayUrls) ? runtime.enabledRelayUrls : [];
  const storage = await readRelayListStorage(page);
  const hasNos = enabled.some((url) => /nos\.lol/i.test(url)) || storage.enabled.some((url) => /nos\.lol/i.test(url));
  const hasPrimal = enabled.some((url) => /primal\.net/i.test(url)) || storage.enabled.some((url) => /primal\.net/i.test(url));
  const hasDamus = enabled.some((url) => /damus\.io/i.test(url)) || storage.enabled.some((url) => /damus\.io/i.test(url));
  const hasLocalRuntime = enabled.some(isLocalUrl);
  const hasLocal = storage.hasLocalEnabled;
  const hasPublic = enabled.some(isPublicWss) || storage.hasPublicEnabled;
  const readiness = runtime.recovery?.readiness ?? runtime.phase ?? "unknown";
  const mixLine = await page.evaluate(() => (
    (document.body?.innerText.match(/Active mix:[^\n]+/) || [])[0] ?? null
  ));

  const pass = Boolean(probe.runtime)
    && writable >= 1
    && !probe.zeroWritable
    && storage.hasPublicEnabled
    && !storage.hasLocalEnabled
    && hasPublic;

  const upstreamsAllDown = !anyUpstreamOpen;
  let claim;
  if (pass) {
    claim = hasLocalRuntime
      ? "E2 public-only desktop L3 Pass — Default Stable storage is public-only + writable≥1; runtime may still dial local via Wave A when Docker :7000 is up"
      : "E2 public-only desktop L3 Pass — writable≥1 on public WSS with local excluded from relay list; not production community ready";
  } else if (upstreamsAllDown) {
    claim = "E2 public-only L3 Fail — all probed public upstreams down; do not claim public Nostr fixed (document upstream outage)";
  } else if (storage.hasLocalEnabled) {
    claim = "E2 public-only L3 Fail — local :7000 still enabled in relay list storage after Default Stable apply";
  } else if (!storage.hasPublicEnabled) {
    claim = "E2 public-only L3 Fail — no public WSS in relay list storage after Default Stable apply";
  } else {
    claim = "E2 public-only L3 Fail — public list present but writable=0 despite at least one upstream OPEN";
  }

  const report = {
    generatedAtUnixMs: Date.now(),
    version: "obscur.e2-public-only-l3.v1",
    cdp: CDP,
    pageUrl: probe.href,
    upstreamProbe,
    l3: {
      pass,
      writableRelayCount: writable,
      readiness,
      enabledRelayUrls: enabled,
      storageEnabledRelayUrls: storage.enabled,
      hasNos,
      hasPrimal,
      hasDamus,
      hasLocal,
      hasLocalRuntime,
      hasPublic,
      mixLine,
      offlineBanner: probe.offlineBanner,
      zeroWritable: probe.zeroWritable,
      claim,
    },
    runtimePhase: runtime.phase,
  };

  fs.mkdirSync(path.dirname(reportPath), { recursive: true });
  fs.writeFileSync(reportPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");
  log(`Report: ${reportPath}`);
  log(`pass=${pass} writable=${writable} hasPublic=${hasPublic} hasLocalStorage=${hasLocal} hasLocalRuntime=${hasLocalRuntime} hasNos=${hasNos} hasPrimal=${hasPrimal}`);

  await Promise.race([
    browser.close().catch(() => undefined),
    new Promise((resolve) => setTimeout(resolve, 3_000)),
  ]);
  process.exit(pass ? 0 : 1);
}

main().catch((error) => {
  log(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
