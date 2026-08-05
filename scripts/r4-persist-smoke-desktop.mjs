#!/usr/bin/env node
/**
 * R4 — Persist smoke: send marker → WebView reload → thread still shows marker.
 *
 * Automated proxy for quit→relaunch. Not O-2 cold-process VERIFIED.
 * No Dev Lab synthetic send.
 *
 *   pnpm verify:r4-persist-smoke
 *
 * @see specs/backend/r4-persist-smoke-design-2026-08.md
 */
import { createRequire } from "node:module";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  formatNoObscurPageError,
  waitForAppPageFromBrowser,
} from "./lib/cdp-app-page.mjs";
import { ensureTester1Unlocked, enterMessengerFromProfilePicker } from "./lib/dev-lab-playwright-auth.mjs";
import { resolvePlaywrightAppBase } from "./lib/resolve-playwright-app-base.mjs";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const pwaDir = path.join(repoRoot, "apps", "pwa");
const requireFromPwa = createRequire(path.join(pwaDir, "package.json"));
const CDP = process.env.OBSCUR_CDP_URL ?? "http://127.0.0.1:9230";
const TESTER1_PUBKEY = "e07f67dcb8a58f53b13fd15ae549c31fb3817a3a6cf0e8bd6903bae3c191ea56";
const TESTER2_PUBKEY = "3db055b47e05bdfb9083efec0b7aecd2a045dbf7d865cf4d95d98817d946830f";
const TESTER2_FRIEND_CODE = "OBSCUR-GBKMBC";
const today = new Date().toISOString().slice(0, 10);
const reportPath = path.join(repoRoot, "test-results", `r4-persist-smoke-${today}.json`);
const MARKER = `R4-PERSIST-${Date.now().toString(36)}`;

function loadPlaywright() {
  try {
    return requireFromPwa("playwright");
  } catch {
    return requireFromPwa("@playwright/test");
  }
}

const log = (message) => console.log(`[r4-persist] ${message}`);

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
  if (/\/profiles(?:\/|$|\?)/i.test(page.url())) {
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
  return page.evaluate(() => {
    const text = document.body?.innerText ?? "";
    if (document.querySelector('input[placeholder*="nsec"]')) {
      return false;
    }
    return /OBSCUR/i.test(text)
      && (/Chats|SETTINGS|DIRECT MESSAGES|Connected \d+\/\d+/i.test(text));
  }).catch(() => false);
}

async function attachPage(chromium, cdpUrl, appBase, { requireShell = true } = {}) {
  if (!(await isCdpReachable(cdpUrl))) {
    return { ok: false, blocked: true, detail: `CDP unreachable ${cdpUrl}` };
  }
  const browser = await chromium.connectOverCDP(cdpUrl);
  const page = await waitForAppPageFromBrowser(browser, { appBase, timeoutMs: 30_000 });
  if (!page) {
    return { ok: false, blocked: true, detail: formatNoObscurPageError(browser, cdpUrl) };
  }
  log(`attached ${page.url()}`);
  if (requireShell && !(await isShell(page))) {
    const hint = await page.evaluate(() => (
      (document.body?.innerText ?? "").replace(/\s+/g, " ").slice(0, 120)
    )).catch(() => "");
    return { ok: false, blocked: true, detail: `shell not unlocked: ${hint}`, page, browser };
  }
  return { ok: true, page, browser };
}

async function ensureLivePage(chromium, cdpUrl, appBase, page, browser) {
  if (page && !page.isClosed()) {
    return { ok: true, page, browser };
  }
  log("page closed — reconnecting CDP…");
  try {
    await browser?.close?.();
  } catch {
    // ignore
  }
  return attachPage(chromium, cdpUrl, appBase, { requireShell: false });
}

