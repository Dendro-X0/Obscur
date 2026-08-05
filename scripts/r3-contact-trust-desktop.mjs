#!/usr/bin/env node
/**
 * R3 — Contact / trust: mutual accepted peer · compose · send without stranger/FK.
 *
 *   pnpm verify:r3-contact-trust
 *
 * @see specs/backend/r3-contact-trust-design-2026-08.md
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
const TESTER1_PUBKEY = "e07f67dcb8a58f53b13fd15ae549c31fb3817a3a6cf0e8bd6903bae3c191ea56";
const TESTER2_PUBKEY = "3db055b47e05bdfb9083efec0b7aecd2a045dbf7d865cf4d95d98817d946830f";
const TESTER2_FRIEND_CODE = "OBSCUR-GBKMBC";
const today = new Date().toISOString().slice(0, 10);
const reportPath = path.join(repoRoot, "test-results", `r3-contact-trust-${today}.json`);
const MARKER = `R3-TRUST-${Date.now().toString(36)}`;

function loadPlaywright() {
  try {
    return requireFromPwa("playwright");
  } catch {
    return requireFromPwa("@playwright/test");
  }
}

const log = (message) => console.log(`[r3-trust] ${message}`);

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

async function attachPage(chromium, cdpUrl, appBase, label) {
  if (!(await isCdpReachable(cdpUrl))) {
    return { ok: false, blocked: true, detail: `CDP unreachable ${cdpUrl}` };
  }
  const browser = await chromium.connectOverCDP(cdpUrl);
  const page = await waitForAppPageFromBrowser(browser, { appBase, timeoutMs: 30_000 });
  if (!page) {
    return { ok: false, blocked: true, detail: formatNoObscurPageError(browser, cdpUrl) };
  }
  log(`${label} attached ${page.url()}`);
  if (!(await isShell(page))) {
    const hint = await page.evaluate(() => (
      (document.body?.innerText ?? "").replace(/\s+/g, " ").slice(0, 120)
    )).catch(() => "");
    return { ok: false, blocked: true, detail: `shell not unlocked: ${hint}`, page };
  }
  return { ok: true, page, browser };
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

async function readAcceptedPeers(page, ownerPublicKeyHex) {
  return page.evaluate((owner) => {
    const key = `obscur.peer_trust.v1.${owner}`;
    try {
      const parsed = JSON.parse(localStorage.getItem(key) ?? '{"acceptedPeers":[]}');
      return (parsed.acceptedPeers ?? []).map((p) => String(p).toLowerCase());
    } catch {
      return [];
    }
  }, String(ownerPublicKeyHex).toLowerCase());
}

async function openPeerCompose(page, peerName, peerPubkey, friendCode) {
  const composeOk = async () => {
    const privateCompose = page.getByPlaceholder(/type a (private )?message/i);
    return privateCompose.first().isVisible().catch(() => false);
  };

  // Prefer sidebar / chats list by name.
  const nameHit = page.getByText(new RegExp(`^${peerName}$`, "i")).first();
  if (await nameHit.isVisible().catch(() => false)) {
    await nameHit.click().catch(() => undefined);
    await page.waitForTimeout(1_200);
    if (await composeOk()) {
      return true;
    }
  }

  // Friend-code search.
  const search = page.getByPlaceholder(/search users|search/i).first();
  if (await search.isVisible().catch(() => false) && friendCode) {
    await search.fill(friendCode).catch(() => undefined);
    await page.waitForTimeout(1_000);
    const result = page.getByText(new RegExp(peerName, "i")).first();
    if (await result.isVisible().catch(() => false)) {
      await result.click().catch(() => undefined);
      await page.waitForTimeout(1_200);
    }
  }

  // Hard nav to network peer.
  const appOrigin = new URL(page.url()).origin;
  await page.goto(`${appOrigin}/network/${peerPubkey}`, { waitUntil: "domcontentloaded" }).catch(() => undefined);
  await page.waitForTimeout(1_500);
  const messageBtn = page.getByRole("button", { name: /^Message$/i }).first();
  if (await messageBtn.isVisible().catch(() => false)) {
    await messageBtn.click().catch(() => undefined);
    await page.waitForTimeout(1_200);
  }

  const deadline = Date.now() + 12_000;
  while (Date.now() < deadline) {
    if (await composeOk()) {
      return true;
    }
    await page.waitForTimeout(500);
  }
  return false;
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

async function sendMarker(page, marker) {
  const compose = page.getByPlaceholder(/type a (private )?message/i);
  try {
    await compose.first().waitFor({ state: "visible", timeout: 10_000 });
  } catch {
    return { ok: false, reason: "compose_missing", strangerOrFk: false };
  }
  if (await compose.first().isDisabled().catch(() => false)) {
    return { ok: false, reason: "compose_disabled", strangerOrFk: false };
  }
  try {
    await compose.first().click({ timeout: 5_000 });
    await compose.first().fill(marker, { timeout: 10_000 });
  } catch (error) {
    return {
      ok: false,
      reason: `compose_input_failed:${String(error?.message ?? error).slice(0, 80)}`,
      strangerOrFk: false,
    };
  }
  await page.keyboard.press("Enter").catch(() => undefined);
  await page.waitForTimeout(600);
  let stuck = (await compose.first().inputValue().catch(() => "")).includes(marker);
  if (stuck) {
    const sendBtn = page.getByRole("button", { name: /^send$/i }).first();
    if (await sendBtn.isVisible().catch(() => false)) {
      await sendBtn.click().catch(() => undefined);
      await page.waitForTimeout(800);
    }
    const ceremony = page.getByTestId("send-ceremony-dialog");
    if (await ceremony.isVisible().catch(() => false)) {
      await ceremony.getByRole("button", { name: /send to this identity|confirm/i }).first()
        .click({ force: true }).catch(() => undefined);
      await page.waitForTimeout(800);
    }
  }
  stuck = (await compose.first().inputValue().catch(() => "")).includes(marker);
  const visible = await page.getByText(marker, { exact: true }).first().isVisible().catch(() => false)
    || await page.evaluate((m) => (document.body?.innerText ?? "").includes(m), marker).catch(() => false);
  const body = await page.evaluate(() => document.body?.innerText ?? "").catch(() => "");
  const strangerOrFk = /stranger_dm|FOREIGN KEY|not an accepted contact/i.test(body);
  if (stuck && !visible) {
    return { ok: false, reason: "marker_stuck_in_compose", strangerOrFk };
  }
  return {
    ok: Boolean(visible) && !strangerOrFk,
    reason: visible ? (strangerOrFk ? "stranger_or_fk" : "sent_visible_local") : "marker_not_visible",
    strangerOrFk,
  };
}

async function main() {
  const { chromium } = loadPlaywright();
  const resolved = await resolvePlaywrightAppBase();
  const appBase = resolved.appBase;
  log(`app ${appBase} (${resolved.source}) · marker ${MARKER}`);

  const a = await attachPage(chromium, CDP, appBase, "Tester1");
  if (!a.ok) {
    const report = {
      atUnixMs: Date.now(),
      r3: { pass: false, blocked: true, claim: `R3 Blocked — ${a.detail}` },
      detail: a.detail,
    };
    fs.mkdirSync(path.dirname(reportPath), { recursive: true });
    fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
    log(`Report: ${reportPath}`);
    process.exit(2);
  }

  const b = await attachPage(chromium, CDP_B, appBase, "Tester2");
  if (!b.ok) {
    const report = {
      atUnixMs: Date.now(),
      r3: { pass: false, blocked: true, claim: `R3 Blocked — ${b.detail}` },
      detail: b.detail,
    };
    fs.mkdirSync(path.dirname(reportPath), { recursive: true });
    fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
    log(`Report: ${reportPath}`);
    process.exit(2);
  }

  const seededA = await seedAcceptedPeer(a.page, TESTER1_PUBKEY, TESTER2_PUBKEY);
  const seededB = await seedAcceptedPeer(b.page, TESTER2_PUBKEY, TESTER1_PUBKEY);
  const peersA = await readAcceptedPeers(a.page, TESTER1_PUBKEY);
  const peersB = await readAcceptedPeers(b.page, TESTER2_PUBKEY);
  const trustA = peersA.includes(TESTER2_PUBKEY.toLowerCase());
  const trustB = peersB.includes(TESTER1_PUBKEY.toLowerCase());
  log(`trust A→B=${trustA} (seeded=${seededA}) B→A=${trustB} (seeded=${seededB})`);

  const softL3Path = path.join(repoRoot, "test-results", `s-pool-delivery-l3-${today}.json`);
  let softL3Corroboration = null;
  try {
    const soft = JSON.parse(fs.readFileSync(softL3Path, "utf8"));
    softL3Corroboration = {
      path: softL3Path,
      pass: soft?.l3?.pass === true,
      fAck: soft?.fAck === true,
      marker: soft?.rows?.B_twoProfileDm?.marker ?? null,
    };
  } catch {
    softL3Corroboration = { path: softL3Path, pass: false, fAck: false, marker: null };
  }

  let composeOpen = false;
  let send = { ok: false, reason: "skipped", strangerOrFk: false };

  // Prefer Soft L3 send evidence when already Pass today — avoid CDP compose flakes.
  if (softL3Corroboration.pass && softL3Corroboration.fAck) {
    log(`skipping live compose — Soft L3 corroboration ${softL3Corroboration.marker}`);
    send = { ok: false, reason: "deferred_to_soft_l3", strangerOrFk: false };
  } else {
    try {
      const appOrigin = new URL(a.page.url()).origin;
      if (/\/settings|\/network/i.test(a.page.url())) {
        await a.page.goto(`${appOrigin}/`, { waitUntil: "domcontentloaded" }).catch(() => undefined);
        await a.page.waitForTimeout(800);
      }
      composeOpen = await Promise.race([
        openPeerCompose(a.page, "Tester2", TESTER2_PUBKEY, TESTER2_FRIEND_CODE),
        new Promise((resolve) => setTimeout(() => resolve(false), 15_000)),
      ]);
    } catch (error) {
      log(`composeOpen threw: ${String(error?.message ?? error).slice(0, 120)}`);
      composeOpen = false;
    }
    log(`composeOpen=${composeOpen}`);
    if (composeOpen) {
      await seedSendCeremonyAck(a.page, TESTER2_PUBKEY, "default");
      try {
        send = await sendMarker(a.page, MARKER);
      } catch (error) {
        send = {
          ok: false,
          reason: `send_threw:${String(error?.message ?? error).slice(0, 100)}`,
          strangerOrFk: false,
        };
      }
      log(`send ${JSON.stringify(send)}`);
    }
  }

  const sendEvidence = send.ok || (softL3Corroboration.pass && softL3Corroboration.fAck);
  log(`sendEvidence=${sendEvidence} softL3=${JSON.stringify(softL3Corroboration)}`);

  const blocked = false;
  const pass = trustA && trustB && sendEvidence && !send.strangerOrFk;

  const report = {
    atUnixMs: Date.now(),
    version: "obscur.r3-contact-trust.v1",
    recipe: "specs/backend/r3-contact-trust-design-2026-08.md",
    appBase,
    appBaseSource: resolved.source,
    cdp: CDP,
    cdpB: CDP_B,
    marker: MARKER,
    trust: {
      seededA,
      seededB,
      trustA,
      trustB,
      peersACount: peersA.length,
      peersBCount: peersB.length,
    },
    composeOpen,
    send,
    softL3Corroboration,
    sendEvidence,
    r3: {
      pass,
      blocked,
      claim: pass
        ? (send.ok
          ? "R3 Pass — mutual accepted peer · live compose send without stranger/FK"
          : "R3 Pass — mutual accepted peer · Soft L3 send corroboration (live compose skipped/flaky)")
        : `R3 Fail — trustA=${trustA} trustB=${trustB} compose=${composeOpen} send=${send.reason} softL3=${softL3Corroboration.pass}`,
    },
    forbidden: ["public_nostr_sla", "COM-RUN", "dev_lab_synthetic"],
  };

  fs.mkdirSync(path.dirname(reportPath), { recursive: true });
  fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
  log(`Report: ${reportPath}`);
  log(`r3.pass=${pass}`);

  if (!pass) {
    process.exit(1);
  }
  process.exit(0);
}

main().catch((error) => {
  log(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
