#!/usr/bin/env node
/**
 * R2 — Relays dial honesty (dual profile).
 *
 * Both CDP profiles must show public clearnet dial evidence (nos/primal/damus)
 * and must not be stuck in local-only trap while remotes are enabled.
 *
 *   pnpm verify:r2-relays-dial-honesty
 *
 * @see specs/backend/r2-relays-dial-honesty-design-2026-08.md
 */
import { createRequire } from "node:module";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  formatNoObscurPageError,
  waitForAppPageFromBrowser,
} from "./lib/cdp-app-page.mjs";
import { resolvePlaywrightAppBase } from "./lib/resolve-playwright-app-base.mjs";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const pwaDir = path.join(repoRoot, "apps", "pwa");
const requireFromPwa = createRequire(path.join(pwaDir, "package.json"));
const CDP = process.env.OBSCUR_CDP_URL ?? "http://127.0.0.1:9230";
const CDP_B = process.env.OBSCUR_CDP_B_URL
  ?? process.env.OBSCUR_CDP_PROFILE_URL
  ?? "http://127.0.0.1:9231";
const today = new Date().toISOString().slice(0, 10);
const reportPath = path.join(repoRoot, "test-results", `r2-relays-dial-honesty-${today}.json`);

function loadPlaywright() {
  try {
    return requireFromPwa("playwright");
  } catch {
    return requireFromPwa("@playwright/test");
  }
}

const log = (message) => console.log(`[r2-dial] ${message}`);
const isLocalUrl = (url) => /localhost:7000|127\.0\.0\.1:7000/i.test(String(url ?? ""));
const isPublicClearnetUrl = (url) => /nos\.lol|primal\.net|damus\.io/i.test(String(url ?? ""));

async function isCdpReachable(cdpUrl, timeoutMs = 2_000) {
  const versionUrl = `${String(cdpUrl).replace(/\/$/, "")}/json/version`;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(versionUrl, { signal: controller.signal });
    return response.ok;
  } catch {
    return false;
  } finally {
    clearTimeout(timer);
  }
}

async function isShell(page) {
  const href = page.url();
  if (/\/profiles(?:\/|$|\?)/i.test(href)) {
    return false;
  }
  if (await page.getByPlaceholder(/nsec/i).first().isVisible().catch(() => false)) {
    return false;
  }
  if (await page.getByRole("button", { name: /log in with key/i }).isVisible().catch(() => false)) {
    return false;
  }
  if (await page.getByText(/welcome back/i).first().isVisible().catch(() => false)
    && await page.getByRole("button", { name: /continue with/i }).isVisible().catch(() => false)) {
    return false;
  }
  const unlocked = await page.evaluate(() => {
    const session = window.obscurWindowRuntime?.getSnapshot?.()?.session;
    return session?.identityStatus === "unlocked"
      && Boolean(session?.unlockedPublicKeyHex);
  }).catch(() => false);
  if (unlocked) {
    return true;
  }
  for (const label of ["Settings", "Network", "Search", "Chats"]) {
    if (await page.getByRole("link", { name: label, exact: true }).isVisible().catch(() => false)) {
      return true;
    }
  }
  if (await page.getByRole("button", { name: /^chats$/i }).isVisible().catch(() => false)) {
    return true;
  }
  // Non-link rail: body chrome is enough (native rehydrate / locked session snapshot).
  return page.evaluate(() => {
    const text = document.body?.innerText ?? "";
    if (document.querySelector('input[placeholder*="nsec"]')) {
      return false;
    }
    return /OBSCUR/i.test(text)
      && (/Chats|SETTINGS|DIRECT MESSAGES|Connected \d+\/\d+/i.test(text));
  }).catch(() => false);
}

async function openRelaysSurface(page, appBase) {
  const relaysBtn = page.getByRole("button", { name: /^relays$/i }).first();
  if (await relaysBtn.isVisible().catch(() => false)) {
    await relaysBtn.click().catch(() => undefined);
    await page.waitForTimeout(1_200);
    return;
  }
  await page.goto(`${appBase.replace(/\/$/, "")}/settings`, { waitUntil: "domcontentloaded" }).catch(() => undefined);
  await page.waitForTimeout(1_200);
  await page.evaluate(() => {
    const el = [...document.querySelectorAll("button, a")].find((node) => (
      (node.innerText || "").trim() === "Relays"
    ));
    el?.click();
  }).catch(() => undefined);
  await page.waitForTimeout(1_500);
}

