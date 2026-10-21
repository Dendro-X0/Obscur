#!/usr/bin/env node
/**
 * Chrome-plane quarantine unlock soak — CDP attach to running Tauri.
 * Does not claim Soft L3 Fixed. Expects OBSCUR_PERF_PLANE=chrome already running.
 *
 *   OBSCUR_CDP_URL=http://127.0.0.1:9230 node scripts/chrome-quarantine-unlock-soak.mjs
 */
import { createRequire } from "node:module";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { pickAppPageFromBrowser, waitForAppPageFromBrowser } from "./lib/cdp-app-page.mjs";
import {
  ensureTester1Unlocked,
  isShellUnlocked,
  enterMessengerFromProfilePicker,
} from "./lib/dev-lab-playwright-auth.mjs";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const requireFromPwa = createRequire(path.join(repoRoot, "apps", "pwa", "package.json"));
const CDP = process.env.OBSCUR_CDP_URL ?? "http://127.0.0.1:9230";
const journalPath =
  process.env.OBSCUR_INVOKE_JOURNAL
  ?? path.join(
    process.env.LOCALAPPDATA ?? "",
    "app.obscur.desktop",
    "diagnostics",
    "invoke-journal-latest.json",
  );

function loadPlaywright() {
  try {
    return requireFromPwa("playwright");
  } catch {
    return requireFromPwa("@playwright/test");
  }
}

const log = (...args) => console.log("[chrome-unlock]", ...args);

const readJournal = () => {
  try {
    return JSON.parse(fs.readFileSync(journalPath, "utf8"));
  } catch {
    return null;
  }
};

const summarizeJournal = (j) => {
  if (!j) return { total: null, top: [] };
  return {
    total: j.total ?? null,
    plane: j.perf_plane ?? null,
    top: Array.isArray(j.top) ? j.top.slice(0, 8) : [],
  };
};

/** Deadly unlock stampede class (E35) — soft-stubbed workspace IPC alone is not a fail. */
const hasStorm = (j) => {
  const top = Array.isArray(j?.top) ? j.top.join(" ") : "";
  const recent = JSON.stringify(j?.recent ?? []);
  const blob = `${top} ${recent}`;
  if (/listTombstones|sign_event_native|sign_kind:|get_tor_status/.test(blob)) {
    // Soft stubs for these still count as JS not quarantined.
    if (/perf_plane:stub:.*listTombstones/.test(blob) || /perf_plane:reject:sign/.test(blob)) {
      return true;
    }
    if (/listTombstones|sign_event_native/.test(blob) && !/perf_plane:stub:eng:workspace/.test(blob)) {
      return true;
    }
  }
  if (/listTombstones|sign_event_native|sign_kind:30315|sign_kind:30078/.test(blob)) {
    return true;
  }
  return false;
};

const main = async () => {
  const { chromium } = loadPlaywright();
  const before = summarizeJournal(readJournal());
  log("before", JSON.stringify(before));

  const browser = await chromium.connectOverCDP(CDP);
  const page =
    (await waitForAppPageFromBrowser(browser, { timeoutMs: 30_000 }).catch(() => null))
    ?? pickAppPageFromBrowser(browser);
  if (!page) {
    throw new Error(`No Obscur page on ${CDP}`);
  }
  log("page", page.url());

  const plane = await page.evaluate(() => ({
    plane: window.__OBSCUR_PERF_PLANE__,
    online: window.__OBSCUR_EXPERIMENT_ONLINE,
    href: location.href,
  }));
  log("boot", JSON.stringify(plane));
  if (plane.plane !== "chrome") {
    throw new Error(`expected __OBSCUR_PERF_PLANE__=chrome got ${plane.plane}`);
  }

  await enterMessengerFromProfilePicker(page, { log });
  await ensureTester1Unlocked(page, { log, timeoutMs: 120_000 });
  const unlocked = await isShellUnlocked(page);
  log("unlocked", unlocked, page.url());

  // Settings + short soak
  const settingsLink = page.getByRole("link", { name: /^settings$/i }).first();
  if (await settingsLink.isVisible().catch(() => false)) {
    await settingsLink.click().catch(() => undefined);
  } else {
    await page.evaluate(() => {
      const a = [...document.querySelectorAll("a")].find((el) => /settings/i.test(el.textContent ?? ""));
      a?.click();
    }).catch(() => undefined);
  }
  await page.waitForTimeout(8_000);
  // Scroll main
  await page.evaluate(() => {
    const main = document.querySelector("main") || document.scrollingElement;
    if (main) {
      main.scrollTop = Math.min(main.scrollHeight, 800);
    }
  }).catch(() => undefined);
  await page.waitForTimeout(12_000);

  const ui = await page.evaluate(() => {
    const text = (document.querySelector("main")?.innerText ?? document.body?.innerText ?? "").slice(0, 1200);
    return {
      href: location.href,
      fatal: /Oops|fatal render/i.test(text),
      restoring: /Restoring account data/i.test(text),
      localOnly: /LOCAL ONLY|account sync deferred|Experiment shell/i.test(text),
      snippet: text.slice(0, 400),
    };
  });
  log("ui", JSON.stringify(ui));

  const after = summarizeJournal(readJournal());
  const full = readJournal();
  log("after", JSON.stringify(after));
  log("storm", hasStorm(full));

  const out = {
    unlocked,
    plane: plane.plane,
    before,
    after,
    storm: hasStorm(full),
    ui,
    journalPath,
  };
  const outPath = path.join(repoRoot, ".codectx", "verify", "chrome-quarantine-unlock-soak-latest.json");
  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  fs.writeFileSync(outPath, `${JSON.stringify(out, null, 2)}\n`);
  log("wrote", outPath);

  await browser.close().catch(() => undefined);

  const pressureClimb = (
    typeof before.total === "number"
    && typeof after.total === "number"
    && after.total - before.total > 60
  );
  if (!unlocked || ui.fatal || ui.restoring || hasStorm(full) || pressureClimb || (after.total != null && after.total > 120)) {
    process.exit(2);
  }
};

main().catch((err) => {
  console.error("[chrome-unlock] FAIL", err);
  process.exit(1);
});