async function seedAcceptedPeer(page, ownerPublicKeyHex, peerPublicKeyHex) {
  return page.evaluate(({ owner, peer }) => {
    const key = `obscur.peer_trust.v1.${owner}`;
    let parsed = { acceptedPeers: [], mutedPeers: [] };
    try {
      parsed = JSON.parse(localStorage.getItem(key) ?? '{"acceptedPeers":[],"mutedPeers":[]}');
    } catch {
      // ignore
    }
    const acceptedPeers = Array.from(new Set([...(parsed.acceptedPeers ?? []), peer]));
    const next = JSON.stringify({
      ...parsed,
      acceptedPeers,
      mutedPeers: parsed.mutedPeers ?? [],
    });
    localStorage.setItem(key, next);
    window.dispatchEvent(new StorageEvent("storage", { key, newValue: next }));
    return acceptedPeers.map((p) => String(p).toLowerCase()).includes(peer);
  }, {
    owner: String(ownerPublicKeyHex).toLowerCase(),
    peer: String(peerPublicKeyHex).toLowerCase(),
  });
}

async function seedSendCeremonyAck(page, peerPublicKeyHex, profileId = "default") {
  return page.evaluate(({ peer, profile }) => {
    const key = `obscur.send_ceremony.v1::${peer}::${profile}`;
    localStorage.setItem(key, "1");
    return key;
  }, {
    peer: String(peerPublicKeyHex).toLowerCase(),
    profile: profileId,
  });
}

async function diagnoseCompose(page) {
  return page.evaluate(() => {
    const placeholders = [...document.querySelectorAll("input, textarea")]
      .map((el) => el.getAttribute("placeholder") || el.getAttribute("aria-label") || el.tagName)
      .slice(0, 12);
    return {
      url: location.href,
      textareas: document.querySelectorAll("textarea").length,
      placeholders,
      bodyHint: (document.body?.innerText ?? "").replace(/\s+/g, " ").slice(0, 220),
    };
  }).catch((error) => ({ error: String(error?.message ?? error) }));
}

function composeLocator(page) {
  // Strict DM compose — avoid arbitrary textarea (false "already open" → CDP death).
  return page.getByPlaceholder(/type a (private )?message|type a message/i);
}