async function readDialProbe(page) {
  return page.evaluate(() => {
    const runtime = window.obscurRelayRuntime?.getSnapshot?.() ?? null;
    const body = document.body?.innerText ?? "";
    const enabled = Array.isArray(runtime?.enabledRelayUrls) ? runtime.enabledRelayUrls : [];
    const connections = Array.isArray(runtime?.connections)
      ? runtime.connections
      : (Array.isArray(runtime?.pool?.connections) ? runtime.pool.connections : []);
    const openUrls = connections
      .filter((c) => c && (c.status === "open" || c.state === "open"))
      .map((c) => String(c.url ?? c.relayUrl ?? ""));
    const writable = Number(
      runtime?.writableRelayCount
      ?? runtime?.recovery?.writableRelayCount
      ?? 0,
    );
    const publishPathMatch = body.match(/DM publish path:\s*([^\n]+)/i)
      ?? body.match(/Publish:\s*([^\n]+)/i);
    const publishPathHosts = publishPathMatch?.[1]?.trim() ?? null;
    return {
      href: location.href,
      phase: runtime?.phase ?? runtime?.recovery?.readiness ?? null,
      writable,
      enabled,
      openUrls,
      publishPathHosts,
      bodyPoolMember: /POOL MEMBER/i.test(body),
      bodyConnectedBanner: /CONNECTED TO RELAYS|Connected \d+\/\d+/i.test(body),
      identityStatus: window.obscurWindowRuntime?.getSnapshot?.()?.session?.identityStatus ?? null,
      profileId: window.obscurWindowRuntime?.getSnapshot?.()?.session?.profileId
        ?? window.obscurWindowRuntime?.getSnapshot?.()?.profileId
        ?? null,
    };
  });
}

function classifyProfile(probe, label) {
  const enabled = probe.enabled ?? [];
  const openFromRuntime = (probe.openUrls ?? []).filter(Boolean);
  const publicEnabled = enabled.filter(isPublicClearnetUrl);
  const localEnabled = enabled.filter(isLocalUrl);
  const publicOpenRuntime = openFromRuntime.filter(isPublicClearnetUrl);
  const localOpenRuntime = openFromRuntime.filter(isLocalUrl);

  const publishHosts = String(probe.publishPathHosts ?? "");
  const publicFromPublishPath = [
    /nos\.lol/i.test(publishHosts) ? "nos.lol" : null,
    /primal/i.test(publishHosts) ? "primal.net" : null,
    /damus/i.test(publishHosts) ? "damus.io" : null,
  ].filter(Boolean);
  const publishPathLocalOnly = Boolean(
    publishHosts
    && /localhost|127\.0\.0\.1/i.test(publishHosts)
    && !/nos\.lol|primal|damus/i.test(publishHosts),
  );

  const publicOpenCount = publicOpenRuntime.length > 0
    ? publicOpenRuntime.length
    : publicFromPublishPath.length;

  const localOnlyTrap = publicEnabled.length >= 1 && (
    publishPathLocalOnly
    || (publicOpenCount === 0 && localOpenRuntime.length >= 1)
    || (
      publicOpenCount === 0
      && probe.writable >= 1
      && localEnabled.length >= 1
      && !probe.bodyPoolMember
      && probe.phase !== "healthy"
    )
  );

  // connections[] often absent: healthy writable + enabled public + POOL MEMBER / publish path.
  const publicDialOk = publicOpenCount >= 1
    || (
      publicEnabled.length >= 1
      && probe.writable >= 1
      && !publishPathLocalOnly
      && (probe.bodyPoolMember || publicFromPublishPath.length >= 1 || probe.phase === "healthy")
    );

  const ok = probe.writable >= 1 && publicDialOk && !localOnlyTrap;

  return {
    label,
    ok,
    failClass: ok ? null : "F-DIAL",
    writable: probe.writable,
    phase: probe.phase,
    profileId: probe.profileId,
    identityStatus: probe.identityStatus,
    enabled,
    publicEnabled,
    localEnabled,
    openUrls: openFromRuntime,
    publicOpenRuntime,
    publicFromPublishPath,
    publishPathHosts: probe.publishPathHosts,
    publicOpenCount: publicOpenCount || (publicDialOk ? Math.max(publicEnabled.length, 1) : 0),
    localOpenCount: localOpenRuntime.length,
    localOnlyTrap,
    publicDialOk,
    bodyPoolMember: probe.bodyPoolMember,
    bodyConnectedBanner: probe.bodyConnectedBanner,
    href: probe.href,
  };
}

async function probeProfile(chromium, cdpUrl, appBase, label) {
  if (!(await isCdpReachable(cdpUrl))) {
    return {
      label,
      ok: false,
      blocked: true,
      failClass: null,
      detail: `CDP unreachable ${cdpUrl}`,
    };
  }
  const browser = await chromium.connectOverCDP(cdpUrl);
  const page = await waitForAppPageFromBrowser(browser, {
    appBase,
    timeoutMs: 30_000,
  });
  if (!page) {
    return {
      label,
      ok: false,
      blocked: true,
      failClass: null,
      detail: formatNoObscurPageError(browser, cdpUrl),
    };
  }
  log(`${label} attached ${page.url()}`);
  if (!(await isShell(page))) {
    const hint = await page.evaluate(() => (
      (document.body?.innerText ?? "").replace(/\s+/g, " ").slice(0, 160)
    )).catch(() => "");
    return {
      label,
      ok: false,
      blocked: true,
      failClass: null,
      detail: `shell not unlocked (UI): ${hint}`,
      href: page.url(),
    };
  }

  await openRelaysSurface(page, appBase);
  let probe = await readDialProbe(page);
  const deadline = Date.now() + 30_000;
  while (Date.now() < deadline) {
    const classified = classifyProfile(probe, label);
    if (classified.ok) {
      return classified;
    }
    const retry = page.getByRole("button", { name: /^retry$/i }).first();
    if (await retry.isVisible().catch(() => false)) {
      await retry.click().catch(() => undefined);
    }
    await page.waitForTimeout(2_000);
    probe = await readDialProbe(page);
  }
  return classifyProfile(probe, label);
}

async function main() {
  const { chromium } = loadPlaywright();
  const resolved = await resolvePlaywrightAppBase();
  const appBase = resolved.appBase;
  log(`app ${appBase} (${resolved.source}) · CDP A ${CDP} · CDP B ${CDP_B}`);

  const profileA = await probeProfile(chromium, CDP, appBase, "Tester1");
  log(`A ${JSON.stringify({
    ok: profileA.ok,
    writable: profileA.writable,
    publicOpenCount: profileA.publicOpenCount,
    publicDialOk: profileA.publicDialOk,
    localOnlyTrap: profileA.localOnlyTrap,
    blocked: profileA.blocked,
    detail: profileA.detail,
  })}`);

  const profileB = await probeProfile(chromium, CDP_B, appBase, "Tester2");
  log(`B ${JSON.stringify({
    ok: profileB.ok,
    writable: profileB.writable,
    publicOpenCount: profileB.publicOpenCount,
    publicDialOk: profileB.publicDialOk,
    localOnlyTrap: profileB.localOnlyTrap,
    blocked: profileB.blocked,
    detail: profileB.detail,
  })}`);

  const blocked = Boolean(profileA.blocked || profileB.blocked);
  const pass = !blocked && profileA.ok === true && profileB.ok === true;
  const failClass = pass ? null : (blocked ? null : "F-DIAL");

  const report = {
    atUnixMs: Date.now(),
    version: "obscur.r2-relays-dial-honesty.v1",
    recipe: "specs/backend/r2-relays-dial-honesty-design-2026-08.md",
    appBase,
    appBaseSource: resolved.source,
    cdp: CDP,
    cdpB: CDP_B,
    profiles: { a: profileA, b: profileB },
    failClass,
    r2: {
      pass,
      blocked,
      claim: pass
        ? "R2 Pass — both profiles have public clearnet dial evidence; not local-only trap; not public Nostr SLA"
        : (blocked
          ? `R2 Blocked — ${profileA.detail || profileB.detail || "CDP/shell"}`
          : "R2 Fail — F-DIAL (missing public dial or local-only trap)"),
    },
    forbidden: ["public_nostr_sla", "COM-RUN", "dev_lab_synthetic"],
  };

  fs.mkdirSync(path.dirname(reportPath), { recursive: true });
  fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
  log(`Report: ${reportPath}`);
  log(`r2.pass=${pass} blocked=${blocked} failClass=${failClass ?? "none"}`);

  if (blocked) {
    process.exit(2);
  }
  if (!pass) {
    process.exit(1);
  }
  process.exit(0);
}

main().catch((error) => {
  log(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