async function openPeerCompose(page, peerName, peerPubkey, friendCode) {
  if (page.isClosed()) {
    return false;
  }
  const composeOk = async () => {
    if (page.isClosed()) {
      return false;
    }
    return composeLocator(page).first().isVisible().catch(() => false);
  };

  try {
    const chats = page.getByRole("link", { name: /^chats$/i }).first()
      .or(page.getByRole("button", { name: /^chats$/i }).first());
    if (await chats.isVisible().catch(() => false)) {
      await chats.click().catch(() => undefined);
      await page.waitForTimeout(1_000);
    }

    if (await composeOk()) {
      log("compose already open — will still prefer named peer open");
    }

    const nameHit = page.getByText(new RegExp(peerName, "i")).first();
    if (await nameHit.isVisible().catch(() => false)) {
      await nameHit.click().catch(() => undefined);
      await page.waitForTimeout(1_200);
      if (await composeOk()) {
        log(`compose via name ${peerName}`);
        return true;
      }
    }

    const hexPrefix = String(peerPubkey).slice(0, 8);
    const byHex = page.getByText(new RegExp(hexPrefix, "i")).first();
    if (await byHex.isVisible().catch(() => false)) {
      await byHex.click().catch(() => undefined);
      await page.waitForTimeout(1_200);
      if (await composeOk()) {
        log(`compose via hex ${hexPrefix}`);
        return true;
      }
    }

    const search = page.getByPlaceholder(/search users|search/i).first();
    if (await search.isVisible().catch(() => false) && friendCode) {
      await search.click().catch(() => undefined);
      await search.fill("");
      await search.fill(friendCode).catch(() => undefined);
      await page.waitForTimeout(2_500);
      const result = page.getByText(new RegExp(peerName, "i")).first()
        .or(page.getByText(new RegExp(String(friendCode).replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i")).first());
      if (await result.isVisible().catch(() => false)) {
        await result.click().catch(() => undefined);
        await page.waitForTimeout(1_200);
        const messageBtn = page.getByRole("button", { name: /^Message$/i }).first();
        if (await messageBtn.isVisible().catch(() => false)) {
          await messageBtn.click().catch(() => undefined);
          await page.waitForTimeout(1_500);
        }
        if (await composeOk()) {
          log("compose via friend-code search");
          return true;
        }
      }
    }

    const origin = new URL(page.url()).origin;
    await page.goto(`${origin}/network/${peerPubkey}`, { waitUntil: "domcontentloaded" }).catch(() => undefined);
    await page.waitForTimeout(1_500);
    const messageBtn = page.getByRole("button", { name: /^Message$/i }).first();
    if (await messageBtn.isVisible().catch(() => false)) {
      await messageBtn.click().catch(() => undefined);
      await page.waitForTimeout(1_500);
    }
    if (await composeOk()) {
      log("compose via /network peer");
      return true;
    }

    const deadline = Date.now() + 8_000;
    while (Date.now() < deadline) {
      if (page.isClosed()) {
        return false;
      }
      if (await composeOk()) {
        return true;
      }
      await page.waitForTimeout(400);
    }
    log(`compose missing diag ${JSON.stringify(await diagnoseCompose(page))}`);
    return false;
  } catch (error) {
    log(`openPeerCompose error: ${error instanceof Error ? error.message : String(error)}`);
    return false;
  }
}

async function hideBlockingOverlays(page) {
  await page.evaluate(() => {
    for (const el of document.querySelectorAll('[title="Ghost Protocol (Dev Mode)"]')) {
      const host = el.closest("div.fixed") ?? el;
      host.style.setProperty("display", "none", "important");
      host.style.setProperty("pointer-events", "none", "important");
    }
    for (const el of document.querySelectorAll("[role='alert'], .fixed")) {
      const text = (el.innerText || "").slice(0, 80);
      if (/relay connection issue|couldn't reach relay/i.test(text)) {
        el.style.setProperty("pointer-events", "none", "important");
      }
    }
  }).catch(() => undefined);
}

async function sendMarker(page, marker) {
  if (page.isClosed()) {
    return { ok: false, reason: "page_closed" };
  }
  await hideBlockingOverlays(page);
  // Prefer textarea placeholder substring — getByPlaceholder visible can flake under toasts.
  const compose = page.locator('textarea[placeholder*="message" i]').first()
    .or(composeLocator(page).first());
  try {
    await compose.waitFor({ state: "attached", timeout: 8_000 });
  } catch {
    log(`send compose_missing diag ${JSON.stringify(await diagnoseCompose(page))}`);
    return { ok: false, reason: "compose_missing" };
  }
  if (await compose.isDisabled().catch(() => false)) {
    return { ok: false, reason: "compose_disabled" };
  }
  await compose.click({ force: true, timeout: 5_000 }).catch(() => undefined);
  await compose.fill("");
  await compose.pressSequentially(marker, { delay: 8 });
  await page.keyboard.press("Enter").catch(() => undefined);
  await page.waitForTimeout(600);
  let stuck = (await compose.inputValue().catch(() => "")).includes(marker);
  if (stuck) {
    const sendBtn = page.locator('button[aria-label="Send"]').last()
      .or(page.getByRole("button", { name: /^send$/i }).first());
    if (await sendBtn.count().catch(() => 0)) {
      await sendBtn.click({ force: true }).catch(() => undefined);
      await page.waitForTimeout(800);
    }
    const ceremony = page.getByTestId("send-ceremony-dialog");
    if (await ceremony.isVisible().catch(() => false)) {
      await ceremony.getByRole("button", { name: /send to this identity|confirm/i }).first()
        .click({ force: true }).catch(() => undefined);
      await page.waitForTimeout(800);
    }
  }
  stuck = (await compose.inputValue().catch(() => "")).includes(marker);
  const visible = await page.getByText(marker, { exact: true }).first().isVisible().catch(() => false)
    || await page.evaluate((m) => (document.body?.innerText ?? "").includes(m), marker).catch(() => false);
  if (stuck && !visible) {
    return { ok: false, reason: "marker_stuck_in_compose" };
  }
  return {
    ok: Boolean(visible),
    reason: visible ? "sent_visible_local" : "marker_not_visible",
  };
}

async function markerVisible(page, marker) {
  if (!page || page.isClosed()) {
    return false;
  }
  try {
    const byText = await Promise.race([
      page.getByText(marker, { exact: true }).first().isVisible().catch(() => false),
      new Promise((resolve) => setTimeout(() => resolve(false), 2_000)),
    ]);
    if (byText) {
      return true;
    }
    return await Promise.race([
      page.evaluate((m) => (document.body?.innerText ?? "").includes(m), marker),
      new Promise((resolve) => setTimeout(() => resolve(false), 3_000)),
    ]);
  } catch {
    return false;
  }
}

async function waitForMarker(page, marker, timeoutMs = 60_000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (await markerVisible(page, marker)) {
      return true;
    }
    await new Promise((resolve) => setTimeout(resolve, 1_000));
  }
  return false;
}

async function writeReport(report, exitCode) {
  fs.mkdirSync(path.dirname(reportPath), { recursive: true });
  fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
  log(`Report: ${reportPath}`);
  // CDP attach keeps the event loop alive — exit explicitly.
  process.exit(exitCode);
}

async function readSoftL3MarkerCorroboration() {
  const softPath = path.join(repoRoot, "test-results", `s-pool-delivery-l3-${today}.json`);
  if (!fs.existsSync(softPath)) {
    return null;
  }
  try {
    const report = JSON.parse(fs.readFileSync(softPath, "utf8"));
    const marker = report?.rows?.B_twoProfileDm?.marker ?? report?.marker;
    const pass = report?.l3?.pass === true || report?.rows?.B_twoProfileDm?.pass === true;
    const fAck = report?.l3?.fAck === true || report?.rows?.B_twoProfileDm?.publishAck === true;
    if (pass && fAck && typeof marker === "string" && marker.length > 0) {
      return { marker, softPath };
    }
  } catch {
    // ignore
  }
  return null;
}

async function openPeerThreadOnly(page, peerName, peerPubkey, friendCode) {
  // Open thread chrome enough to show history — compose optional.
  const chats = page.getByRole("link", { name: /^chats$/i }).first()
    .or(page.getByRole("button", { name: /^chats$/i }).first());
  if (await chats.isVisible().catch(() => false)) {
    await chats.click().catch(() => undefined);
    await page.waitForTimeout(1_000);
  }
  const nameHit = page.getByText(new RegExp(peerName, "i")).first();
  if (await nameHit.isVisible().catch(() => false)) {
    await nameHit.click().catch(() => undefined);
    await page.waitForTimeout(1_200);
    return true;
  }
  const hexPrefix = String(peerPubkey).slice(0, 8);
  const byHex = page.getByText(new RegExp(hexPrefix, "i")).first();
  if (await byHex.isVisible().catch(() => false)) {
    await byHex.click().catch(() => undefined);
    await page.waitForTimeout(1_200);
    return true;
  }
  const search = page.getByPlaceholder(/search users|search/i).first();
  if (await search.isVisible().catch(() => false) && friendCode) {
    await search.fill(friendCode).catch(() => undefined);
    await page.waitForTimeout(2_000);
    const result = page.getByText(new RegExp(peerName, "i")).first();
    if (await result.isVisible().catch(() => false)) {
      await result.click().catch(() => undefined);
      await page.waitForTimeout(1_200);
      return true;
    }
  }
  return openPeerCompose(page, peerName, peerPubkey, friendCode);
}

async function main() {
  const { chromium } = loadPlaywright();
  const resolved = await resolvePlaywrightAppBase();
  const appBase = resolved.appBase;
  log(`app ${appBase} (${resolved.source}) · fresh marker ${MARKER}`);

  let attached = await attachPage(chromium, CDP, appBase);
  if (!attached.ok) {
    await writeReport({
      atUnixMs: Date.now(),
      r4: { pass: false, blocked: true, claim: `R4 Blocked — ${attached.detail}` },
      marker: MARKER,
      detail: attached.detail,
    }, 2);
  }

  let page = attached.page;
  let browser = attached.browser;
  await seedAcceptedPeer(page, TESTER1_PUBKEY, TESTER2_PUBKEY).catch(() => undefined);
  await seedSendCeremonyAck(page, TESTER2_PUBKEY).catch(() => undefined);

  let marker = MARKER;
  let send = { ok: false, reason: "not_attempted" };
  let seedSource = "fresh_compose";

  let opened = await openPeerCompose(page, "Tester2", TESTER2_PUBKEY, TESTER2_FRIEND_CODE);
  if (opened && !page.isClosed()) {
    send = await sendMarker(page, marker);
    log(`send ${JSON.stringify(send)}`);
  } else {
    log(`fresh compose open failed (opened=${opened}, closed=${page.isClosed()})`);
  }

  if (!send.ok || page.isClosed()) {
    try {
      await browser?.close?.();
    } catch {
      // ignore
    }
    const live = await attachPage(chromium, CDP, appBase, { requireShell: false });
    if (!live.ok) {
      await writeReport({
        atUnixMs: Date.now(),
        r4: { pass: false, blocked: true, claim: `R4 Blocked — ${live.detail}` },
        marker,
        send,
      }, 2);
    }
    page = live.page;
    browser = live.browser;
    if (!(await isShell(page))) {
      await ensureTester1Unlocked(page, { log, timeoutMs: 60_000 }).catch((error) => {
        log(`re-unlock: ${error instanceof Error ? error.message : String(error)}`);
      });
    }
    const soft = await readSoftL3MarkerCorroboration();
    if (!soft) {
      await writeReport({
        atUnixMs: Date.now(),
        r4: {
          pass: false,
          blocked: true,
          claim: `R4 Blocked — fresh send failed (${send.reason}) and no Soft L3 marker corroboration today`,
        },
        marker,
        send,
      }, 2);
    }
    marker = soft.marker;
    seedSource = "soft_l3_corroboration";
    log(`falling back to Soft L3 marker ${marker}`);
    opened = await openPeerThreadOnly(page, "Tester2", TESTER2_PUBKEY, TESTER2_FRIEND_CODE);
    const softVisible = opened ? await waitForMarker(page, marker, 25_000) : false;
    if (!softVisible) {
      await writeReport({
        atUnixMs: Date.now(),
        r4: {
          pass: false,
          blocked: true,
          claim: `R4 Blocked — Soft L3 marker ${marker} not visible before reload (opened=${opened})`,
        },
        marker,
        send,
        seedSource,
        before: { visible: false, opened },
      }, 2);
    }
    send = { ok: true, reason: "soft_l3_corroboration", softPath: soft.softPath };
  }

  const beforeVisible = opened
    ? await waitForMarker(page, marker, 20_000)
    : false;
  log(`before reload markerVisible=${beforeVisible} source=${seedSource}`);
  if (!beforeVisible) {
    await writeReport({
      atUnixMs: Date.now(),
      r4: { pass: false, blocked: false, claim: "R4 Fail — marker missing before reload" },
      marker,
      send,
      seedSource,
      before: { visible: false },
      after: { visible: false },
    }, 1);
  }

  log("reloading native WebView…");
  // Hard reload often drops/zombies the CDP page handle on Tauri — always reconnect after.
  await Promise.race([
    page.reload({ waitUntil: "commit", timeout: 12_000 }),
    new Promise((resolve) => setTimeout(resolve, 12_000)),
  ]).catch((error) => {
    log(`reload error: ${error instanceof Error ? error.message : String(error)}`);
  });

  {
    log("forcing CDP reconnect after reload…");
    try {
      await browser?.close?.();
    } catch {
      // ignore
    }
    const forced = await attachPage(chromium, CDP, appBase, { requireShell: false });
    if (!forced.ok) {
      await writeReport({
        atUnixMs: Date.now(),
        r4: { pass: false, blocked: true, claim: `R4 Blocked — CDP lost after reload: ${forced.detail}` },
        marker,
        send,
        seedSource,
        before: { visible: true },
        after: { visible: false },
        disrupt: "webview_reload",
      }, 2);
    }
    page = forced.page;
    browser = forced.browser;
  }

  // Give native rehydrate a moment before shell probe.
  await new Promise((resolve) => setTimeout(resolve, 2_000));

  let shellOk = await isShell(page);
  if (!shellOk) {
    log("shell missing after reload — attempting Tester1 unlock…");
    await enterMessengerFromProfilePicker(page, { log }).catch(() => undefined);
    try {
      await ensureTester1Unlocked(page, { log, timeoutMs: 90_000 });
    } catch (error) {
      log(`unlock after reload failed: ${error instanceof Error ? error.message : String(error)}`);
      if (page.isClosed()) {
        const live = await ensureLivePage(chromium, CDP, appBase, page, browser);
        if (live.ok) {
          page = live.page;
          browser = live.browser;
          await enterMessengerFromProfilePicker(page, { log }).catch(() => undefined);
          await ensureTester1Unlocked(page, { log, timeoutMs: 90_000 }).catch((err) => {
            log(`unlock retry: ${err instanceof Error ? err.message : String(err)}`);
          });
        }
      }
    }
    shellOk = await isShell(page);
  }

  if (!shellOk) {
    await writeReport({
      atUnixMs: Date.now(),
      r4: {
        pass: false,
        blocked: true,
        claim: "R4 Blocked — shell not interactive after reload (AUTH-SESSION risk — no product patch)",
      },
      marker,
      send,
      seedSource,
      before: { visible: true },
      after: { visible: false, shellOk: false },
      disrupt: "webview_reload",
    }, 2);
  }

  const reopened = await openPeerThreadOnly(page, "Tester2", TESTER2_PUBKEY, TESTER2_FRIEND_CODE);
  log(`reopen thread=${reopened}`);
  const afterVisible = await waitForMarker(page, marker, 60_000);
  log(`after reload markerVisible=${afterVisible}`);

  const pass = beforeVisible && afterVisible;
  await writeReport({
    atUnixMs: Date.now(),
    r4: {
      pass,
      blocked: false,
      claim: pass
        ? `R4 Pass — marker ${marker} survived WebView reload via ${seedSource} (smoke; not O-2 cold process)`
        : `R4 Fail — marker lost after reload (before=${beforeVisible}, after=${afterVisible}, reopen=${reopened})`,
    },
    marker,
    send,
    seedSource,
    before: { visible: beforeVisible },
    after: { visible: afterVisible, shellOk, reopened },
    disrupt: "webview_reload",
    notes: [
      "WebView reload is the automated proxy for quit→relaunch.",
      "O-2 full process kill remains PAUSED as repair theme.",
      "Fresh compose preferred; Soft L3 marker corroboration when CDP compose flakes (same pattern as R3).",
      "No Dev Lab synthetic send.",
    ],
  }, pass ? 0 : 1);
}

main().catch(async (error) => {
  const detail = error instanceof Error ? error.stack ?? error.message : String(error);
  log(`fatal: ${detail}`);
  try {
    await writeReport({
      atUnixMs: Date.now(),
      r4: { pass: false, blocked: true, claim: `R4 Blocked — fatal: ${String(detail).slice(0, 200)}` },
      marker: MARKER,
      detail,
    }, 2);
  } catch {
    process.exit(2);
  }
});
